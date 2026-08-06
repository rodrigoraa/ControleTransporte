type FilterableField = {
  name: string;
  filterKey?: string;
};

export function buildColumnFilterParams(fields: FilterableField[], values: Record<string, string>) {
  return Object.fromEntries(
    fields.flatMap((field) => {
      const value = values[field.name]?.trim();
      return field.filterKey && value ? [[field.filterKey, value]] : [];
    }),
  );
}
