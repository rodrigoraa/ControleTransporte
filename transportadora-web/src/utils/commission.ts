export type CommissionType = 'PERCENTUAL' | 'POR_VIAGEM';

export type CommissionDefaults = {
  percentual: number;
  valorPorViagem: number;
};

export function commissionDefaults(eixos: number): CommissionDefaults | null {
  if (eixos === 4 || eixos === 7) return { percentual: 12, valorPorViagem: 240 };
  if (eixos === 9) return { percentual: 11, valorPorViagem: 330 };
  return null;
}

export function billingTotal(quantidade: unknown, valorUnitario: unknown, multiplicarQuantidade: unknown) {
  const quantidadeNumerica = Number(quantidade || 0);
  const valorNumerico = Number(valorUnitario || 0);
  const total = multiplicarQuantidade === false ? valorNumerico : quantidadeNumerica * valorNumerico;
  return roundCurrency(Number.isFinite(total) ? total : 0);
}

export function commissionValues(total: number, percentual: unknown, valorPorViagem: unknown) {
  const percentualNumerico = Number(percentual || 0);
  const valorViagemNumerico = Number(valorPorViagem || 0);
  return {
    percentual: roundCurrency(total * percentualNumerico / 100),
    porViagem: roundCurrency(Number.isFinite(valorViagemNumerico) ? valorViagemNumerico : 0),
  };
}

export function selectedCommissionValue(type: CommissionType | '' | null | undefined, values: ReturnType<typeof commissionValues>) {
  if (type === 'PERCENTUAL') return values.percentual;
  if (type === 'POR_VIAGEM') return values.porViagem;
  return 0;
}

export function commissionAfterTaxDiscount(commission: number, enabled: unknown) {
  const gross = roundCurrency(Number.isFinite(commission) ? commission : 0);
  const taxDiscount = enabled ? roundCurrency(gross * 0.12) : 0;
  return {
    gross,
    taxDiscount,
    net: roundCurrency(gross - taxDiscount),
  };
}

function roundCurrency(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
