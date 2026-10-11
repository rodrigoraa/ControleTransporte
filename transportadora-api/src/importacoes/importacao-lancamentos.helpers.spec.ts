import { BadRequestException } from '@nestjs/common';
import { candidatosNome, hashDadosImportacao, identificadorPessoaExterna, normalizarNomeImportacao, validarOpcoesImportacao } from './importacao-lancamentos.helpers';

describe('Associações e confirmação da importação', () => {
  const pessoas = [{ id: 'a', nome: 'GLEISON PEREIRA' }, { id: 'b', nome: 'João da Silva' }];

  it('normaliza acentos, caixa e espaços exclusivamente para comparação', () => {
    expect(normalizarNomeImportacao('  joÃO   da silva ')).toBe('JOAO DA SILVA');
    expect(candidatosNome('JOAO DA SILVA', pessoas).exato).toEqual(pessoas[1]);
    expect(pessoas[1].nome).toBe('João da Silva');
  });

  it('sugere Gleison para Gleisson sem escolher silenciosamente', () => {
    const result = candidatosNome('GLEISSON PEREIRA', pessoas);
    expect(result.exato).toBeNull();
    expect(result.sugestoes).toContainEqual(pessoas[0]);
  });

  it('mantém nomes exatos ambíguos pendentes', () => {
    const result = candidatosNome('Joao da Silva', [...pessoas, { id: 'c', nome: 'JOÃO DA SILVA' }]);
    expect(result.exato).toBeNull();
    expect(result.sugestoes.map((item) => item.id)).toEqual(['b', 'c']);
  });

  it('não propõe pessoas sem semelhança e limita sugestões', () => {
    expect(candidatosNome('EMPRESA TRANSPORTE', pessoas).sugestoes).toEqual([]);
    const candidatos = Array.from({ length: 10 }, (_, index) => ({ id: String(index), nome: 'GLEISSON PEREIRA ' + index }));
    expect(candidatosNome('GLEISSON PEREIRA', candidatos).sugestoes).toHaveLength(5);
    expect(candidatosNome('A'.repeat(10_000), pessoas)).toEqual({ exato: null, sugestoes: [] });
  });

  it('identifica pelo código e usa chave de nome estável quando o código não existe', () => {
    expect(identificadorPessoaExterna({ codigo: '1031', nome: 'GLEISSON PEREIRA' })).toBe('1031');
    expect(identificadorPessoaExterna({ codigo: null, nome: '  JoÃO  da silva ' })).toBe('nome:JOAO DA SILVA');
  });

  const linha = {
    chaveExterna: 'ctrc:123', data: '2026-10-08', placa: 'QAX2H51', peso: '32500', valor: '4850',
    motoristaExterno: { codigo: '1031', nome: 'João da Silva' }, clienteExterno: { codigo: '929', nome: 'Empresa A' },
  };

  it('fingerprint não depende de nomes com diferenças seguras nem campos técnicos irrelevantes', () => {
    expect(hashDadosImportacao(linha)).toBe(hashDadosImportacao({ ...linha, motoristaExterno: { codigo: '1031', nome: '  JOAO  DA SILVA ' } }));
    expect(hashDadosImportacao({ ...linha, valor: '4850.01' })).not.toBe(hashDadosImportacao(linha));
    expect(hashDadosImportacao({ ...linha, data: '2026-10-09' })).not.toBe(hashDadosImportacao(linha));
    expect(hashDadosImportacao({ ...linha, motoristaExterno: { ...linha.motoristaExterno, codigo: '1032' } })).not.toBe(hashDadosImportacao(linha));
  });

  it('aceita opções explicitamente válidas sem escolher comissão', () => {
    expect(validarOpcoesImportacao(undefined)).toEqual({});
    const validas = { hashArquivo: 'a'.repeat(64), linhasSelecionadas: [2, 3], selecoes: [{ linha: 2, motoristaId: 'a', clienteId: 'b', tipoComissao: 'PERCENTUAL', percentualComissao: 11.25, descontoImpostos: false }] };
    expect(validarOpcoesImportacao(validas, true)).toEqual(validas);
  });

  it.each([
    [null], [[]], [{ hashArquivo: 'alterado' }], [{ linhasSelecionadas: [] }],
    [{ hashArquivo: 'a'.repeat(64), linhasSelecionadas: [2, 2] }],
    [{ hashArquivo: 'a'.repeat(64), linhasSelecionadas: [-2] }],
    [{ hashArquivo: 'a'.repeat(64), linhasSelecionadas: [2.5] }],
    [{ hashArquivo: 'a'.repeat(64), linhasSelecionadas: [2], origem: 'outra' }],
  ])('rejeita confirmação com opções inválidas: %j', (input) => {
    expect(() => validarOpcoesImportacao(input, true)).toThrow(BadRequestException);
  });

  it.each([
    [{ linha: 2, motoristaId: '' }], [{ linha: 2, clienteId: 123 }], [{ linha: 2, cavaloMecanicoId: 'a'.repeat(129) }],
    [{ linha: 2, tipoComissao: 'INVENTADA' }], [{ linha: 2, percentualComissao: 101 }], [{ linha: 2, percentualComissao: 0 }],
    [{ linha: 2, valorComissaoPorViagem: -1 }], [{ linha: 2, valorComissaoPorViagem: Infinity }],
    [{ linha: 2, valorComissaoPorViagem: 240.001 }], [{ linha: 2, descontoImpostos: 'false' }],
    [{ linha: 2, valorTotal: 1 }], [{ linha: '2' }],
  ])('rejeita associação forjada ou comissão inválida: %j', (selection) => {
    expect(() => validarOpcoesImportacao({ selecoes: [selection] })).toThrow(BadRequestException);
  });

  it('rejeita associações repetidas e lotes maiores que o limite', () => {
    expect(() => validarOpcoesImportacao({ selecoes: [{ linha: 2 }, { linha: 2 }] })).toThrow(BadRequestException);
    expect(() => validarOpcoesImportacao({ linhasSelecionadas: Array.from({ length: 1001 }, (_, index) => index + 1) })).toThrow(BadRequestException);
  });
});
