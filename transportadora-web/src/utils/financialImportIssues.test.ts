import { describe, expect, it } from 'vitest';
import { ImportRow } from './financialImport';
import { financialImportIssues } from './financialImportIssues';

function row(changes: Partial<ImportRow> = {}): ImportRow {
  return {
    linha: 2, chaveExterna: 'ctrc:12345', data: '2026-10-09', placa: 'NSC1I98', peso: '32500', valor: '4850',
    motoristaExterno: { codigo: '1', nome: 'João' }, clienteExterno: { codigo: '2', nome: 'Cliente' },
    cavalo: { id: 'horse-1', placa: 'NSC1I98' }, conjunto: { id: 'set-7', nome: 'Bitrem' },
    motorista: { id: 'driver-1', nome: 'João' }, cliente: { id: 'client-1', nome: 'Cliente' },
    sugestoesMotorista: [], sugestoesCliente: [], quantidadeEixos: 7, comissaoNecessaria: true,
    comissao: { tipoComissao: 'PERCENTUAL', percentualComissao: 12 }, status: 'PENDENTE_COMPOSICAO', pendencias: [],
    ...changes,
  };
}

describe('orientações para resolver linhas da importação', () => {
  it.each(['PRONTO', 'DUPLICADO', 'DUPLICADO_ARQUIVO'])('não cria problemas para uma linha %s', (status) => {
    expect(financialImportIssues(row({ status, conjunto: null, quantidadeEixos: null }))).toEqual([]);
  });

  it.each([
    { placa: 'NSC1I98', data: '2026-10-11', dia: '11/10/2026', motivo: 'Sem histórico operacional suficiente' },
    { placa: 'NSC1I98', data: '2026-10-09', dia: '09/10/2026', motivo: 'Sem histórico operacional suficiente' },
    { placa: 'GEM8J07', data: '2026-10-09', dia: '09/10/2026', motivo: 'Composição ambígua: períodos sobrepostos' },
  ])('explica as carretas não confirmadas em $placa / $dia sem depender do texto técnico', ({ placa, data, dia, motivo }) => {
    const issues = financialImportIssues(row({ placa, data, cavalo: { id: 'horse-1', placa }, conjunto: null, quantidadeEixos: null, pendencias: [motivo] }));
    expect(issues).toHaveLength(1);
    const issue = issues[0];
    expect(issue).toMatchObject({ code: 'COMPOSICAO', title: 'Confira as carretas usadas nesta data', actionLabel: 'Conferir histórico do cavalo' });
    expect(issue.summary).toContain(placa);
    expect(issue.summary).toContain(dia);
    expect(issue.summary).toContain('eixos e a comissão');
    expect(issue.steps[0]).toContain('Ver histórico do cavalo');
    expect(issue.steps[1]).toContain('responsável pela frota');
    expect(issue.steps[1]).toContain('Mudar apenas o cadastro atual não comprova');
    expect(issue.steps[2]).toContain('Atualizar prévia');
    expect(issue.steps[2]).toContain('Escolher uma comissão não resolve');
  });

  it('mantém a associação prioritária e também revela histórico não confirmado', () => {
    const issues = financialImportIssues(row({ status: 'PENDENTE_MOTORISTA', motorista: null, conjunto: null, quantidadeEixos: null, comissao: {} }));
    expect(issues.map((issue) => issue.code)).toEqual(['MOTORISTA', 'COMPOSICAO']);
    expect(issues[0].actionLabel).toBe('Conferir associações');
    expect(issues[0].steps.join(' ')).toContain('cadastros existentes');
    expect(issues.some((issue) => issue.code === 'COMISSAO')).toBe(false);
  });

  it('orienta a associação de cliente e a atualização da prévia na própria linha', () => {
    const issues = financialImportIssues(row({ status: 'PENDENTE_CLIENTE', cliente: null }));
    expect(issues.map((issue) => issue.code)).toEqual(['CLIENTE']);
    expect(issues[0].summary).toContain('Cliente');
    expect(issues[0].steps.join(' ')).toContain('No campo Cliente / pagador desta linha');
    expect(issues[0].steps.join(' ')).toContain('Atualizar prévia');
  });

  it('primeiro associa o cavalo e não diagnostica histórico ausente sem cavalo identificado', () => {
    const issues = financialImportIssues(row({ status: 'PLACA_NAO_ENCONTRADA', cavalo: null, conjunto: null, quantidadeEixos: null }));
    expect(issues.map((issue) => issue.code)).toEqual(['CAVALO']);
    expect(issues[0].summary).toContain('NSC1I98');
    expect(issues[0].steps.join(' ')).toContain('No campo Cavalo mecânico desta linha');
    expect(issues[0].steps.join(' ')).toContain('Atualizar prévia');
  });

  it.each([null, '', '2026-02-30', '2026-10-09T00:00:00Z'])('corrige data inválida %s antes de orientar revisão da frota', (data) => {
    const issues = financialImportIssues(row({ data, conjunto: null, quantidadeEixos: null }));
    expect(issues.map((issue) => issue.code)).toEqual(['PLANILHA']);
    expect(issues[0].summary).toContain('data do faturamento');
    expect(issues[0].steps.join(' ')).toContain('planilha original');
    expect(issues[0].steps.join(' ')).toContain('Conferir planilha');
  });

  it('prioriza correções da planilha sem esconder outro bloqueio confirmado pelos metadados', () => {
    const issues = financialImportIssues(row({ status: 'DADOS_INVALIDOS', conjunto: null, quantidadeEixos: null }));
    expect(issues.map((issue) => issue.code)).toEqual(['PLANILHA', 'COMPOSICAO']);
    expect(issues[0].actionLabel).toBe('Corrigir planilha');
  });

  it('orienta conflito sem propor sobrescrita, nova chave ou reenvio modificado', () => {
    const issues = financialImportIssues(row({ status: 'CONFLITO' }));
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ code: 'CONFLITO', actionLabel: 'Revisar conflito' });
    expect(issues[0].steps.join(' ')).toContain('responsável financeiro');
    expect(issues[0].steps.join(' ')).toContain('lançamento existente será preservado');
    expect(issues[0].steps.join(' ')).toContain('Não altere a chave ou o CTRC');
    expect(issues[0].steps.join(' ')).toContain('não reenvie o mesmo CTRC com dados modificados');
  });

  it.each([4, 7, 9])('pede tipo e valor da comissão somente após confirmar histórico de %s eixos', (quantidadeEixos) => {
    const issues = financialImportIssues(row({ status: 'PENDENTE_COMISSAO', quantidadeEixos, comissao: {} }));
    expect(issues.map((issue) => issue.code)).toEqual(['COMISSAO']);
    expect(issues[0].actionLabel).toBe('Informar comissão');
    expect(issues[0].steps.join(' ')).toContain('percentual ou por viagem');
    expect(issues[0].steps.join(' ')).toContain('valor positivo');
    expect(issues[0].steps.join(' ')).toContain('Atualizar prévia');
  });

  it('revela valor de comissão inválido mesmo quando falta também associar o motorista', () => {
    const issues = financialImportIssues(row({ status: 'PENDENTE_MOTORISTA', motorista: null, comissao: { tipoComissao: 'PERCENTUAL', percentualComissao: 101 } }));
    expect(issues.map((issue) => issue.code)).toEqual(['MOTORISTA', 'COMISSAO']);
  });

  it('não pede comissão para composição confirmada fora da regra ou com histórico ausente', () => {
    const outside = financialImportIssues(row({ status: 'PENDENTE_MOTORISTA', motorista: null, quantidadeEixos: 6, comissaoNecessaria: false, comissao: {} }));
    expect(outside.map((issue) => issue.code)).toEqual(['MOTORISTA']);
    const missing = financialImportIssues(row({ status: 'PENDENTE_COMISSAO', conjunto: null, quantidadeEixos: null, comissao: {} }));
    expect(missing.map((issue) => issue.code)).toEqual(['COMPOSICAO']);
  });

  it('usa orientação segura para status desconhecido e não altera a linha original', () => {
    const original = row({ status: 'NOVO_STATUS', conjunto: null, quantidadeEixos: null });
    const before = structuredClone(original);
    const issues = financialImportIssues(original);
    expect(issues).toHaveLength(1);
    expect(issues[0].code).toBe('DESCONHECIDO');
    expect(issues[0].steps.join(' ')).toContain('responsável financeiro');
    expect(original).toEqual(before);
  });
});
