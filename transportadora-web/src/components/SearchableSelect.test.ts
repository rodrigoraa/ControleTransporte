import { describe, expect, it } from 'vitest';
import { filterSearchableOptions, normalizeSearch } from './SearchableSelect';

const options = [
  { value: '1', label: 'João da Silva - 123.456.789-00' },
  { value: '2', label: 'AWM3J13 - DOLLY - OUTRO - 2 eixos' },
  { value: '3', label: 'Posto Rota Pesada' },
];

describe('SearchableSelect', () => {
  it('busca por qualquer trecho sem diferenciar acentos ou maiúsculas', () => {
    expect(filterSearchableOptions(options, 'JOAO')).toEqual([options[0]]);
    expect(filterSearchableOptions(options, 'dolly')).toEqual([options[1]]);
    expect(filterSearchableOptions(options, 'rota pesada')).toEqual([options[2]]);
  });

  it('aceita texto copiado com espaços ao redor', () => {
    expect(filterSearchableOptions(options, '  AWM3J13  ')).toEqual([options[1]]);
    expect(normalizeSearch('  Criação  ')).toBe('criacao');
  });
});
