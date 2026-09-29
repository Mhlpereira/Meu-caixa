# Spec 06 — Nota fiscal por foto e divisão de conta

> Status: **projetado, não implementado.** Este documento decide a abordagem
> antes de escrever código.

## O problema

Jantar de oito pessoas, conta de R$ 640. Hoje o Mario digita "Jantar 640",
lança no perfil Pessoal, e o app acha que ele gastou R$ 640 — quando gastou
R$ 80 e vai receber R$ 560 de volta. O saldo do mês fica errado por dias, até
o dinheiro voltar.

Duas necessidades, na ordem:

1. **Lançar sem digitar** — fotografar a nota e o app preencher valor e itens.
2. **Dividir** — marcar quanto daquilo é seu de verdade.

A segunda é a que corrige o saldo. A primeira só tira atrito.

## Decisão de tecnologia

O pedido original foi TensorFlow.js. **Não é o caminho certo aqui**, e vale
explicar por quê antes de alguém gastar uma semana nisso.

### Por que não TensorFlow.js

| Problema | Detalhe |
| --- | --- |
| OCR não é um modelo só | Precisa de detecção de texto (CRAFT/EAST) **mais** reconhecimento (CRNN). São dois modelos encadeados, treinados por você ou adaptados. |
| Peso | Modelos somam dezenas de MB no APK, contra 46 MB do app inteiro hoje. |
| Desempenho | `@tensorflow/tfjs-react-native` roda via bridge com conversão de tensores custosa. Inferência de segundos num celular intermediário. |
| Manutenção | O pacote está praticamente parado; depende de APIs antigas do Expo. |
| Qualidade | Nota fiscal é o pior caso de OCR: fonte térmica, papel amassado, colunas. Um modelo genérico erra muito. |

TensorFlow.js faria sentido se fôssemos treinar um modelo **próprio** para algo
que não existe pronto — classificar gasto por descrição, por exemplo. Para ler
texto de imagem, já existe coisa melhor e gratuita.

### O que usar

**Primeiro: o QR code.** Toda NFC-e brasileira tem um QR code com a chave de
acesso de 44 dígitos. Ler código de barras é problema resolvido, funciona com
foto tremida, e devolve dado **estruturado** em vez de texto adivinhado. É
ordens de magnitude mais confiável que OCR.

**Segundo: OCR on-device com ML Kit.** Para nota sem QR (cupom antigo, conta de
restaurante escrita à mão, comanda). O ML Kit da Google roda offline, é
gratuito, vem otimizado para o aparelho e não sobe imagem para lugar nenhum.

| Camada | Biblioteca | Rede | Resultado |
| --- | --- | --- | --- |
| QR code | `expo-camera` (já tem leitor de barcode) | não | chave de 44 dígitos |
| Consulta da chave | SEFAZ do estado | **sim, opcional** | itens, valores, CNPJ |
| OCR | ML Kit Text Recognition | não | texto bruto |
| Extração | regex/heurística própria | não | total, data, itens |

A consulta ao SEFAZ é o único passo que usa rede, e é **opcional**: sem
internet, o app fica com o total lido por OCR e você ajusta à mão.

### O que isso custa

ML Kit precisa de módulo nativo — ou seja, mais um config plugin em
`plugins/`, como o widget. Não roda no Expo Go. Isso já é aceito no projeto
(ver [04](04-arquitetura.md)), mas vale registrar: cada dependência nativa
aumenta o tempo de build e a superfície de quebra a cada SDK novo.

## Fluxo

```
widget [📷]  ou  app [+] → Fotografar nota
        ↓
  câmera abre, procura QR code automaticamente
        ↓
   ┌────────────────┴────────────────┐
   │                                 │
 achou QR                       não achou
   │                                 │
 tem internet?                    OCR local
   │                                 │
 sim → SEFAZ                    total + data
 não → só a chave                    │
   │                                 │
   └────────────────┬────────────────┘
                    ↓
        tela de conferência (sempre)
        valor, data, categoria, itens
                    ↓
          dividir? ──não──→ lança e pronto
                    │
                   sim
                    ↓
            tela de divisão
```

**A tela de conferência nunca é pulada.** Reconhecimento erra, e um lançamento
errado que entrou sozinho é pior que digitar. O app mostra o que entendeu e
você confirma — com o campo do valor já focado, para corrigir num toque.

## Divisão

### Duas formas

**Igual entre N pessoas.** Escolhe quantas, pronto. R$ 640 entre 8 = R$ 80 seus.
Resolve a maioria dos casos em dois toques.

**Por item.** Cada item da nota é atribuído a uma ou mais pessoas. A picanha foi
de três, a cerveja de todo mundo, a sobremesa só sua. O app soma o que é seu.

A segunda só faz sentido quando os itens foram reconhecidos — via QR/SEFAZ, ou
OCR que conseguiu separar linhas. Sem itens, só a divisão igual aparece.

### Pessoas

Participantes são **nomes avulsos**, não perfis. Perfil é uma separação
estrutural da sua vida financeira (Pessoal / Empresa); a galera do jantar não é
isso. O app guarda os nomes já usados para sugerir da próxima vez.

### O que entra no seu saldo

```
seu_valor  = soma dos itens atribuídos a você
             ou  total / número de pessoas

a_receber  = total − seu_valor
```

O lançamento criado é de **`seu_valor`**, não do total. É isso que conserta o
saldo do mês.

