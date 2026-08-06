import { describe, expect, it } from 'vitest';
import { maskPlate } from './formatters';

describe('maskPlate', () => {
  it('normaliza e limita placas de todos os usos a 128 caracteres por padrão', () => {
    const placa = maskPlate(`abc-${'1'.repeat(130)}`);

    expect(placa).toHaveLength(128);
    expect(placa).toMatch(/^[A-Z0-9]+$/);
    expect(placa.startsWith('ABC')).toBe(true);
  });
});
