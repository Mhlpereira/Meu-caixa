# Spec 02 — Regras de Negócio

## Materialização

Transformar um compromisso nas suas ocorrências mensais.

### `single`

Uma ocorrência. `competence` = mês de `start_date`, `due_date` = `start_date`,
`installment_index` = NULL.

### `installment`

`installments` ocorrências, do mês de `start_date` em diante, uma por mês.

```
parcela i (1-based):
  competence = mês(start_date) + (i - 1) meses
  due_date   = mesmo dia de start_date, ajustado ao tamanho do mês
  amount     = commitment.amount
  index      = i
```

Uma compra em 10x feita em 2026-03-15 ocupa de 2026-03 a 2026-12. A décima
parcela é "10/10" e depois disso o compromisso some da projeção sozinho.

### `recurring`

Do mês de `start_date` até o **menor** entre:

- o mês de `end_date`, se houver;
- o **horizonte** — hoje + `horizon_months` (padrão 36).

```
competence = cada mês no intervalo
due_date   = day_of_month daquele mês, ajustado ao tamanho do mês
amount     = commitment.amount
index      = NULL
```

Recorrência sem fim nunca é infinita no banco: materializa até o horizonte e
**estende sozinha** conforme o tempo passa (ver abaixo).

### Ajuste de dia (`clampDay`)

`day_of_month = 31` em fevereiro não existe. A regra é **o último dia do mês**:

| Pedido | Fevereiro 2026 | Abril 2026 |
| --- | --- | --- |
| dia 31 | 28 | 30 |
| dia 30 | 28 | 30 |
| dia 15 | 15 | 15 |

Nunca vaza para o mês seguinte. Um boleto do dia 31 é do mês dele, não do próximo.

### Extensão do horizonte

Na abertura do app, para cada compromisso `recurring` ativo e sem `end_date`:
se a última ocorrência é anterior ao horizonte, cria as que faltam. Operação
idempotente — o `UNIQUE (commitment_id, competence)` garante que rodar duas
vezes não duplica.

### Rematerialização ao editar

Editar um compromisso não pode reescrever o passado nem apagar o que você
ajustou à mão. Ao salvar uma edição:

1. Ocorrências com `status = 'paid'` — **preservadas intactas**. Já aconteceram.
2. Ocorrências com `is_overridden = 1` — valor preservado, data recalculada.
3. Ocorrências `pending` de meses **anteriores ao atual** — preservadas.
4. O resto (pendentes, do mês atual em diante) — apagadas e recriadas.

Mudar o valor da Netflix de R$ 45 para R$ 55 corrige daqui para frente e deixa
o histórico contando a verdade.

### Exclusão

- Excluir o compromisso apaga todas as ocorrências (`ON DELETE CASCADE`).
- Para parar sem perder histórico: **arquivar**. Apaga as ocorrências `pending`
  futuras e mantém as passadas e pagas.

## Cálculos do mês

Dado um `competence` e um escopo (um perfil, ou `ALL`):

```
receitas_previstas = Σ amount  onde kind='income'  e status ≠ 'skipped'
despesas_previstas = Σ amount  onde kind='expense' e status ≠ 'skipped'
saldo_previsto     = receitas_previstas − despesas_previstas

receitas_realizadas = Σ amount  onde kind='income'  e status = 'paid'
despesas_realizadas = Σ amount  onde kind='expense' e status = 'paid'
saldo_realizado     = receitas_realizadas − despesas_realizadas

a_pagar  = despesas_previstas − despesas_realizadas
a_receber = receitas_previstas − receitas_realizadas
```

`skipped` sai de todas as contas — é o mês que não conta.

## Investimento

Ocorrências com `is_investment = 1` **saem do total de despesas** e formam um
grupo próprio. A conta do mês passa a ser:

```
despesas_previstas = Σ expense onde is_investment = 0
investido_previsto = Σ expense onde is_investment = 1
investido_real     = Σ expense onde is_investment = 1 e status = 'paid'

saldo_previsto     = receitas_previstas − despesas_previstas
sobra_apos_investir = saldo_previsto − investido_real
```

O saldo do mês ignora o investimento de propósito: ele responde *"quanto sobrou
para eu decidir o que fazer"*, e investir é uma das decisões possíveis. Somar o
aporte como gasto faria o app reportar R$ 6.500 de despesa num mês em que você
gastou R$ 5.000 e guardou R$ 1.500.

### Meta

Cada perfil tem `investment_goal`, um valor mensal em centavos. No escopo
consolidado as metas dos perfis somam.

```
falta         = meta − investido_real
progresso     = min(investido_real / meta, 1)      // null se meta = 0
meta_cabe     = saldo_previsto >= meta
```

`meta_cabe` é o número que importa: separa a meta que dá para bater este mês da
meta que é fantasia. O app diz "a sobra do mês cobre" ou "não cobre" em vez de
só mostrar a barra.

Meta zero desliga o acompanhamento — o card some da tela do mês.

