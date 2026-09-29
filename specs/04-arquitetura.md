# Spec 04 — Arquitetura

## Stack

| Peça | Escolha | Porquê |
| --- | --- | --- |
| Runtime | Expo SDK 57 | Roda no Expo Go, sem build nativo |
| Navegação | `expo-router` | Rotas por arquivo, tabs e modais prontos |
| Banco | `expo-sqlite` (API async) | Relacional, consulta por mês, funciona no Expo Go |
| Estado | `zustand` | Store pequena, sem boilerplate de Context |
| Segredo | `expo-secure-store` | Keychain / Keystore para hash do PIN |
| Biometria | `expo-local-authentication` | Face ID / digital |
| Hash | `expo-crypto` | SHA-256 nativo |
| Datas | `src/utils/date.ts`, próprio | Ver nota abaixo |
| Gráfico | `react-native-svg` | Curva própria; lib de chart seria peso morto |
| Ícones | `@expo/vector-icons` (Ionicons) | Já vem no Expo |
| Haptics | `expo-haptics` | Confirmação de "pago" |
| Gestos | `react-native-gesture-handler` + `reanimated` | Swipe na linha do lançamento |
| Data picker | `@react-native-community/datetimepicker` | Picker nativo, roda no Expo Go |
| Backup | `expo-file-system` + `expo-sharing` + `expo-document-picker` | Exportar e importar JSON |
| Barras do sistema | `expo-system-ui` + `expo-navigation-bar` | Barras do Android seguem o tema |
| Câmera / QR | `expo-camera` | Leitor de código de barras embutido, sem dependência extra |

**Atenção:** `androidNavigationBar` e `androidStatusBar` no `app.json` foram
descontinuados no SDK 57 e **não fazem efeito**. O prebuild avisa, mas o build
passa. A configuração real é pelo plugin `expo-navigation-bar`.

**Por que datas próprias em vez de `date-fns`:** o app não opera sobre `Date`.
Ele opera sobre duas strings — `Competence` (`'YYYY-MM'`) e `ISODate`
(`'YYYY-MM-DD'`) — e as operações que importam (andar N meses, encaixar o dia 31
em fevereiro, comparar competências) são aritmética de inteiros sobre elas.
Passar por `Date` só reintroduziria timezone e horário, que são exatamente as
duas coisas que criam bug aqui. São ~40 linhas, cobertas por teste.

O app em si roda no **Expo Go** — `npx expo start` e o QR code bastam para
desenvolver. O **widget de tela inicial é a exceção**: ele é código nativo
(Kotlin + RemoteViews) e só existe num APK compilado. O Expo Go roda todo o
resto normalmente, apenas sem o widget aparecer na lista do Android.

## Config plugins

Tudo que toca a pasta `android/` vive em `plugins/`, nunca como arquivo solto —
porque `expo prebuild --clean` apaga a pasta inteira.

| Plugin | O que faz |
| --- | --- |
| `withQuickEntryWidget` | Gera o `AppWidgetProvider` em Kotlin, o layout, os drawables e registra o receiver no manifest |
| `withReleaseSigning` | Copia a keystore de `keystore/` para dentro de `android/`, injeta as credenciais no `gradle.properties` e troca `signingConfigs.debug` por `release` |

O `withReleaseSigning` existe por causa de um erro real: a keystore estava
dentro de `android/`, um `prebuild --clean` apagou ela, e o build seguiu
**verde** assinando com a chave de debug — porque o template do Expo usa
`signingConfigs.debug` como padrão do release. O APK gerado não instalava por
cima do app existente, e a keystore original não era recuperável.

Por isso o plugin **quebra o build com erro explícito** quando a keystore ou as
credenciais faltam. Falhar alto é o objetivo: o modo de falha silencioso foi o
que causou o estrago.

## Boot

