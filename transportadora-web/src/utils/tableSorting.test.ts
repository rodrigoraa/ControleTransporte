import { describe, expect, it } from 'vitest';
import { nextTableSort, sortTableRows } from './tableSorting';

describe('ordenação de tabelas', () => {
  it('começa crescente e alterna a direção ao clicar novamente', () => {
    const first = nextTableSort({ orderBy: '', orderDirection: 'asc' }, 'motoristaId');
    const second = nextTableSort(first, 'motoristaId');

    expect(first).toEqual({ orderBy: 'motoristaId', orderDirection: 'asc' });
    expect(second).toEqual({ orderBy: 'motoristaId', orderDirection: 'desc' });
  });

  it('volta para crescente ao escolher outra coluna', () => {
    expect(nextTableSort(
      { orderBy: 'valorTotal', orderDirection: 'desc' },
      'quantidade',
    )).toEqual({ orderBy: 'quantidade', orderDirection: 'asc' });
  });

  it('ordena textos e números sem alterar a lista original', () => {
    const rows = [
      { nome: 'Cavalo 10', total: 20 },
      { nome: 'Cavalo 2', total: 100 },
    ];

    expect(sortTableRows(rows, { orderBy: 'nome', orderDirection: 'asc' }, {
      nome: (row) => row.nome,
    }).map((row) => row.nome)).toEqual(['Cavalo 2', 'Cavalo 10']);
    expect(sortTableRows(rows, { orderBy: 'total', orderDirection: 'desc' }, {
      total: (row) => row.total,
    }).map((row) => row.total)).toEqual([100, 20]);
    expect(rows[0].nome).toBe('Cavalo 10');
  });
});