**Comprometido**: tudo que sai da conta de forma já combinada — compromissos
`installment` ou `recurring` —, **incluindo aportes recorrentes**. É o número
que responde "quanto do meu salário já está vendido antes do mês começar".

```
comprometido = Σ saídas de compromissos type ∈ {installment, recurring}
               (independente de is_investment)
livre        = receitas_previstas − comprometido
```

Um aporte mensal de R$ 1.500 é tão comprometido quanto o aluguel: os dois saem
da conta sem você decidir nada no mês. Investimento sai de **despesas**, porque
não é gasto, mas não sai de **comprometido**, porque é dinheiro já destinado.
Aporte avulso não conta — esse você decide na hora.

**Taxa de poupança** do mês: `saldo_previsto / receitas_previstas`, exibida só
quando `receitas_previstas > 0`.

## Projeção

A tela de futuro mostra N meses à frente (padrão 12) com:

- saldo previsto de cada mês;
- **saldo acumulado** — a soma corrente a partir do mês atual.

```
acumulado[0] = saldo_previsto(mês_atual)
acumulado[n] = acumulado[n-1] + saldo_previsto(mês_atual + n)
```

O acumulado começa do zero, não do saldo bancário. O app não sabe quanto você
tem na conta; ele projeta **quanto você vai juntar a partir de agora**. Isso é
honesto e é a pergunta que o Mario fez.

O acumulado é o número que responde "em quanto tempo junto para X".

## Escopo consolidado (`ALL`)

Com `ALL` selecionado, todas as somas ignoram `profile_id`. A lista de
lançamentos mostra um selo com a cor e o nome do perfil em cada linha, senão
vira uma sopa indistinguível.

Criar um lançamento com `ALL` ativo não é permitido — o app pede o perfil
primeiro, porque todo compromisso pertence a exatamente um perfil.

## Trava

### Cadastro do PIN

- 6 dígitos, confirmado duas vezes.
- Guardado como `SHA-256(pin + salt)`, com salt aleatório de 16 bytes.
  Hash e salt vão no `expo-secure-store` (Keychain no iOS, Keystore no Android).
- O PIN em si nunca é escrito em lugar nenhum.

O hash aqui é contra quem lê o armazenamento do app, não contra força bruta
offline — com 10⁶ combinações, PBKDF2 não mudaria o jogo. A proteção real
contra tentativa é o bloqueio progressivo.

### Desbloqueio

- Biometria primeiro, se habilitada e disponível. PIN sempre como alternativa.
- Errou o PIN: bloqueio progressivo a partir da 5ª tentativa —
  5ª: 30s, 6ª: 1min, 7ª: 5min, 8ª+: 15min. Contador some ao acertar.
- Não existe "apagar tudo após N tentativas". Perder os dados por engano é pior
  do que o risco que isso cobriria num app offline pessoal.

### Quando tranca

- Ao abrir o app.
- Ao voltar do background depois de mais de `lock_timeout_seconds` (padrão 60s).

Voltar rápido de uma consulta ao WhatsApp não deve exigir biometria de novo.

### Esqueci o PIN

Não há recuperação — sem servidor, sem e-mail. A saída é reinstalar, o que
apaga os dados. A tela de PIN diz isso, e o app insiste no backup JSON antes de
ativar a trava.

## Backup automático

O usuário escolhe uma pasta **uma vez**, pelo seletor do sistema (SAF). O URI
fica em `settings.backup_folder_uri`.

- A cada abertura do app, se passaram mais de 12 horas desde o último, grava
  `meu-caixa-YYYY-MM-DD.json` naquela pasta.
- Mantém os 7 arquivos mais recentes; apaga os anteriores.
- Falha em silêncio: backup que quebra o boot é pior que backup que não roda.

A pasta ser escolhida pelo usuário é o ponto. Gravar em diretório do app faria
a desinstalação levar os backups junto — exatamente quando você mais precisa
deles. Pasta escolhida via SAF fica fora da sandbox e sobrevive.

## Backup manual

- **Exportar**: JSON com perfis, categorias, compromissos, ocorrências e
  `schema_version`. Vai para o share sheet do sistema.
- **Importar**: substitui tudo, com confirmação explícita. Valida
  `schema_version` antes de escrever.
- O backup **não** contém o PIN.

## Validações

| Regra | Mensagem |
| --- | --- |
| Descrição vazia | "Dê um nome para esse lançamento" |
| Valor ≤ 0 | "O valor precisa ser maior que zero" |
| `installment` com parcelas < 2 | "Parcelado precisa de pelo menos 2 parcelas" |
| `installment` com parcelas > 120 | "No máximo 120 parcelas" |
| `recurring` com `end_date` < `start_date` | "A data final vem antes da inicial" |
| Nome de perfil vazio ou duplicado | "Já existe um perfil com esse nome" |
| Excluir o único perfil | "Você precisa de pelo menos um perfil" |