```
1. abre o banco:
     CREATE TABLE IF NOT EXISTS ...   (tabelas)
     lê schema_version
     aplica migrações pendentes
     CREATE INDEX IF NOT EXISTS ...   (índices, SEMPRE por último)
2. carrega dados, trava e tema em paralelo
3. qualquer passo que falhe vira tela de erro com botão "Tentar de novo"
```

**Os índices rodam depois das migrações, e isso não é detalhe.** Um índice
sobre coluna nova falha em banco antigo, porque `CREATE TABLE IF NOT EXISTS`
não adiciona coluna a tabela existente — quem faz isso é a migração. Rodar o
índice antes quebrava o app de quem já tinha dados, enquanto instalação nova
funcionava. Bug difícil de ver em teste que só exercita migração isolada.

O boot usa `Promise.allSettled` e sempre termina. Antes era `Promise.all(...)
.then(...)` sem `.catch`: um passo que rejeitasse deixava o app girando para
sempre, sem log e sem mensagem. **Falhar visível é requisito, não conforto.**

`getDb()` também não guarda mais a rejeição — antes, um erro transitório na
abertura do banco brickava o app até reinstalar.

## Camadas

```
app/            rotas (expo-router) — só composição e layout
  (tabs)/       mês, futuro, compromissos, ajustes
  lock.tsx      onboarding.tsx      entry/[id].tsx

src/
  db/           schema.sql, client, migrations, seed
  repositories/ SQL bruto, uma função por consulta — a única camada que fala SQL
  domain/       regras puras: materialize, clampDay, cálculos do mês, projeção
  stores/       zustand: sessão (trava), perfil ativo, mês selecionado
  hooks/        useMonth, useProjection, useCommitments — liga repo + store
  ui/           componentes sem regra de negócio: Card, Money, MonthPicker…
  theme/        cores, espaçamento, tipografia
  utils/        money, date, id
```

A regra que sustenta o resto: **`domain/` não importa nada do React nem do
SQLite.** É função pura de entrada e saída. É o que torna a materialização e os
cálculos de saldo testáveis sem subir um app ou um banco — e essas são
exatamente as partes onde um erro passa despercebido e envenena todos os
números da tela.

`repositories/` é a única camada que escreve SQL. Nenhum componente monta query.

## Fluxo de dados

```
tela → hook → repository → SQLite
                  ↑
              domain (puro)
```

Escrita invalida um contador de versão na store; os hooks observam e refazem a
consulta. Sem cache sofisticado: o banco é local e as consultas são de
milissegundos. Um `react-query` aqui resolveria um problema que não existe.

## Migrações

`settings.schema_version` guarda a versão. No boot, `migrate()` aplica em ordem
as migrações acima da versão atual, cada uma numa transação. A v1 cria o schema
e as sementes.

Mesmo sendo app pessoal, isso existe desde o começo: sem migração, a primeira
mudança de schema em um app com dados reais dentro vira perda de dados.

## Boot

```
1. abre o banco, roda migrate()
2. lê settings
3. PIN configurado? → tela de trava → biometria / PIN
4. onboarding pendente? → onboarding
5. estende o horizonte das recorrências
6. entra na aba Mês, no mês corrente
```

O passo 5 é o que mantém a projeção viva sem tarefa em segundo plano — o app
só precisa estar em dia quando você olha para ele.

## Testes

`jest` + `@testing-library/react-native`, com foco em `domain/`:

- `materialize` nos três tipos, incluindo virada de ano;
- `clampDay` em fevereiro, ano bissexto, meses de 30 e 31;
- rematerialização preservando `paid` e `is_overridden`;
- saldos do mês com `skipped` no meio;
- acumulado da projeção com mês negativo.

A UI ganha smoke tests; o que precisa de rede de segurança é a aritmética.

## Convenções

- TypeScript `strict`, sem `any` — dinheiro tipado como `Cents = number`.
- Nomes de domínio em inglês no código (`commitment`, `occurrence`), textos de
  interface em pt-BR, centralizados em `src/i18n/pt-BR.ts`.
- Nada de `console.log` em código entregue.
