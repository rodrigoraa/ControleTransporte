import { describe, expect, it } from 'vitest';
import { crudResources } from './resources';

const byPath = (path: string) => crudResources.find((resource) => resource.path === path)!;
const field = (path: string, name: string) => byPath(path).fields.find((item) => item.name === name);

describe('crudResources', () => {
  it('despesas usa tipo fixo, tem fornecedor, nao tem cliente e filtra categorias de despesa', () => {
    const despesas = byPath('despesas');

    expect(despesas.fixedValues).toEqual({ tipoLancamento: 'DESPESA' });
    expect(field('despesas', 'fornecedorId')).toBeTruthy();
    expect(field('despesas', 'clienteId')).toBeUndefined();
    expect(field('despesas', 'categoriaId')?.relation?.params).toEqual({ tipoLancamento: 'DESPESA' });
  });

  it('faturamento usa tipo fixo, tem cliente obrigatorio, nao tem fornecedor e filtra categorias de faturamento', () => {
    const faturamento = byPath('faturamento');

    expect(faturamento.fixedValues).toEqual({ tipoLancamento: 'FATURAMENTO' });
    expect(field('faturamento', 'clienteId')?.required).toBe(true);
    expect(field('faturamento', 'fornecedorId')).toBeUndefined();
    expect(field('faturamento', 'categoriaId')?.relation?.params).toEqual({ tipoLancamento: 'FATURAMENTO' });
  });

  it('lancamento financeiro nao duplica placa e cavalo e usa conjunto operacional', () => {
    expect(field('despesas', 'placa')).toBeUndefined();
    expect(field('despesas', 'implementoId')).toBeUndefined();
    expect(field('despesas', 'cavaloMecanicoId')).toBeTruthy();
    expect(field('despesas', 'conjuntoId')).toBeTruthy();
    expect(byPath('lancamentos-financeiros')).toBeUndefined();
  });

  it('possui cadastro separado de implementos e conjunto com selecao multipla', () => {
    expect(byPath('implementos')).toBeTruthy();
    expect(field('conjuntos', 'implementoIds')?.type).toBe('multiselect');
    expect(field('conjuntos', 'quantidadeTotalEixos')?.table).toBe(true);
    expect(field('conjuntos', 'capacidadeTotal')?.table).toBe(true);
  });
});
