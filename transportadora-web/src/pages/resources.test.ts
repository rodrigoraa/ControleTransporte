import { describe, expect, it } from 'vitest';
import { crudResources, resourceListPath } from './resources';

const byPath = (path: string) => crudResources.find((resource) => resource.path === path)!;
const field = (path: string, name: string) => byPath(path).fields.find((item) => item.name === name);

describe('crudResources', () => {
  it('despesas usa tipo fixo, tem fornecedor, não tem cliente e filtra categorias de despesa', () => {
    const despesas = byPath('despesas');

    expect(despesas.fixedValues).toEqual({ tipoLancamento: 'DESPESA' });
    expect(field('despesas', 'fornecedorId')).toBeTruthy();
    expect(field('despesas', 'clienteId')).toBeUndefined();
    expect(field('despesas', 'categoriaId')?.relation?.params).toEqual({ tipoLancamento: 'DESPESA' });
  });

  it('faturamento usa tipo fixo, tem cliente obrigatório, não tem fornecedor e filtra categorias de faturamento', () => {
    const faturamento = byPath('faturamento');

    expect(faturamento.fixedValues).toEqual({ tipoLancamento: 'FATURAMENTO' });
    expect(field('faturamento', 'clienteId')?.required).toBe(true);
    expect(field('faturamento', 'fornecedorId')).toBeUndefined();
    expect(field('faturamento', 'categoriaId')?.relation?.params).toEqual({ tipoLancamento: 'FATURAMENTO' });
  });

  it('mantém rotas de retorno distintas para despesas e faturamento apesar do endpoint compartilhado', () => {
    const despesas = byPath('despesas');
    const faturamento = byPath('faturamento');

    expect(despesas.endpoint).toBe(faturamento.endpoint);
    expect(resourceListPath(despesas)).toBe('/despesas');
    expect(resourceListPath(faturamento)).toBe('/faturamento');
  });

  it('lançamento financeiro não duplica placa e cavalo e usa conjunto operacional', () => {
    expect(field('despesas', 'placa')).toBeUndefined();
    expect(field('despesas', 'implementoId')).toBeUndefined();
    expect(field('despesas', 'cavaloMecanicoId')).toBeTruthy();
    expect(field('despesas', 'conjuntoId')).toBeTruthy();
    expect(byPath('lancamentos-financeiros')).toBeUndefined();
  });

  it('centraliza a composição no cadastro de cavalos mecânicos', () => {
    expect(byPath('implementos')).toBeUndefined();
    expect(byPath('conjuntos')).toBeUndefined();
    expect(field('caminhoes', 'composicaoAtual')?.table).toBe(true);
    expect(field('caminhoes', 'composicaoAtual')?.hidden).toBe(true);
  });

  it('marca senha como obrigatória na criação de usuários e normaliza placa do cavalo', () => {
    expect(field('users', 'senha')?.required).toBe(true);
    expect(field('caminhoes', 'placa')?.mask?.('abc-1d23')).toBe('ABC1D23');
  });
});
//teste

//
