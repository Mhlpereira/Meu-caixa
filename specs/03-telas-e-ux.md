# Spec 03 — Telas e UX

## Navegação

```
┌─ Trava (PIN)                    ← antes de tudo, se configurado
├─ Onboarding                     ← só na 1ª vez
└─ App
   ├─ Mês          (tab 1)  saldo do mês corrente + lançamentos
   ├─ Futuro       (tab 2)  projeção 12 meses + acumulado
   ├─ Compromissos (tab 3)  parcelas em aberto + gastos fixos
   ├─ Ajustes      (tab 4)  perfis, categorias, segurança, backup
   ├─ [modal] Novo / editar lançamento
   ├─ [modal] Lançamento rápido      ← tipo, valor, observação
   ├─ [tela]  Câmera (nota fiscal)   ← lê QR, vai para a divisão
   ├─ [modal] Dividir a conta        ← apelidos, rateio, sua parte
   ├─ [modal] Detalhe da ocorrência
   ├─ [modal] Caixinhas
   └─ [modal] Seletor de perfil
```

Fora do React, no Android: o **widget** de tela inicial com dois botões, e a
**telinha nativa** de gasto rápido que ele abre. Ver [06](06-nota-fiscal-e-divisao.md#widget).

O botão flutuante **+** fica sobre as tabs 1–3.

## Sistema visual

Três temas, trocáveis em Ajustes › Aparência e salvos em `settings.theme`.

| Tema | Quando | Fundo |
| --- | --- | --- |
| **Neon** (padrão) | uso normal, à noite | azul profundo `#0B0F14` |
| **Escuro** | quem prefere preto neutro | `#0A0A0A` |
| **Claro** | sol, tela clara | `#F5F6F8` |

Neon é o padrão porque o app se olha de noite, revisando o mês, e número
colorido brilha mais sobre fundo escuro.

**Todo par cor/fundo é medido antes de entrar.** Texto precisa de 4,5:1;
elemento gráfico, 3:1. Foi assim que se descobriu que o texto apagado original
(`#5B6B7E`) tinha 2,94:1 sobre os cartões — reprovado até para texto grande.

No tema claro os tons vibrantes não servem: `#34D399` sobre branco dá 1,9:1.
Por isso o claro usa verde `#047857` (5,48:1) e vermelho `#B91C1C` (6,47:1).

### Como o tema chega na tela

`StyleSheet.create` captura as cores **uma vez**, quando o módulo carrega —
trocar de tema não mudaria nada. Por isso os estilos são função do tema:

```ts
const useStyles = makeStyles((colors) => ({ card: { backgroundColor: colors.card } }));
```

`makeStyles` memoriza um conjunto de estilos por tema. Cor usada direto no JSX
vem de `useColors()`. Fundo translúcido de ícone vem de `useTint()`, que ajusta
a opacidade — `${cor}22` funciona no escuro e some no claro.

As barras de status e de navegação do Android seguem o tema.

- Raio de canto: 16 em cartões, 12 em campos, 999 em pílulas.
- Espaçamento em múltiplos de 4; respiro padrão de 16 nas bordas da tela.
- Números de dinheiro em **tabular nums**, para as colunas não dançarem.
- Cor nunca é o único sinal: despesa tem `−` e ícone, receita tem `+`.

## Tela: Mês

```
┌──────────────────────────────────────┐
│  ● Pessoal ▾                    ⚙︎   │  ← seletor de perfil
│                                      │
│  ‹   setembro 2026   ›               │  ← swipe horizontal também navega
│                                      │
│  ┌────────────────────────────────┐  │
│  │  Saldo do mês                  │  │
│  │  + R$ 2.340,00                 │  │  ← grande, colorido
│  │                                │  │
│  │  Entradas      Saídas          │  │
│  │  R$ 8.000,00   R$ 5.660,00     │  │
│  │  ▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░          │  │  ← barra: quanto do que entra já saiu
│  └────────────────────────────────┘  │
│                                      │
│  Comprometido  R$ 3.180,00  (40%)    │  ← fixos + parcelas
│  Livre         R$ 4.820,00           │
│                                      │
│  ── Lançamentos ──────── ▾ todos ──  │
│                                      │
│  hoje                                │
│   🛒  Mercado              −179,90   │
│   📺  Netflix        fixo   −55,00   │
│  dia 15                              │
│   🧊  Geladeira      3/10  −320,00   │
│  dia 05                              │
│   💰  Salário          ✓  +8.000,00  │
└──────────────────────────────────────┘
```

**Comportamentos**

- Lançamentos agrupados por dia, ordenados por `due_date`.
- Pago tem `✓`, valor esmaecido e descrição riscada de leve.
- Parcelado mostra `3/10`; recorrente mostra o selo `fixo`.
- Toque abre o detalhe. **Deslizar para a direita** marca pago/não pago —
  é o gesto mais usado do app e não pode custar dois toques.
- Deslizar para a esquerda revela editar e excluir.
- Filtro `▾` alterna entre todos / a pagar / pagos.
- Mês futuro troca "Saldo do mês" por **"Saldo previsto"**, e o mês passado
  mostra previsto e realizado lado a lado.
- No escopo `ALL`, cada linha ganha um ponto com a cor do perfil.

**Vazio**: ilustração discreta, "Nenhum lançamento em setembro" e um botão
"Adicionar o primeiro".

## Splash e ícone

O `splash` do `app.json` **foi descontinuado** e é silenciosamente ignorado — o
build sai com fundo branco e o ícone padrão do Expo. A configuração que vale é
o plugin `expo-splash-screen`. Conferir no recurso gerado
(`res/values/colors.xml`, `splashscreen_background`) é o único jeito de saber
que pegou.

O ícone é três barras ascendentes, brancas sobre o índigo da marca. Geométrico
de propósito: escala bem de 48dp até 1024px sem virar borrão.

## Tela: Futuro

```
┌──────────────────────────────────────┐
│  Futuro              12 meses ▾      │
│                                      │
│  ↻ Investindo R$ 1.500,00 por mês    │
│                                      │
│  Em 12 meses você terá               │
│  R$ 19.240,00                        │
│      ___________                     │
│   __/                                │  ← curva do patrimônio investido
│  /                                   │
│  ──────────────────────────────────  │
│  Você aporta          R$ 18.000,00   │
│  ↗ Rende               R$ 1.240,00   │
│                                      │
│  set 26  +2.340   acum.  2.340   ›   │
│  out 26  +2.340   acum.  4.680   ›   │
│  nov 26  +2.660   acum.  7.340   ›   │  ← sobe: parcela acabou
│  dez 26  +1.180   acum.  8.520   ›   │  ← cai: 13º? não, IPVA
│  ...                                 │
└──────────────────────────────────────┘
```

O Futuro é sobre **investimento**, não sobre sobra de conta. O número grande é
o patrimônio acumulado nas caixinhas, e o gráfico é a curva dele — com juros
compostos, não soma simples.

- O mês a mês mostra aporte, rendimento do mês e total acumulado.
- Tocar num mês navega para ele na aba Mês.
- Se o aporte planejado for maior que a sobra do mês, aparece um alerta. É a
  única coisa que sobrou de "sobra na conta", e de propósito: planejar
  R$ 1.500/mês quando sobram R$ 900 faz a projeção inteira virar ficção.
- Sem caixinha, a tela convida a criar uma em vez de mostrar número vazio.

## Tela: Compromissos

Duas seções, porque respondem perguntas diferentes.

```
┌──────────────────────────────────────┐
│  Compromissos                        │
│                                      │
│  ── Parcelas em aberto ───────────   │
│  Total restante      R$ 4.480,00     │
│                                      │
│  🧊 Geladeira                        │
│     3/10 · termina em jun 27         │
│     ▓▓▓░░░░░░░   restam R$ 2.240,00  │
│                                      │
│  💻 Notebook                         │
│     8/12 · termina em jan 27         │
│     ▓▓▓▓▓▓▓▓░░   restam R$ 2.240,00  │
│                                      │
│  ── Gastos fixos ─────── R$ 890/mês ─│
│  📺 Netflix              55,00  dia 8│
│  🏠 Aluguel           1.800,00  dia 5│
│  ...                                 │
│                                      │
│  ── Rendas ───────────  R$ 8.500/mês │
│  💰 Salário           8.000,00  dia 5│
│  💼 Consultoria         500,00  dia 20│
└──────────────────────────────────────┘
```

"Termina em jun 27" é a informação que o Mario pediu: quando essa parcela sai
do caminho. A barra de progresso mostra o quanto já foi.

## Modal: Novo lançamento

Um passo só, com o tipo escolhido no topo — não é um wizard.

```
┌──────────────────────────────────────┐
│  ✕        Novo lançamento       Salvar│
│                                      │
│    ┌─────────┬─────────┐             │
│    │ Despesa │ Receita │             │  ← segmentado
│    └─────────┴─────────┘             │
│                                      │
│         − R$ 320,00                  │  ← teclado numérico próprio,
│                                      │    dígitos entram da direita
│  Descrição                           │
│  [ Geladeira                       ] │
│                                      │
│  Categoria                           │
│  [ 🏠 Casa                        ▾] │
│                                      │
│  ┌──────┬────────────┬────────────┐  │
│  │ Única│ Parcelada  │ Recorrente │  │
│  └──────┴────────────┴────────────┘  │
│                                      │
│  ── se Parcelada ──                  │
│  Parcelas  [ 10 ]  1ª em [15/09/26]  │
│  Total R$ 3.200,00 · termina jun/27  │  ← recalcula ao vivo
│                                      │
│  ── se Recorrente ──                 │
│  Todo dia  [ 8 ]                     │
│  De [set/26]  até [ sem fim ▾ ]      │
│                                      │
│  Perfil  ● Pessoal ▾                 │
└──────────────────────────────────────┘
```

**Detalhes que importam**

- O valor é o primeiro campo e já abre com foco. É o que a pessoa veio fazer.
- Teclado numérico próprio: digitar `32000` vira `R$ 320,00`. Sem ponto, sem
  vírgula, sem erro de digitação.
- Em parcelado, o campo é o **valor da parcela**, com o total calculado abaixo.
  Um toque em "total" inverte: você digita o total e ele divide.
- "termina jun/27" aparece antes de salvar. Ver a consequência é metade do valor.
- Categoria sugere a última usada para descrições parecidas.

## Trava

```
┌──────────────────────────────────────┐
│                                      │
│              🔒                      │
│         Digite seu PIN               │
│                                      │
│        ● ● ● ○ ○ ○                   │
│                                      │
│         1    2    3                  │
│         4    5    6                  │
│         7    8    9                  │
│         ☝︎    0    ⌫                  │
│                                      │
│      Usar biometria                  │
└──────────────────────────────────────┘
```

- Biometria dispara sozinha ao abrir, se habilitada.
- PIN errado: os pontos tremem (haptic de erro) e limpam.
- Em bloqueio progressivo: "Tente novamente em 4:32", com contagem regressiva.

## Onboarding

Três telas, puláveis:

1. **Perfis** — "Separe o que é seu do que é da empresa." Já vem com Pessoal e
   Empresa criados; dá para renomear ali mesmo.
2. **Renda** — "Quanto entra por mês?" Cadastra o salário direto, com dia.
3. **Proteção** — "Quer trancar o app?" PIN opcional, pulável.

Ao terminar, cai na aba Mês já com o salário lançado. O app nunca abre vazio.

## Acessibilidade

- Área de toque mínima de 44×44.
- Todo ícone tem `accessibilityLabel`.
- Valores lidos por extenso: "menos trezentos e vinte reais", não "−320,00".
- Contraste mínimo 4.5:1 em texto — a paleta acima já cumpre.
- Respeita `prefers-reduced-motion` desligando as transições de número.

## Microinterações

- Saldo anima contando até o valor ao trocar de mês (200ms, reduzido se pedido).
- Marcar como pago: haptic leve + a linha esmaece.
- Puxar para baixo na aba Mês: reestende o horizonte e recarrega.
- Trocar de mês por swipe, com a transição acompanhando o dedo.
