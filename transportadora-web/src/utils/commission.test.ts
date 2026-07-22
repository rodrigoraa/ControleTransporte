import { describe, expect, it } from 'vitest';
import { billingTotal, commissionDefaults, commissionValues, selectedCommissionValue } from './commission';

describe('commission', () => {
  it('define as regras padrão somente para composições de 7 e 9 eixos', () => {
    expect(commissionDefaults(7)).toEqual({ percentual: 12, valorPorViagem: 240 });
    expect(commissionDefaults(9)).toEqual({ percentual: 11, valorPorViagem: 330 });
    expect(commissionDefaults(6)).toBeNull();
  });

  it('calcula faturamento respeitando a opção de multiplicar quantidade', () => {
    expect(billingTotal(3, 100, true)).toBe(300);
    expect(billingTotal(3, 100, false)).toBe(100);
    expect(billingTotal(1.001, 101.49, true)).toBe(101.59);
  });

  it('calcula e seleciona comissão percentual ou por viagem', () => {
    const values = commissionValues(10000, 12, 240);
    expect(values).toEqual({ percentual: 1200, porViagem: 240 });
    expect(selectedCommissionValue('PERCENTUAL', values)).toBe(1200);
    expect(selectedCommissionValue('POR_VIAGEM', values)).toBe(240);
    expect(commissionValues(101.59, 11, 330).percentual).toBe(11.17);
  });
});
