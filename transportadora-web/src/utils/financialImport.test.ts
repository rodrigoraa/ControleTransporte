import { describe, expect, it } from 'vitest';
import { applyImportCommission, buildImportFormData, canConfirmImport, canEditImportRow, canSelectImportRow, confirmedImportLines, financialImportStatus, financialImportVisible, importCalendarDate, importCommissionForType, importEntityOptions, importFileError, ImportRow, selectImportHorse } from './financialImport';

const row = (linha: number, changes: Partial<ImportRow> = {}): ImportRow => ({
  linha, chaveExterna: `ctrc:${linha}`, data: '2026-10-08', placa: 'QAX2H51', peso: '32500', valor: '4850.00',
  motoristaExterno: { codigo: '1031', nome: 'GLEISSON PEREIRA' }, clienteExterno: { codigo: '929', nome: 'EMPRESA EXEMPLO' },
  cavalo: { id: 'cavalo-1', placa: 'QAX2H51' }, motorista: { id: 'motorista-1', nome: 'GLEISON PEREIRA' }, cliente: { id: 'cliente-1', nome: 'EMPRESA EXEMPLO' },
  sugestoesMotorista: [], sugestoesCliente: [], quantidadeEixos: 7, comissaoNecessaria: true, comissao: {}, status: 'PRONTO', pendencias: [], ...changes,
});

