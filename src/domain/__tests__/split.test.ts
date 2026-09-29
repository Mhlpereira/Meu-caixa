import {
  describeSplit,
  myShare,
  owedByOthers,
  parseReceiptCode,
  shareFor,
  splitEqually,
  type Participant,
} from '../split';

const me: Participant = { id: 'me', name: 'Eu', isMe: true };
const person = (id: string, name: string): Participant => ({ id, name, isMe: false });

describe('splitEqually', () => {
  it('divide exato quando dá', () => {
    expect(splitEqually(64_000, 8)).toEqual(Array(8).fill(8_000));
  });

  it('não perde centavo na divisão inexata', () => {
    const parts = splitEqually(10_000, 3);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(10_000);
    expect(parts).toEqual([3_334, 3_333, 3_333]);
  });

  it('a sobra vai para o primeiro', () => {
    expect(splitEqually(10_001, 2)).toEqual([5_001, 5_000]);
  });

  it('uma pessoa fica com tudo', () => {
    expect(splitEqually(64_000, 1)).toEqual([64_000]);
  });

  it('zero pessoas devolve lista vazia', () => {
    expect(splitEqually(64_000, 0)).toEqual([]);
  });
});

describe('shareFor', () => {
  const group = [me, person('a', 'Thiago'), person('b', 'Alana'), person('c', 'Rafa')];

  it('minha parte é o total dividido pelo grupo', () => {
    const shares = shareFor(64_000, group);
    expect(myShare(shares)).toBe(16_000);
  });

  it('o resto é o que os outros devem', () => {
    const shares = shareFor(64_000, group);
    expect(owedByOthers(shares)).toBe(48_000);
  });

  it('minha parte mais a dos outros fecha o total', () => {
    const shares = shareFor(10_000, group);
    expect(myShare(shares) + owedByOthers(shares)).toBe(10_000);
  });

  it('sozinho, a conta inteira é minha', () => {
    const shares = shareFor(17_990, [me]);
    expect(myShare(shares)).toBe(17_990);
    expect(owedByOthers(shares)).toBe(0);
  });
});

describe('describeSplit', () => {
  it('lista os outros participantes', () => {
    const shares = shareFor(64_000, [me, person('a', 'Thiago'), person('b', 'Alana')]);
    expect(describeSplit(shares)).toBe('Dividido com Thiago, Alana');
  });

  it('sozinho não descreve divisão', () => {
    expect(describeSplit(shareFor(1_000, [me]))).toBe('');
  });
});

describe('parseReceiptCode', () => {
  it('extrai a chave de acesso de 44 dígitos', () => {
    const url =
      'https://www.fazenda.pr.gov.br/nfce/qrcode?p=41210812345678000190650010000012341000012345|2|1|1|abcdef';
    expect(parseReceiptCode(url).accessKey).toBe('41210812345678000190650010000012341000012345');
  });

  it('lê o total quando o QR traz vNF', () => {
    const url =
      'https://sefaz.x/qrcode?p=41210812345678000190650010000012341000012345|1|1|1|20260929|640.00|0.00|abc|1|hash';
    const scan = parseReceiptCode(url);
    expect(scan.total).toBe(64_000);
  });

  it('não inventa total quando o QR não tem', () => {
    const url = 'https://sefaz.x/qrcode?p=41210812345678000190650010000012341000012345|2|1|1|hash';
    expect(parseReceiptCode(url).total).toBeNull();
  });

  it('devolve nulo para código que não é nota fiscal', () => {
    const scan = parseReceiptCode('https://exemplo.com/algo');
    expect(scan.accessKey).toBeNull();
    expect(scan.total).toBeNull();
  });

  it('guarda o texto original para diagnóstico', () => {
    expect(parseReceiptCode('qualquer coisa').raw).toBe('qualquer coisa');
  });
});
