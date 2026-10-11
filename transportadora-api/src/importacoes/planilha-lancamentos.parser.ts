import { BadRequestException, Injectable, PayloadTooLargeException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { createHash } from 'node:crypto';
import { Worker } from 'node:worker_threads';
import { inflateRawSync } from 'node:zlib';
import type { WorkSheet } from 'xlsx';
import { normalizePlate } from '../common/validation/normalize-plate';
import { DEFAULT_IMPORT_MAX_FILE_BYTES, IMPORT_MAX_COLUMNS, IMPORT_MAX_ROWS } from './importacao.constants';

export type ArquivoImportacao = { nome: string; mimeType: string; buffer: Buffer };
export type PessoaExterna = { codigo: string | null; nome: string };
export type LinhaPlanilhaLancamento = {
  linha: number;
  chaveExterna: string | null;
  dadosOriginais: Prisma.JsonObject;
  data: string | null;
  placa: string | null;
  peso: string | null;
  valor: string | null;
  motoristaExterno: PessoaExterna;
  clienteExterno: PessoaExterna;
  erros: string[];
};
export type PlanilhaLancamentos = { hashArquivo: string; arquivo: string; linhas: LinhaPlanilhaLancamento[] };

const COLUNAS = ['dt_emissao', 'ds_placa', 'vl_peso', 'nm_pessoa_motorista', 'nm_pagador', 'vl_total'];
const FALLBACK = ['cd_pessoa_filial', 'ds_serie', 'nr_ctrc'];
const MAX_EXPANDED_BYTES = 32 * 1024 * 1024;
const XLS_SIGNATURE = Buffer.from('d0cf11e0a1b11ae1', 'hex');
const WORKER_SOURCE = `
const { parentPort, workerData } = require('node:worker_threads');
try {
  const XLSX = require(workerData.xlsxPath);
  const workbook = XLSX.read(Buffer.from(workerData.buffer), {
    type: 'buffer', sheets: 0, sheetRows: workerData.maxRows, raw: true,
    cellDates: false, cellHTML: false, cellNF: false, cellStyles: false,
    cellFormula: false, bookVBA: false, bookDeps: false,
  });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  parentPort.postMessage({ sheet, date1904: Boolean(workbook.Workbook?.WBProps?.date1904) });
} catch {
  parentPort.postMessage({ error: true });
}
`;

@Injectable()
export class PlanilhaLancamentosParser {
  constructor(private readonly config: ConfigService) {}

  async parse(arquivo: ArquivoImportacao): Promise<PlanilhaLancamentos> {
    const maxBytes = this.config.get<number>('IMPORT_MAX_FILE_BYTES') ?? DEFAULT_IMPORT_MAX_FILE_BYTES;
    if (!Buffer.isBuffer(arquivo.buffer) || !arquivo.buffer.length) throw new BadRequestException('Selecione uma planilha não vazia.');
    if (arquivo.buffer.length > maxBytes) throw new PayloadTooLargeException('A planilha excede o tamanho máximo permitido.');
    const nomeOriginal = String(arquivo.nome || '').split(/[\\/]/).pop() || '';
    const extension = nomeOriginal.match(/\.(xls|xlsx)$/i)?.[1]?.toLowerCase();
    if (!extension) throw new BadRequestException('Selecione uma planilha .xls ou .xlsx.');
    const mime = String(arquivo.mimeType || '').split(';')[0].trim().toLowerCase();
    const genericos = ['', 'application/octet-stream', 'binary/octet-stream'];
    const permitidos = extension === 'xlsx'
      ? ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/zip']
      : ['application/vnd.ms-excel', 'application/msexcel', 'application/x-msexcel', 'application/x-excel', 'application/excel', 'text/html', 'application/xml', 'text/xml'];
    if (![...genericos, ...permitidos].includes(mime)) throw new BadRequestException('O tipo do arquivo não corresponde a uma planilha Excel.');

    let readable = arquivo.buffer;
    if (extension === 'xlsx') this.validateZip(arquivo.buffer);
    else readable = this.validateLegacy(arquivo.buffer);
    const { sheet, date1904 } = await this.readInWorker(readable);
    if (!sheet?.['!ref']) throw new BadRequestException('A planilha não contém dados para importação.');
    const range = decodeRange(sheet['!fullref'] || sheet['!ref']);
    if (range.endColumn >= IMPORT_MAX_COLUMNS) throw new BadRequestException('A planilha excede o limite de 256 colunas.');
    if (range.endRow - range.startRow > IMPORT_MAX_ROWS + 20) throw new BadRequestException('A planilha excede o limite de 1.000 linhas.');

    let headerRow = -1;
    let headers: string[] = [];
    for (let row = range.startRow; row <= Math.min(range.endRow, range.startRow + 20); row++) {
      const candidate = Array.from({ length: range.endColumn + 1 }, (_, column) => text(cellValue(sheet, row, column)).toLowerCase());
      if (COLUNAS.every((column) => candidate.includes(column))) { headerRow = row; headers = candidate; break; }
    }
    if (headerRow < 0) {
      const firstHeaders = Array.from({ length: range.endColumn + 1 }, (_, column) => text(cellValue(sheet, range.startRow, column)).toLowerCase());
      const missing = COLUNAS.filter((column) => !firstHeaders.includes(column));
      throw new BadRequestException('A planilha não possui as colunas esperadas para importação. Faltam: ' + missing.join(', ') + '.');
    }
    if (!headers.includes('cd_ctrc') && !FALLBACK.every((column) => headers.includes(column))) {
      throw new BadRequestException('A planilha precisa da coluna cd_ctrc ou de cd_pessoa_filial, ds_serie e nr_ctrc para identificar os lançamentos.');
    }
    const nonemptyHeaders = headers.filter(Boolean);
    if (new Set(nonemptyHeaders).size !== nonemptyHeaders.length) throw new BadRequestException('A planilha possui nomes de colunas repetidos.');
    if (range.endRow - headerRow > IMPORT_MAX_ROWS) throw new BadRequestException('A planilha excede o limite de 1.000 linhas.');

    const linhas: LinhaPlanilhaLancamento[] = [];
    for (let row = headerRow + 1; row <= range.endRow; row++) {
      const values = headers.map((_, column) => cellValue(sheet, row, column));
      if (values.every((value) => value == null || text(value) === '')) continue;
      const original: Prisma.JsonObject = Object.create(null);
      headers.forEach((column, index) => { if (column) original[column] = jsonCell(values[index]); });
      const erros: string[] = [];
      const data = parseDate(original.dt_emissao, date1904);
      if (!data) erros.push('Data de emissão inválida.');
      const placa = normalizePlate(text(original.ds_placa)) as string | null;
      if (!placa) erros.push('Placa não informada.');
      if (text(original.ds_placa).length > 256) erros.push('Placa excede o limite de 256 caracteres.');
      const peso = decimal(original.vl_peso, 3, 9);
      if (peso === null) erros.push('Peso inválido: informe um valor positivo com até 3 casas decimais.');
      const valor = decimal(original.vl_total, 2, 12);
      if (valor === null) erros.push('Valor inválido: informe um valor positivo com até 2 casas decimais.');
      const motoristaExterno = pessoaExterna(original.nm_pessoa_motorista);
      const clienteExterno = pessoaExterna(original.nm_pagador);
      if (!motoristaExterno.nome) erros.push('Motorista não informado.');
      if (!clienteExterno.nome) erros.push('Pagador não informado.');
      for (const [label, pessoa] of [['Motorista', motoristaExterno], ['Pagador', clienteExterno]] as const) {
        if (pessoa.nome.length > 256) erros.push(label + ': nome excede o limite de 256 caracteres.');
        if ((pessoa.codigo?.length || 0) > 128) erros.push(label + ': código externo excede o limite de 128 caracteres.');
      }
      const ctrc = identifier(original.cd_ctrc);
      const fallback = FALLBACK.map((column) => identifier(original[column]));
      const chaveExterna = ctrc ? 'ctrc:' + ctrc : fallback.every(Boolean) ? 'documento:' + JSON.stringify(fallback) : null;
      if (!chaveExterna) erros.push('Informe cd_ctrc ou todos os campos cd_pessoa_filial, ds_serie e nr_ctrc.');
      linhas.push({ linha: row + 1, chaveExterna, dadosOriginais: original, data, placa, peso, valor, motoristaExterno, clienteExterno, erros });
    }
    if (!linhas.length) throw new BadRequestException('A planilha não contém lançamentos para importação.');
    const safeStem = nomeOriginal.slice(0, -(extension.length + 1)).normalize('NFKC').replace(/[^\p{L}\p{N}._ ()-]/gu, '_').slice(0, 160);
    return {
      hashArquivo: createHash('sha256').update(arquivo.buffer).digest('hex'),
      arquivo: (safeStem || 'planilha') + '.' + extension,
      linhas,
    };
  }

  private validateLegacy(buffer: Buffer) {
    if (buffer.subarray(0, 8).equals(XLS_SIGNATURE)) return buffer;
    let decoded = buffer.toString('utf8');
    let converted = false;
    if (buffer[0] === 0xff && buffer[1] === 0xfe) {
      if (buffer.length % 2) throw new BadRequestException('A planilha UTF-16 está incompleta.');
      decoded = buffer.subarray(2).toString('utf16le');
      converted = true;
    } else if (buffer[0] === 0xfe && buffer[1] === 0xff) {
      if (buffer.length % 2) throw new BadRequestException('A planilha UTF-16 está incompleta.');
      decoded = Buffer.from(buffer.subarray(2)).swap16().toString('utf16le');
      converted = true;
    }
    const content = decoded.replace(/^\uFEFF/, '').trimStart();
    if (/<!ENTITY|<!DOCTYPE\s+(?!html\b)/i.test(content)) throw new BadRequestException('A planilha contém uma declaração XML não permitida.');
    const xml = /^<\?xml\b|^<Workbook\b/i.test(content)
      && /<Workbook\b[^>]*urn:schemas-microsoft-com:office:spreadsheet/i.test(content)
      && /<(?:\w+:)?Worksheet\b/i.test(content);
    const html = /^(?:<!doctype\s+html[^>]*>\s*)?<(?:html|table)\b/i.test(content)
      && /<table\b/i.test(content) && /<tr\b/i.test(content) && /<(?:td|th)\b/i.test(content);
    if (!xml && !html) throw new BadRequestException('O conteúdo do arquivo .xls não é uma planilha Excel válida.');
    return converted ? Buffer.from(content.replace(/encoding\s*=\s*(["'])utf-16(?:le|be)?\1/ig, 'encoding="UTF-8"'), 'utf8') : buffer;
  }

  private validateZip(buffer: Buffer) {
    try {
      if (buffer.length < 22 || buffer.readUInt32LE(0) !== 0x04034b50) throw new Error();
      let eocd = -1;
      for (let index = buffer.length - 22; index >= Math.max(0, buffer.length - 65_557); index--) {
        if (buffer.readUInt32LE(index) === 0x06054b50) { eocd = index; break; }
      }
      if (eocd < 0 || buffer.readUInt16LE(eocd + 4) || buffer.readUInt16LE(eocd + 6)) throw new Error();
      const count = buffer.readUInt16LE(eocd + 10);
      const centralSize = buffer.readUInt32LE(eocd + 12);
      const centralOffset = buffer.readUInt32LE(eocd + 16);
      let cursor = centralOffset;
      if (!count || count > 1024 || cursor + centralSize > eocd || count === 0xffff) throw new Error();
      let total = 0;
      const names = new Set<string>();
      for (let index = 0; index < count; index++) {
        if (cursor + 46 > buffer.length || buffer.readUInt32LE(cursor) !== 0x02014b50) throw new Error();
        const flags = buffer.readUInt16LE(cursor + 8);
        const method = buffer.readUInt16LE(cursor + 10);
        const compressed = buffer.readUInt32LE(cursor + 20);
        const expanded = buffer.readUInt32LE(cursor + 24);
        const nameLength = buffer.readUInt16LE(cursor + 28);
        const extraLength = buffer.readUInt16LE(cursor + 30);
        const commentLength = buffer.readUInt16LE(cursor + 32);
        const offset = buffer.readUInt32LE(cursor + 42);
        if ((flags & 1) || ![0, 8].includes(method) || compressed === 0xffffffff || expanded === 0xffffffff) throw new Error();
        total += expanded;
        if (total > MAX_EXPANDED_BYTES) throw new Error('size');
        const name = buffer.toString('utf8', cursor + 46, cursor + 46 + nameLength);
        if (names.has(name)) throw new Error();
        names.add(name);
        if (offset + 30 > buffer.length || buffer.readUInt32LE(offset) !== 0x04034b50) throw new Error();
        if (buffer.readUInt16LE(offset + 6) !== flags || buffer.readUInt16LE(offset + 8) !== method) throw new Error();
        const localCompressed = buffer.readUInt32LE(offset + 18);
        const localExpanded = buffer.readUInt32LE(offset + 22);
        if (!(flags & 8) && (localCompressed !== compressed || localExpanded !== expanded)) throw new Error();
        if ((flags & 8) && ((localCompressed !== 0 && localCompressed !== compressed) || (localExpanded !== 0 && localExpanded !== expanded))) throw new Error();
        const localNameLength = buffer.readUInt16LE(offset + 26);
        if (buffer.toString('utf8', offset + 30, offset + 30 + localNameLength) !== name) throw new Error();
        const start = offset + 30 + buffer.readUInt16LE(offset + 26) + buffer.readUInt16LE(offset + 28);
        if (start + compressed > centralOffset) throw new Error();
        const content = buffer.subarray(start, start + compressed);
        const actualSize = method === 0 ? content.length : inflateRawSync(content, { maxOutputLength: Math.min(MAX_EXPANDED_BYTES, expanded + 1) }).length;
        if (actualSize !== expanded) throw new Error();
        cursor += 46 + nameLength + extraLength + commentLength;
      }
      if (!names.has('[Content_Types].xml') || !names.has('xl/workbook.xml')) throw new Error();
    } catch (error) {
      if ((error as Error).message === 'size') throw new BadRequestException('A planilha excede o limite descompactado de 32 MiB.');
      throw new BadRequestException('O conteúdo do arquivo .xlsx é inválido ou excede os limites de segurança.');
    }
  }

  private readInWorker(buffer: Buffer): Promise<{ sheet: WorkSheet; date1904: boolean }> {
    return new Promise((resolve, reject) => {
      const worker = new Worker(WORKER_SOURCE, {
        eval: true,
        workerData: { buffer, xlsxPath: require.resolve('xlsx'), maxRows: IMPORT_MAX_ROWS + 22 },
        resourceLimits: { maxOldGenerationSizeMb: 96, maxYoungGenerationSizeMb: 16 },
      });
      let settled = false;
      const finish = (error?: Error, value?: { sheet: WorkSheet; date1904: boolean }) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        void worker.terminate();
        if (error) reject(error); else resolve(value!);
      };
      const timer = setTimeout(() => finish(new BadRequestException('A planilha excedeu o tempo máximo de leitura.')), 5_000);
      worker.once('message', (message) => finish(message.error ? new BadRequestException('Não foi possível ler a planilha. Verifique se o arquivo Excel está íntegro.') : undefined, message));
      worker.once('error', () => finish(new BadRequestException('A planilha é inválida ou excede a memória permitida.')));
      worker.once('exit', (code) => { if (code !== 0) finish(new BadRequestException('Não foi possível concluir a leitura da planilha.')); });
    });
  }
}

function text(value: unknown): string {
  return value == null ? '' : String(value).trim();
}

function cellValue(sheet: WorkSheet, row: number, column: number): unknown {
  let name = '';
  for (let value = column + 1; value; value = Math.floor((value - 1) / 26)) name = String.fromCharCode(65 + (value - 1) % 26) + name;
  const cell = sheet[name + (row + 1)];
  return cell?.t === 'e' ? null : cell?.v ?? null;
}

function decodeRange(reference: string) {
  const [first, last = first] = reference.split(':');
  const decode = (value: string) => {
    const match = value.match(/^([A-Z]+)(\d+)$/i);
    if (!match) throw new BadRequestException('A planilha possui dimensões inválidas.');
    let column = 0;
    for (const char of match[1].toUpperCase()) column = column * 26 + char.charCodeAt(0) - 64;
    return { column: column - 1, row: Number(match[2]) - 1 };
  };
  const start = decode(first);
  const end = decode(last);
    if (start.row < 0 || end.row < start.row || end.column < start.column || !Number.isSafeInteger(end.row)) {
      throw new BadRequestException('A planilha possui dimensões inválidas.');
    }
  return { startRow: start.row, endRow: end.row, endColumn: end.column };
}

function jsonCell(value: unknown): Prisma.JsonValue {
  if (value == null) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : String(value);
  if (typeof value === 'boolean' || typeof value === 'string') return value;
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function identifier(value: unknown): string | null {
  if (typeof value === 'boolean') return null;
  if (typeof value === 'number' && (!Number.isSafeInteger(value) || value < 0)) return null;
  const normalized = text(value);
  return normalized && normalized.length <= 128 ? normalized : null;
}

function pessoaExterna(value: unknown): PessoaExterna {
  const original = text(value);
  const match = original.match(/^([0-9]+)\s*\/\s*(.*)$/);
  return match ? { codigo: match[1].trim() || null, nome: match[2].trim() } : { codigo: null, nome: original };
}

function decimal(value: unknown, scale: number, integerDigits: number): string | null {
  if (typeof value === 'string' && value.length > 64) return null;
  let normalized: string;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return null;
    normalized = String(value);
  } else {
    normalized = text(value).replace(/^R\$\s*/, '');
    if (normalized.includes(',')) {
      if (!/^(?:\d+|\d{1,3}(?:\.\d{3})+),\d+$/.test(normalized)) return null;
      if (normalized.split(',')[1].length > scale) return null;
      normalized = normalized.replace(/\./g, '').replace(',', '.');
    } else if (/^\d{1,3}(?:\.\d{3})+$/.test(normalized)) {
      normalized = normalized.replace(/\./g, '');
    } else if (!/^\d+(?:\.\d+)?$/.test(normalized)) return null;
    else if ((normalized.split('.')[1] || '').length > scale) return null;
  }
  try {
    const result = new Prisma.Decimal(normalized);
    if (!result.isFinite() || !result.gt(0) || result.decimalPlaces() > scale || result.gte(new Prisma.Decimal(10).pow(integerDigits))) return null;
    return result.toFixed();
  } catch { return null; }
}

function parseDate(value: unknown, date1904: boolean): string | null {
  if (typeof value === 'number') {
    const days = Math.floor(value);
    if (!Number.isFinite(value) || days < (date1904 ? 0 : 1) || (!date1904 && days === 60)) return null;
    const base = date1904 ? Date.UTC(1904, 0, 1) : Date.UTC(1899, 11, 31);
    const date = new Date(base + (days - (!date1904 && days > 60 ? 1 : 0)) * 86_400_000);
    if (!Number.isFinite(date.getTime()) || date.getUTCFullYear() > 9999) return null;
    return date.toISOString().slice(0, 10);
  }
  const raw = text(value);
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/);
  const br = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+\d{2}:\d{2}(?::\d{2})?)?$/);
  if (!iso && !br) return null;
  const [year, month, day] = iso ? [Number(iso[1]), Number(iso[2]), Number(iso[3])] : [Number(br![3]), Number(br![2]), Number(br![1])];
  const date = new Date(Date.UTC(year, month - 1, day));
  if (year < 100 || year > 9999 || date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return String(year).padStart(4, '0') + '-' + String(month).padStart(2, '0') + '-' + String(day).padStart(2, '0');
}
