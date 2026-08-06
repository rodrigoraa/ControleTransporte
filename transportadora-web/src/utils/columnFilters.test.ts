import { describe, expect, it } from 'vitest';
import { buildColumnFilterParams } from './columnFilters';

describe('buildColumnFilterParams', () => {
  it('combina os filtros preenchidos e ignora os vazios', () => {
    const fields = [
      { name: 'data', filterKey: 'data' },
      { name: 'cavaloMecanicoId', filterKey: 'cavalo' },
      { name: 'motoristaId', filterKey: 'motorista' },
    ];

    expect(buildColumnFilterParams(fields, {
      data: '2026-08-06',
      cavaloMecanicoId: '  Volvo  ',
      motoristaId: '   ',
    })).toEqual({
      data: '2026-08-06',
      cavalo: 'Volvo',
    });
  });
});