describe('importação financeira no frontend', () => {
  it('exibe a importação somente para Admin no faturamento com escrita habilitada', () => {
    expect(financialImportVisible({ path: 'faturamento' }, 'ADMIN')).toBe(true);
    expect(financialImportVisible({ path: 'faturamento' }, 'USUARIO')).toBe(false);
    expect(financialImportVisible({ path: 'faturamento' })).toBe(false);
    expect(financialImportVisible({ path: 'despesas' }, 'ADMIN')).toBe(false);
    expect(financialImportVisible({ path: 'caminhoes' }, 'ADMIN')).toBe(false);
    expect(financialImportVisible({ path: 'faturamento', readOnly: true }, 'ADMIN')).toBe(false);
  });

  it('aceita Excel legado e moderno e rejeita arquivo vazio ou outra extensão', () => {
    expect(importFileError({ name: 'relatorio.xls', size: 1024 })).toBe('');
    expect(importFileError({ name: 'relatorio.XLSX', size: 1024 })).toBe('');
    expect(importFileError({ name: 'relatorio.csv', size: 1024 })).toContain('.xls ou .xlsx');
    expect(importFileError({ name: 'relatorio.xls.exe', size: 1024 })).toContain('.xls ou .xlsx');
    expect(importFileError({ name: 'relatorio.xls', size: 0 })).toContain('vazia');
  });

  it('apresenta a data calendário sem conversão de timezone e sinaliza data ausente', () => {
    expect(importCalendarDate('2026-10-08')).toBe('08/10/2026');
    expect(importCalendarDate(null)).toBe('-');
    expect(importCalendarDate('')).toBe('-');
  });

  it('permite resolver pendências mas impede selecionar conflitos e linhas inválidas ou duplicadas', () => {
    for (const status of ['PRONTO', 'PENDENTE_MOTORISTA', 'PENDENTE_CLIENTE', 'PENDENTE_COMISSAO', 'PLACA_NAO_ENCONTRADA']) expect(canSelectImportRow({ status })).toBe(true);
    for (const status of ['DUPLICADO', 'DUPLICADO_ARQUIVO', 'DADOS_INVALIDOS', 'CONFLITO', 'DESCONHECIDO']) expect(canSelectImportRow({ status })).toBe(false);
    expect(financialImportStatus('DUPLICADO')).toBe('Já importado');
    expect(financialImportStatus('CONFLITO')).toContain('Conflito');
    expect(canEditImportRow({ status: 'CONFLITO' })).toBe(true);
    expect(canEditImportRow({ status: 'DUPLICADO' })).toBe(false);
  });

  it('confirma apenas o subconjunto pronto e exige atualizar a prévia após uma alteração', () => {
    const rows = [row(2), row(3, { status: 'PENDENTE_MOTORISTA' })];
    expect(canConfirmImport(rows, [2], false)).toBe(true);
    expect(canConfirmImport(rows, [2], true)).toBe(false);
    expect(canConfirmImport(rows, [2, 3], false)).toBe(false);
    expect(canConfirmImport(rows, [], false)).toBe(false);
    expect(canConfirmImport(rows, [20], false)).toBe(false);
    expect(canConfirmImport(rows, [2, 2], false)).toBe(false);
  });

  it('inclui duplicadas para contabilizar ignoradas sem incluir pendências, conflitos ou prontas desmarcadas', () => {
    const rows = [row(2), row(3, { status: 'DUPLICADO' }), row(4, { status: 'DUPLICADO_ARQUIVO' }), row(5, { status: 'CONFLITO' }), row(6, { status: 'PENDENTE_CLIENTE' }), row(7)];
    expect(confirmedImportLines(rows, [2])).toEqual([2, 3, 4]);
    expect(confirmedImportLines(rows, [2, 3])).toEqual([2, 3, 4]);
  });

  it('permite concluir conferência de um arquivo completamente duplicado sem novos lançamentos', () => {
    const rows = [row(2, { status: 'DUPLICADO' }), row(3, { status: 'DUPLICADO_ARQUIVO' })];
    expect(canConfirmImport(rows, [], false)).toBe(true);
    expect(confirmedImportLines(rows, [])).toEqual([2, 3]);
    expect(canConfirmImport([], [], false)).toBe(false);
    expect(canConfirmImport([...rows, row(4, { status: 'CONFLITO' })], [], false)).toBe(false);
  });

  it('mostra sugestões de nomes sem escolher automaticamente uma associação', () => {
    const suggestion = { id: 'motorista-1', nome: 'GLEISON PEREIRA' };
    const other = { id: 'motorista-2', nome: 'OUTRO MOTORISTA' };
    const options = importEntityOptions([other, suggestion], [suggestion]);
    expect(options).toEqual([{ value: suggestion.id, label: 'GLEISON PEREIRA (sugestão)' }, { value: other.id, label: other.nome }]);
    expect(options).not.toHaveProperty('selected');
    expect(importEntityOptions([], [], other)).toEqual([{ value: other.id, label: other.nome }]);
  });

  it.each([
    [4, 12, 240], [7, 12, 240], [9, 11, 330],
  ])('usa os padrões manuais de %i eixos somente após escolha explícita do tipo', (axles, percentage, perTrip) => {
    const commission = importCommissionForType(axles, 'PERCENTUAL');
    expect(commission).toMatchObject({ tipoComissao: 'PERCENTUAL', percentualComissao: percentage, valorComissaoPorViagem: perTrip });
    expect(importCommissionForType(axles, 'POR_VIAGEM', { percentualComissao: 15, valorComissaoPorViagem: 500, descontoImpostos: true })).toMatchObject({ tipoComissao: 'POR_VIAGEM', percentualComissao: 15, valorComissaoPorViagem: 500, descontoImpostos: true });
  });

  it('aplica comissão em lote conforme os eixos, preservando associações e linhas não selecionadas', () => {
    const rows = [row(2), row(3, { quantidadeEixos: 9 }), row(4, { quantidadeEixos: 6, comissaoNecessaria: false }), row(5)];
    const selections = { 2: { linha: 2, motoristaId: 'motorista-escolhido' }, 5: { linha: 5, clienteId: 'cliente-escolhido' } };
    const applied = applyImportCommission(rows, [2, 3, 4], selections, { tipoComissao: 'POR_VIAGEM', descontoImpostos: true });
    expect(applied[2]).toMatchObject({ motoristaId: 'motorista-escolhido', valorComissaoPorViagem: 240, descontoImpostos: true });
    expect(applied[3]).toMatchObject({ valorComissaoPorViagem: 330, percentualComissao: 11 });
    expect(applied[4]).toBeUndefined();
    expect(applied[5]).toEqual(selections[5]);
    expect(selections[2]).not.toHaveProperty('tipoComissao');
  });

  it('não aplica comissão sem tipo escolhido, em duplicadas ou usando eixos anteriores à troca de cavalo', () => {
    const rows = [row(2), row(3, { status: 'DUPLICADO' })];
    expect(applyImportCommission(rows, [2], {}, {})).toEqual({});
    const selections = { 2: { linha: 2, cavaloMecanicoId: 'outro-cavalo' } };
    expect(applyImportCommission(rows, [2, 3], selections, { tipoComissao: 'PERCENTUAL' })).toEqual(selections);
  });

  it('preserva valores explícitos inválidos para serem rejeitados, em vez de substituí-los por padrão', () => {
    expect(importCommissionForType(7, 'PERCENTUAL', { percentualComissao: 0 }).percentualComissao).toBe(0);
    expect(importCommissionForType(6, 'POR_VIAGEM').valorComissaoPorViagem).toBeUndefined();
  });

  it('ao trocar o cavalo exige escolher novamente a comissão, preservando associações de pessoas', () => {
    const selection = { linha: 2, motoristaId: 'motorista-1', clienteId: 'cliente-1', tipoComissao: 'POR_VIAGEM' as const, valorComissaoPorViagem: 240, percentualComissao: 12, descontoImpostos: true };
    const changed = selectImportHorse(row(2), selection, 'cavalo-9-eixos');
    expect(changed).toMatchObject({ motoristaId: 'motorista-1', clienteId: 'cliente-1', cavaloMecanicoId: 'cavalo-9-eixos', descontoImpostos: true });
    expect(changed.tipoComissao).toBeUndefined();
    expect(changed.percentualComissao).toBeUndefined();
    expect(changed.valorComissaoPorViagem).toBeUndefined();
    expect(selectImportHorse(row(2), selection, 'cavalo-1')).toMatchObject({ tipoComissao: 'POR_VIAGEM', valorComissaoPorViagem: 240 });
  });

  it('reenvia o arquivo original, hash, associações explícitas e linhas selecionadas em multipart', async () => {
    const file = new File(['arquivo original'], 'relatorio.xls', { type: 'application/vnd.ms-excel' });
    const options = { hashArquivo: 'a'.repeat(64), linhasSelecionadas: [2], selecoes: [{ linha: 2, motoristaId: 'motorista-1', tipoComissao: 'PERCENTUAL' as const, percentualComissao: 12 }] };
    const body = buildImportFormData(file, options);
    expect(JSON.parse(String(body.get('opcoes')))).toEqual(options);
    const uploaded = body.get('arquivo') as File;
    expect(uploaded.name).toBe('relatorio.xls');
    expect(await uploaded.text()).toBe('arquivo original');
    expect([...body.keys()]).toEqual(['opcoes', 'arquivo']);
  });
});
