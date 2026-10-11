import { BadRequestException, PayloadTooLargeException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import { EventEmitter } from 'node:events';
import * as workerThreads from 'node:worker_threads';
import * as XLSX from 'xlsx';
import { ArquivoImportacao, PlanilhaLancamentosParser } from './planilha-lancamentos.parser';

const headers = ['dt_emissao', 'ds_placa', 'vl_peso', 'nm_pessoa_motorista', 'nm_pagador', 'vl_total', 'cd_ctrc'];
const row = ['08/10/2026', 'qax-2h51', '32.500', '1031 / EDSON GONCALVES', '929 / EMPRESA EXEMPLO', '4.850,00', '12345'];
function spreadsheet(rows: unknown[][] = [headers, row], bookType: XLSX.BookType = 'xlsx', date1904 = false): ArquivoImportacao {
  const workbook = XLSX.utils.book_new();
  workbook.Workbook = { WBProps: { date1904 } };
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), 'Exportação');
  const extension = bookType === 'xlsx' ? 'xlsx' : 'xls';
  return { nome: 'relatorio.' + extension, mimeType: extension === 'xlsx' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'application/vnd.ms-excel', buffer: XLSX.write(workbook, { type: 'buffer', bookType }) };
}

describe('PlanilhaLancamentosParser', () => {
  const parser = new PlanilhaLancamentosParser(new ConfigService());

  it.each(['xlsx', 'biff8', 'html', 'xlml'] as XLSX.BookType[])('lê diretamente formato %s e mapeia os dados sem multiplicar peso pelo valor', async (bookType) => {
    const arquivo = spreadsheet(undefined, bookType);
    const resultado = await parser.parse(arquivo);
    expect(resultado.hashArquivo).toBe(createHash('sha256').update(arquivo.buffer).digest('hex'));
    expect(resultado.arquivo).toBe(arquivo.nome);
    expect(resultado.linhas).toHaveLength(1);
    expect(resultado.linhas[0]).toMatchObject({
      linha: 2, chaveExterna: 'ctrc:12345', data: '2026-10-08', placa: 'QAX2H51',
      peso: '32500', valor: '4850',
      motoristaExterno: { codigo: '1031', nome: 'EDSON GONCALVES' },
      clienteExterno: { codigo: '929', nome: 'EMPRESA EXEMPLO' }, erros: [],
    });
    expect(resultado.linhas[0].dadosOriginais.vl_total).toBe('4.850,00');
  });

  it('mantém a linha física com linhas vazias/título e aceita cabeçalhos sem renomear o arquivo', async () => {
    const resultado = await parser.parse(spreadsheet([['Exportação CTRC'], [], headers.map((name) => ' ' + name.toUpperCase() + ' '), [], row]));
    expect(resultado.linhas[0].linha).toBe(5);
    expect(resultado.linhas[0].erros).toEqual([]);
  });

  it('usa a chave alternativa completa quando cd_ctrc estiver vazio ou ausente', async () => {
    const resultado = await parser.parse(spreadsheet([
      [...headers.slice(0, 6), 'cd_pessoa_filial', 'ds_serie', 'nr_ctrc'],
      [...row.slice(0, 6), 12, 'A', '00123'],
    ]));
    expect(resultado.linhas[0].chaveExterna).toBe('documento:["12","A","00123"]');
  });

  it('recusa linha sem identidade estável, sem placa, sem motorista ou pagador', async () => {
    const resultado = await parser.parse(spreadsheet([headers, ['08/10/2026', '', 20, '', '', 100, '']]));
    expect(resultado.linhas[0]).toMatchObject({ chaveExterna: null, placa: null });
    expect(resultado.linhas[0].erros).toHaveLength(4);
  });

  it.each([
    [4850, '4850'], ['4850,00', '4850'], ['4.850,00', '4850'], ['R$ 4.850,50', '4850.5'], ['4850.75', '4850.75'],
  ])('interpreta valor %s sem perda de casas decimais', async (valor, esperado) => {
    const resultado = await parser.parse(spreadsheet([headers, [...row.slice(0, 5), valor, '12345']]));
    expect(resultado.linhas[0].valor).toBe(esperado);
  });

  it.each([
    [0, 100], [-1, 100], ['20,0001', 100], [10, '12,345'], [10, 0], [10, -1], ['1e3', 10],
    [1_000_000_000, 100], [10, 1_000_000_000_000], [10, '4.85,00'],
  ])('marca como inválidos peso %s/valor %s sem arredondar', async (peso, valor) => {
    const resultado = await parser.parse(spreadsheet([headers, [row[0], row[1], peso, row[3], row[4], valor, row[6]]]));
    expect(resultado.linhas[0].erros.length).toBeGreaterThan(0);
    expect(resultado.linhas[0].peso === null || resultado.linhas[0].valor === null).toBe(true);
  });

  it.each([false, true])('converte serial Excel respeitando date1904=%s e data calendário', async (date1904) => {
    const serial = (Date.UTC(2026, 9, 8) - Date.UTC(date1904 ? 1904 : 1899, date1904 ? 0 : 11, date1904 ? 1 : 30)) / 86_400_000;
    const resultado = await parser.parse(spreadsheet([headers, [serial + 0.75, ...row.slice(1)]], 'xlsx', date1904));
    expect(resultado.linhas[0].data).toBe('2026-10-08');
  });

  it('conserva o dia informado em data ISO com timezone', async () => {
    const resultado = await parser.parse(spreadsheet([headers, ['2026-10-08T23:30:00-04:00', ...row.slice(1)]]));
    expect(resultado.linhas[0].data).toBe('2026-10-08');
  });

  it.each(['31/02/2026', '2026-13-01', '2026-02-29', 60])('rejeita data inválida %s', async (data) => {
    const resultado = await parser.parse(spreadsheet([headers, [data, ...row.slice(1)]]));
    expect(resultado.linhas[0].data).toBeNull();
    expect(resultado.linhas[0].erros).toContain('Data de emissão inválida.');
  });

  it('preserva nomes sem código externo e sanitiza o nome do arquivo', async () => {
    const arquivo = spreadsheet([headers, [row[0], row[1], row[2], 'GLEISSON PEREIRA', 'EMPRESA EXEMPLO', row[5], row[6]]]);
    arquivo.nome = '../pasta\\relatorio<cliente>.xlsx';
    const resultado = await parser.parse(arquivo);
    expect(resultado.arquivo).toBe('relatorio_cliente_.xlsx');
    expect(resultado.linhas[0].motoristaExterno).toEqual({ codigo: null, nome: 'GLEISSON PEREIRA' });
  });

  it('explica colunas ausentes e exige cd_ctrc ou fallback completo', async () => {
    await expect(parser.parse(spreadsheet([['outro_layout'], ['qualquer']]))).rejects.toThrow(/dt_emissao.*ds_placa/);
    await expect(parser.parse(spreadsheet([headers.slice(0, 6), row.slice(0, 6)]))).rejects.toThrow(/cd_ctrc/);
  });

  it('recusa cabeçalhos duplicados e planilha sem lançamentos', async () => {
    await expect(parser.parse(spreadsheet([[...headers, 'dt_emissao'], [...row, row[0]]]))).rejects.toThrow(/repetidos/);
    await expect(parser.parse(spreadsheet([headers]))).rejects.toThrow(/não contém lançamentos/);
  });

  it('valida extensão, MIME, conteúdo e tamanho máximo', async () => {
    const arquivo = spreadsheet();
    await expect(parser.parse({ ...arquivo, nome: 'arquivo.exe' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(parser.parse({ ...arquivo, mimeType: 'application/pdf' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(parser.parse({ ...arquivo, buffer: Buffer.from('arquivo arbitrário') })).rejects.toBeInstanceOf(BadRequestException);
    const pequeno = new PlanilhaLancamentosParser(new ConfigService({ IMPORT_MAX_FILE_BYTES: 100 }));
    await expect(pequeno.parse(arquivo)).rejects.toBeInstanceOf(PayloadTooLargeException);
  });

  it('recusa CSV disfarçado de XLS e declarações XML externas', async () => {
    await expect(parser.parse({ nome: 'arquivo.xls', mimeType: 'application/vnd.ms-excel', buffer: Buffer.from(headers.join(',') + '\n' + row.join(',')) })).rejects.toThrow(/não é uma planilha Excel/);
    await expect(parser.parse({ nome: 'arquivo.xls', mimeType: 'application/xml', buffer: Buffer.from('<?xml version="1.0"?><!DOCTYPE Workbook SYSTEM "https://example.com/externo"><Workbook/>') })).rejects.toThrow(/XML não permitida/);
  });

  it('protege quantidade de linhas/colunas e tamanho ZIP descompactado', async () => {
    const muitosRegistros = Array.from({ length: 1001 }, (_, index) => [...row.slice(0, 6), String(index + 1)]);
    await expect(parser.parse(spreadsheet([headers, ...muitosRegistros]))).rejects.toThrow(/1.000 linhas/);
    const muitasColunas = [...headers, ...Array.from({ length: 250 }, (_, index) => 'extra_' + index)];
    await expect(parser.parse(spreadsheet([muitasColunas, row]))).rejects.toThrow(/256 colunas/);
    const arquivo = spreadsheet();
    const central = arquivo.buffer.indexOf(Buffer.from('504b0102', 'hex'));
    arquivo.buffer.writeUInt32LE(33 * 1024 * 1024, central + 24);
    await expect(parser.parse(arquivo)).rejects.toThrow(/32 MiB/);
  });

  it('preserva números brasileiros em exportação HTML sem tipos de células', async () => {
    const html = '<html><table>' + [headers, row].map((cells) => '<tr>' + cells.map((cell) => '<td>' + cell + '</td>').join('') + '</tr>').join('') + '</table></html>';
    const resultado = await parser.parse({ nome: 'exportacao.xls', mimeType: 'text/html', buffer: Buffer.from(html) });
    expect(resultado.linhas[0]).toMatchObject({ peso: '32500', valor: '4850', data: '2026-10-08', erros: [] });
  });

  it.each(['html', 'xlml'] as XLSX.BookType[])('aceita exportação legada %s em UTF-16 LE/BE e calcula hash dos bytes originais', async (bookType) => {
    const original = spreadsheet(undefined, bookType);
    const utf16 = Buffer.from(original.buffer.toString('utf8').replace(/encoding="UTF-8"/i, 'encoding="UTF-16"'), 'utf16le');
    for (const buffer of [Buffer.concat([Buffer.from([0xff, 0xfe]), utf16]), Buffer.concat([Buffer.from([0xfe, 0xff]), Buffer.from(utf16).swap16()])]) {
      const resultado = await parser.parse({ ...original, buffer });
      expect(resultado.hashArquivo).toBe(createHash('sha256').update(buffer).digest('hex'));
      expect(resultado.linhas[0]).toMatchObject({ data: '2026-10-08', peso: '32500', valor: '4850', erros: [] });
    }
  });

  it('lê XLSX compactado e rejeita tamanho expandido adulterado no ZIP', async () => {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([headers, row]), 'Exportação');
    const buffer: Buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx', compression: true });
    const arquivo = { ...spreadsheet(), buffer };
    expect((await parser.parse(arquivo)).linhas[0].erros).toEqual([]);
    const central = buffer.indexOf(Buffer.from('504b0102', 'hex'));
    buffer.writeUInt32LE(1, central + 24);
    await expect(parser.parse(arquivo)).rejects.toThrow(/conteúdo.*inválido/);
  });

  it('informa limites de nomes/códigos/placa sem truncar dados originais', async () => {
    const nome = 'A'.repeat(257);
    const codigo = '1'.repeat(129);
    const placa = 'Q'.repeat(257);
    const resultado = await parser.parse(spreadsheet([headers, [row[0], placa, row[2], codigo + ' / ' + nome, 'EMPRESA / COMERCIO', row[5], row[6]]]));
    expect(resultado.linhas[0].erros).toHaveLength(3);
    expect(resultado.linhas[0].motoristaExterno).toEqual({ codigo, nome });
    expect(resultado.linhas[0].clienteExterno).toEqual({ codigo: null, nome: 'EMPRESA / COMERCIO' });
    expect(resultado.linhas[0].dadosOriginais.ds_placa).toBe(placa);
  });

  it('recusa dimensões malformadas devolvidas pelo leitor', async () => {
    const isolated = new PlanilhaLancamentosParser(new ConfigService());
    const read = jest.spyOn(isolated as any, 'readInWorker');
    for (const reference of ['INVALIDO', 'A0:G2', 'G2:A1']) {
      read.mockResolvedValueOnce({ sheet: { '!ref': reference }, date1904: false });
      await expect(isolated.parse(spreadsheet())).rejects.toThrow(/dimensões inválidas/);
    }
  });

  it('recusa XLS com assinatura OLE mas conteúdo incompleto sem responder erro 500', async () => {
    await expect(parser.parse({ nome: 'incompleto.xls', mimeType: 'application/vnd.ms-excel', buffer: Buffer.from('d0cf11e0a1b11ae1', 'hex') })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('limita memória do worker e encerra leitura que ultrapassa cinco segundos', async () => {
    const fake = Object.assign(new EventEmitter(), { terminate: jest.fn().mockResolvedValue(1) });
    const createWorker = jest.spyOn(workerThreads, 'Worker').mockImplementation(() => fake as any);
    jest.useFakeTimers();
    try {
      const pending = expect(parser.parse(spreadsheet())).rejects.toThrow(/tempo máximo de leitura/);
      jest.advanceTimersByTime(5_000);
      await pending;
      expect(fake.terminate).toHaveBeenCalledTimes(1);
      expect(createWorker).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
        resourceLimits: { maxOldGenerationSizeMb: 96, maxYoungGenerationSizeMb: 16 },
      }));
    } finally {
      createWorker.mockRestore();
      jest.useRealTimers();
    }
  });
});
