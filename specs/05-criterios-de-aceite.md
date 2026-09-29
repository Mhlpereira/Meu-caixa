# Spec 05 — Critérios de Aceite

Cada item é verificável no app rodando. A v1 está pronta quando todos passam.

## Perfis

- [ ] **P1** Instalação nova traz os perfis "Pessoal" e "Empresa".
- [ ] **P2** Criar um perfil pede nome, cor e ícone; ele aparece no seletor.
- [ ] **P3** Trocar de perfil recarrega os números do mês sem sair da tela.
- [ ] **P4** O escopo "Todos" soma os perfis e marca cada linha com a cor do dono.
- [ ] **P5** Excluir um perfil apaga os lançamentos dele e pede confirmação nominal.
- [ ] **P6** Excluir o último perfil é recusado com mensagem clara.
- [ ] **P7** Com "Todos" ativo, o botão + pede o perfil antes de abrir o formulário.

## Renda

- [ ] **R1** Cadastrar salário recorrente de R$ 8.000 no dia 5 faz ele aparecer em
      todos os meses futuros, com vencimento no dia 5.
- [ ] **R2** Uma segunda fonte de renda soma no total de entradas do mês.
- [ ] **R3** Renda com data final para de aparecer depois dela.
- [ ] **R4** Aumentar o salário de 8.000 para 9.000 muda os meses futuros e
      **não** muda os meses já pagos.

## Lançamentos

- [ ] **L1** Compra única aparece só no mês da data.
- [ ] **L2** Compra em 10x a partir de 15/09/2026 gera 10 ocorrências, de 09/2026
      a 06/2027, cada uma com o valor da parcela.
- [ ] **L3** A 3ª parcela mostra "3/10".
- [ ] **L4** Depois da última parcela, o compromisso some da projeção.
- [ ] **L5** Gasto recorrente sem data final aparece até o horizonte (36 meses).
- [ ] **L6** Recorrente no dia 31 cai em 28/02 (e 29/02 em ano bissexto), nunca em 01/03.
- [ ] **L7** Editar o valor de uma única ocorrência não altera as outras.
- [ ] **L8** Excluir um parcelado remove todas as parcelas, com confirmação.
- [ ] **L9** Arquivar um recorrente tira os meses futuros e mantém os passados.
- [ ] **L10** Digitar `32000` no teclado do valor mostra `R$ 320,00`.
- [ ] **L11** Em parcelado, alternar entre "valor da parcela" e "valor total"
      recalcula o outro corretamente.

## Mês

- [ ] **M1** A aba Mês abre no mês corrente.
- [ ] **M2** Saldo = entradas − saídas, com sinal e cor certos.
- [ ] **M3** "Comprometido" conta só parcelas e recorrentes.
- [ ] **M4** Deslizar a linha para a direita marca como pago, com haptic.
- [ ] **M5** Pago reflete em "realizado" sem mexer no "previsto".
- [ ] **M6** Marcar um mês como pulado tira ele das duas somas.
- [ ] **M7** Navegar para trás e para frente por seta e por swipe.
- [ ] **M8** Mês futuro rotula "Saldo previsto"; mês passado mostra previsto e realizado.
- [ ] **M9** Mês sem lançamento mostra estado vazio com atalho para adicionar.

## Futuro

- [ ] **F1** Lista 12 meses à frente com saldo previsto de cada um.
- [ ] **F2** O acumulado é a soma corrente a partir do mês atual.
- [ ] **F3** O mês em que um parcelamento acaba mostra saldo maior que o anterior.
- [ ] **F4** Mês com saldo negativo vem destacado em vermelho.
- [ ] **F5** Tocar num mês leva para ele na aba Mês.
- [ ] **F6** O gráfico acompanha a lista.

## Compromissos

- [ ] **C1** Lista os parcelamentos em aberto com progresso e mês de término.
- [ ] **C2** "Total restante" soma só as parcelas ainda não pagas.
- [ ] **C3** Lista os gastos fixos com o total mensal no cabeçalho.
- [ ] **C4** Lista as rendas recorrentes com o total mensal.
- [ ] **C5** Parcelamento quitado sai da lista.

## Investimento

- [ ] **I1** Meta zero não mostra o card de investimento na tela do mês.
- [ ] **I2** Definir meta de R$ 2.000 no perfil faz o card aparecer.
- [ ] **I3** Despesa marcada como investimento **não** entra em "Saídas".
- [ ] **I4** Investimento pago soma em "investido"; pendente conta só no previsto.
- [ ] **I5** O card mostra o quanto falta para a meta e a porcentagem.
- [ ] **I6** Com a sobra do mês maior que a meta, o app diz que a sobra cobre.
- [ ] **I7** Com a sobra menor, diz que não cobre, em vermelho.
- [ ] **I8** Meta batida troca o texto por "Meta batida este mês".
- [ ] **I9** No escopo "Todos", as metas dos perfis somam.
- [ ] **I10** O modo "Investir" da tela rápida grava com o flag certo.
- [ ] **I11** Trocar o lançamento para Receita desliga o toggle de investimento.

