import { describe, expect, it } from 'vitest';
import { billingControl, maskPlate } from './formatters';

describe('controle do faturamento', () => {
  it.each([[1, 'F01'], [2, 'F02'], [9, 'F09'], [10, 'F10'], [99, 'F99'], [100, 'F100'], [1000, 'F1000'], [null, '-']] as const)
    ('exibe %s como %s sem truncar a sequência', (value, expected) => {
      expect(billingControl(value)).toBe(expected);
    });
});

describe('maskPlate', () => {
  it('normaliza e limita placas de todos os usos a 128 caracteres por padrão', () => {
    const placa = maskPlate(`abc-${'1'.repeat(130)}`);

    expect(placa).toHaveLength(128);
    expect(placa).toMatch(/^[A-Z0-9]+$/);
    expect(placa.startsWith('ABC')).toBe(true);
  });
});
