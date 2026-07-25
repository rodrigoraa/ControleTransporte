export type TableSort = {
  orderBy: string;
  orderDirection: 'asc' | 'desc';
};

type SortValue = string | number | boolean | Date | null | undefined;

export function nextTableSort(current: TableSort, orderBy: string): TableSort {
  if (current.orderBy === orderBy) {
    return {
      orderBy,
      orderDirection: current.orderDirection === 'asc' ? 'desc' : 'asc',
    };
  }
  return { orderBy, orderDirection: 'asc' };
}

export function sortTableRows<T>(
  rows: T[],
  sort: TableSort,
  valueGetters: Record<string, (row: T) => SortValue>,
): T[] {
  const valueGetter = valueGetters[sort.orderBy];
  if (!valueGetter) return rows;
  const direction = sort.orderDirection === 'asc' ? 1 : -1;
  const collator = new Intl.Collator('pt-BR', { numeric: true, sensitivity: 'base' });

  return rows
    .map((row, index) => ({ row, index }))
    .sort((left, right) => {
      const leftValue = valueGetter(left.row);
      const rightValue = valueGetter(right.row);
      if (leftValue == null && rightValue == null) return left.index - right.index;
      if (leftValue == null) return 1;
      if (rightValue == null) return -1;

      const leftComparable = leftValue instanceof Date ? leftValue.getTime() : leftValue;
      const rightComparable = rightValue instanceof Date ? rightValue.getTime() : rightValue;
      const comparison = typeof leftComparable === 'number' && typeof rightComparable === 'number'
        ? leftComparable - rightComparable
        : collator.compare(String(leftComparable), String(rightComparable));
      return comparison === 0 ? left.index - right.index : comparison * direction;
    })
    .map(({ row }) => row);
}