## Lançamento rápido e widget

- [ ] **W1** O widget aparece na lista de widgets do Android.
- [ ] **W2** Os três botões abrem a tela rápida com o tipo já escolhido.
- [ ] **W3** A tela rápida salva com dois toques depois de digitar o valor.
- [ ] **W4** A observação vira a descrição; vazia, usa um rótulo padrão.
- [ ] **W5** O atalho leva ao formulário completo mantendo nada digitado.

## Backup automático

- [ ] **B1** Escolher a pasta grava um backup na hora.
- [ ] **B2** Reabrir o app depois de 12h grava um novo.
- [ ] **B3** Reabrir antes de 12h não grava.
- [ ] **B4** Só os 7 backups mais recentes ficam na pasta.
- [ ] **B5** Desinstalar o app **não** apaga os backups da pasta escolhida.
- [ ] **B6** Pasta inacessível não quebra a abertura do app.

## Migração

- [ ] **G1** Banco v1 com dados migra para v2 sem perder linha.
- [ ] **G2** Colunas novas entram com zero nos registros antigos.
- [ ] **G3** Rodar a migração duas vezes não quebra.
- [ ] **G4** Backup exportado na v2 importa de volta com os campos novos.

## Trava

- [ ] **T1** Definir PIN pede confirmação e rejeita se as duas digitações diferirem.
- [ ] **T2** Com PIN ativo, abrir o app exige desbloqueio.
- [ ] **T3** Biometria dispara sozinha quando habilitada, com o PIN como alternativa.
- [ ] **T4** PIN errado treme, limpa e conta a tentativa.
- [ ] **T5** Na 5ª tentativa errada, entra em espera com contagem regressiva.
- [ ] **T6** Voltar do background em menos de 60s não pede desbloqueio.
- [ ] **T7** Voltar depois de 60s pede.
- [ ] **T8** Remover o PIN pede o PIN atual.
- [ ] **T9** O PIN sobrevive a fechar e reabrir o app.

## Dados

- [ ] **D1** Os dados sobrevivem a fechar e reabrir o app.
- [ ] **D2** Exportar gera JSON com tudo e abre o share sheet.
- [ ] **D3** Importar restaura o estado do backup, com confirmação antes.
- [ ] **D4** Importar backup de versão desconhecida é recusado com mensagem.
- [ ] **D5** Nenhum valor monetário sofre erro de arredondamento (tudo em centavos).

## Temas

- [ ] **A1** Trocar o tema muda a tela na hora, sem reiniciar.
- [ ] **A2** O tema escolhido sobrevive a fechar e reabrir o app.
- [ ] **A3** No tema claro, as barras do Android ficam com ícones escuros.
- [ ] **A4** Nenhuma tela mantém cor presa do tema anterior.
- [ ] **A5** Todo texto passa de 4,5:1 de contraste sobre o fundo dele.

## Boot

- [ ] **O1** App com banco da v1, v2 ou v3 abre sem erro e com os dados.
- [ ] **O2** Instalação nova abre no onboarding.
- [ ] **O3** Falha no boot mostra tela de erro com o motivo, não spinner infinito.
- [ ] **O4** "Tentar de novo" refaz o boot sem fechar o app.

## Divisão de conta

- [ ] **S1** O botão da câmera no widget abre o app na câmera.
- [ ] **S2** QR de NFC-e preenche o total automaticamente.
- [ ] **S3** Sem QR, dá para digitar o valor e seguir.
- [ ] **S4** Adicionar apelidos divide a conta igualmente entre eles.
- [ ] **S5** Dividir R$ 100 entre 3 não perde centavo.
- [ ] **S6** Só a sua parte é lançada como despesa.
- [ ] **S7** O que os outros devem **não** entra como receita prevista.
- [ ] **S8** Remover um participante recalcula as partes na hora.

## Qualidade

- [ ] **Q1** `npx tsc --noEmit` passa sem erro.
- [ ] **Q2** `npm test` passa, cobrindo materialização, `clampDay` e saldos.
- [ ] **Q3** O app roda no Expo Go (o widget, sendo nativo, só no APK compilado).
- [ ] **Q6** `expo prebuild --clean` seguido de build gera APK assinado com a
      keystore de release, não com a de debug.
- [ ] **Q4** A aba Mês responde em menos de 100ms com 500 ocorrências no mês.
- [ ] **Q5** Nenhum aviso de chave duplicada ou update fora de ciclo no console.
