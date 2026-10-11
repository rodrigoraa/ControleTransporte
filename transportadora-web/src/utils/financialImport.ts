import { commissionDefaults, CommissionType } from './commission';

export type ImportCommission = {
  tipoComissao?: CommissionType;
  percentualComissao?: number;
  valorComissaoPorViagem?: number;
  descontoImpostos?: boolean;
};

export type ImportSelection = ImportCommission & {
  linha: number;
  cavaloMecanicoId?: string;
  motoristaId?: string;
  clienteId?: string;
};

export type ImportEntity = { id: string; nome: string };
export type ImportHorse = { id: string; placa: string };
export type ImportRow = {
  linha: number;
  chaveExterna: string | null;
  data: string | null;
  placa: string | null;
  peso: string | null;
  valor: string | null;
  motoristaExterno: { codigo: string | null; nome: string };
  clienteExterno: { codigo: string | null; nome: string };
  cavalo: ImportHorse | null;
  conjunto: ImportEntity | null;
  motorista: ImportEntity | null;
  cliente: ImportEntity | null;
  sugestoesMotorista: ImportEntity[];
  sugestoesCliente: ImportEntity[];
  quantidadeEixos: number | null;
  comissaoNecessaria: boolean;
  comissao: ImportCommission;
  status: string;
  pendencias: string[];
};

export type ImportPreview = {
  hashArquivo: string;
  arquivo: string;
  origem: string;
  linhas: ImportRow[];
  resumo: { total: number; prontas: number; duplicadas: number; pendentes: number; invalidas: number; conflitos: number };
};

export type ImportResult = { importados: number; duplicadosIgnorados: number; erros: number };
export type ImportOptions = { hashArquivo?: string; selecoes?: ImportSelection[]; linhasSelecionadas?: number[] };

const selectableStatuses = new Set(['PRONTO', 'PENDENTE_MOTORISTA', 'PENDENTE_CLIENTE', 'PLACA_NAO_ENCONTRADA', 'PENDENTE_COMPOSICAO', 'PENDENTE_COMISSAO']);

export function canSelectImportRow(row: Pick<ImportRow, 'status'>) {
  return selectableStatuses.has(row.status);
}

export function canEditImportRow(row: Pick<ImportRow, 'status'>) {
  return canSelectImportRow(row) || row.status === 'CONFLITO';
}

export function canConfirmImport(rows: ImportRow[], selected: number[], dirty: boolean) {
  if (dirty || new Set(selected).size !== selected.length) return false;
  if (!selected.length) return rows.length > 0 && rows.every((row) => ['DUPLICADO', 'DUPLICADO_ARQUIVO'].includes(row.status));
  const byLine = new Map(rows.map((row) => [row.linha, row]));
  return selected.every((line) => byLine.get(line)?.status === 'PRONTO');
}

export function confirmedImportLines(rows: ImportRow[], selected: number[]) {
  return [...new Set([...selected, ...rows.filter((row) => ['DUPLICADO', 'DUPLICADO_ARQUIVO'].includes(row.status)).map((row) => row.linha)])];
}

export function financialImportStatus(status: string) {
  const labels: Record<string, string> = {
    PRONTO: 'Pronto', DUPLICADO: 'Já importado', DUPLICADO_ARQUIVO: 'Repetido no arquivo',
    PENDENTE_MOTORISTA: 'Associar motorista', PENDENTE_CLIENTE: 'Associar cliente/pagador',
    PLACA_NAO_ENCONTRADA: 'Cavalo não encontrado', PENDENTE_COMISSAO: 'Informar comissão',
    PENDENTE_COMPOSICAO: 'Revisar composição histórica',
    DADOS_INVALIDOS: 'Dados inválidos', CONFLITO: 'Conflito com importação anterior',
  };
  return labels[status] || status;
}

export function importFileError(file: Pick<File, 'name' | 'size'>) {
  if (!/\.(xls|xlsx)$/i.test(file.name)) return 'Selecione uma planilha .xls ou .xlsx.';
  if (!file.size) return 'A planilha selecionada está vazia.';
  return '';
}

export function importCalendarDate(value: string | null) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || '');
  return match ? `${match[3]}/${match[2]}/${match[1]}` : '-';
}

export function buildImportFormData(file: File, options: ImportOptions) {
  const body = new FormData();
  body.append('opcoes', JSON.stringify(options));
  body.append('arquivo', file);
  return body;
}

export function importEntityOptions(catalog: ImportEntity[], suggestions: ImportEntity[] = [], current?: ImportEntity | null) {
  const suggestedIds = new Set(suggestions.map((item) => item.id));
  const entities = new Map([...suggestions, ...catalog, ...(current ? [current] : [])].map((item) => [item.id, item]));
  return [...entities.values()].map((item) => ({ value: item.id, label: `${item.nome}${suggestedIds.has(item.id) ? ' (sugestão)' : ''}` }));
}

export function importCommissionForType(eixos: number | null, type: CommissionType, current: ImportCommission = {}): ImportCommission {
  const defaults = commissionDefaults(eixos || 0);
  return {
    ...current,
    tipoComissao: type,
    percentualComissao: current.percentualComissao ?? defaults?.percentual,
    valorComissaoPorViagem: current.valorComissaoPorViagem ?? defaults?.valorPorViagem,
  };
}

export function selectImportHorse(row: ImportRow, current: ImportSelection | undefined, cavaloMecanicoId: string): ImportSelection {
  const selection: ImportSelection = { ...current, linha: row.linha, cavaloMecanicoId };
  if (cavaloMecanicoId !== (current?.cavaloMecanicoId || row.cavalo?.id)) {
    selection.tipoComissao = undefined;
    selection.percentualComissao = undefined;
    selection.valorComissaoPorViagem = undefined;
  }
  return selection;
}

export function applyImportCommission(rows: ImportRow[], selected: number[], selections: Record<number, ImportSelection>, rule: ImportCommission) {
  const result = { ...selections };
  if (!rule.tipoComissao) return result;
  const selectedLines = new Set(selected);
  for (const row of rows) {
    if (!selectedLines.has(row.linha) || !canSelectImportRow(row) || row.status === 'PENDENTE_COMPOSICAO' || !commissionDefaults(row.quantidadeEixos || 0)) continue;
    if (result[row.linha]?.cavaloMecanicoId && result[row.linha].cavaloMecanicoId !== row.cavalo?.id) continue;
    result[row.linha] = {
      ...result[row.linha],
      ...importCommissionForType(row.quantidadeEixos, rule.tipoComissao, rule),
      linha: row.linha,
    };
  }
  return result;
}

export function financialImportVisible(resource: { path: string; readOnly?: boolean }, perfil?: string) {
  return perfil === 'ADMIN' && !resource.readOnly && resource.path === 'faturamento';
}
