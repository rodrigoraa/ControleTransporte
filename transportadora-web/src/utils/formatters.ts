export const money = (value: number | string | null | undefined) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0));

export const date = (value: string | Date | null | undefined) => {
  if (!value) return '-';
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' }).format(new Date(value));
};

export const maskDocument = (value: string) => {
  const digits = value.replace(/\D/g, '');
  if (digits.length <= 11) {
    return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{0,2})/, (_, a, b, c, d) => `${a}.${b}.${c}${d ? `-${d}` : ''}`);
  }
  return digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{0,2})/, (_, a, b, c, d, e) => `${a}.${b}.${c}/${d}${e ? `-${e}` : ''}`);
};

export const maskPhone = (value: string) =>
  value.replace(/\D/g, '').replace(/(\d{2})(\d{0,5})(\d{0,4})/, (_, a, b, c) => `(${a}) ${b}${c ? `-${c}` : ''}`).slice(0, 15);

export const maskPlate = (value: string) => value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 7);