O `a_receber` é registrado junto, com quem deve o quê. Marcar como recebido é
manual — o app não tem como saber que o Pix caiu.

Decisão consciente: o valor que os outros devem **não** entra como receita
prevista. Dívida de amigo não é renda, e inflar a projeção com dinheiro que
pode nunca voltar seria mentir na única tela que precisa ser honesta.

## Modelo de dados (v4)

```sql
CREATE TABLE receipts (
  id             TEXT PRIMARY KEY NOT NULL,
  commitment_id  TEXT REFERENCES commitments (id) ON DELETE CASCADE,
  image_path     TEXT,
  access_key     TEXT,          -- chave NFC-e de 44 dígitos
  merchant       TEXT,
  issued_at      TEXT,
  total_amount   INTEGER NOT NULL,
  source         TEXT NOT NULL, -- 'qr' | 'sefaz' | 'ocr' | 'manual'
  raw_text       TEXT,
  created_at     TEXT NOT NULL
);

CREATE TABLE receipt_items (
  id           TEXT PRIMARY KEY NOT NULL,
  receipt_id   TEXT NOT NULL REFERENCES receipts (id) ON DELETE CASCADE,
  description  TEXT NOT NULL,
  quantity     INTEGER NOT NULL DEFAULT 1000,  -- milésimos, aceita 0,5 kg
  total_amount INTEGER NOT NULL,
  position     INTEGER NOT NULL
);

CREATE TABLE split_participants (
  id          TEXT PRIMARY KEY NOT NULL,
  receipt_id  TEXT NOT NULL REFERENCES receipts (id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  is_me       INTEGER NOT NULL DEFAULT 0,
  owed_amount INTEGER NOT NULL DEFAULT 0,
  settled_at  TEXT
);

CREATE TABLE split_assignments (
  item_id        TEXT NOT NULL REFERENCES receipt_items (id) ON DELETE CASCADE,
  participant_id TEXT NOT NULL REFERENCES split_participants (id) ON DELETE CASCADE,
  PRIMARY KEY (item_id, participant_id)
);
```

`quantity` em milésimos porque nota fiscal tem "0,384 kg". O mesmo raciocínio
dos centavos: inteiro em vez de float.

Item dividido entre várias pessoas rateia pelo número de atribuições, com a
sobra de centavos indo para o primeiro — mesma regra de `splitInstallments`.

## Widget

O widget é **do tamanho de um ícone** (1×1) e abre um seletor com as duas
formas de lançar:

```
tela inicial          ao tocar
┌────┐          ┌──────────────────┐
│ +  │          │   +        📷    │
└────┘          │ Gasto     Nota   │
                └──────────────────┘
```

| Opção | O que faz |
| --- | --- |
| **Gasto** | Telinha nativa de gasto rápido, sem carregar o app |
| **Nota** | Abre o app direto na câmera |

O seletor também é nativo, então aparece instantâneo. O custo é um toque a mais
para o gasto rápido — foi o preço de caber num ícone em vez de ocupar meia tela
inicial.

A assimetria entre as duas opções é intencional. O lançamento rápido é Kotlin
puro; a foto precisa de câmera, reconhecimento e conferência de itens — isso é
React Native e exige o app aberto. Fingir o contrário deixaria o botão lento
sem motivo.

## Etapas

Cada uma entrega valor sozinha.

| Etapa | Entrega |
| --- | --- |
| **1** | Botão da câmera no widget + captura de foto anexada ao lançamento, valor digitado à mão |
| **2** | Leitura do QR code da NFC-e, preenchendo total e data |
| **3** | Consulta ao SEFAZ (opcional, com rede) trazendo os itens |
| **4** | Divisão igual entre N pessoas |
| **5** | OCR via ML Kit para nota sem QR |
| **6** | Divisão por item |

A etapa 4 vem antes do OCR de propósito: **dividir a conta conserta o saldo,
ler a nota só economiza digitação.** Se o projeto parar na 4, a parte que
importa está pronta.

## Critérios de aceite

- [ ] **N1** O botão da câmera no widget abre o app já na câmera.
- [ ] **N2** Nota com QR code preenche total e data sem digitação.
- [ ] **N3** Sem internet, a leitura do QR ainda preenche o total.
- [ ] **N4** Nota sem QR cai no OCR e preenche ao menos o total.
- [ ] **N5** A tela de conferência sempre aparece antes de lançar.
- [ ] **N6** Reconhecimento errado é corrigível sem recomeçar.
- [ ] **N7** Divisão igual entre 8 pessoas lança 1/8 do total.
- [ ] **N8** Divisão por item soma só os itens atribuídos a você.
- [ ] **N9** Item dividido entre 3 não perde centavo no rateio.
- [ ] **N10** O valor que os outros devem **não** entra como receita prevista.
- [ ] **N11** Marcar um participante como acertado não altera o saldo do mês.
- [ ] **N12** A foto fica no aparelho e não é enviada a lugar nenhum.
- [ ] **N13** Excluir o lançamento apaga a nota e a divisão junto.
- [ ] **N14** Nomes de participantes já usados aparecem como sugestão.

## Privacidade

A imagem da nota fica no armazenamento privado do app e entra no backup JSON
apenas como caminho — o arquivo em si não é serializado, para não inflar o
backup. Nenhuma imagem sai do aparelho.

A única chamada de rede do app inteiro seria a consulta ao SEFAZ, que envia
apenas a chave de acesso — um dado que já está impresso na nota. É opcional e
desligável.
