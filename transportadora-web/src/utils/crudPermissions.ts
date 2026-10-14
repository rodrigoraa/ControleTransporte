type ProtectedRecord = {
  protegido?: boolean;
  faturamentoOrigemId?: string | null;
  importacao?: { id: string } | null;
  tipoLancamento?: string;
};

export function canMutateCrudRecord(row: ProtectedRecord, canWrite: boolean) {
  return canWrite && !row.protegido && !row.faturamentoOrigemId && !row.importacao?.id;
}

export function canEditCrudRecord(row: ProtectedRecord, canWrite: boolean) {
  return canWrite && !row.protegido && !row.faturamentoOrigemId;
}
