import { TipoLancamento } from '@prisma/client';
import { CategoriasFinanceirasService } from './categorias-financeiras.service';

describe('CategoriasFinanceirasService - filtros por coluna', () => {
  it('combina nome, tipo de lançamento e situação ativa', () => {
    const service = new CategoriasFinanceirasService({} as any);

    expect((service as any).buildWhere({
      nome: 'combustível',
      tipoLancamento: TipoLancamento.DESPESA,
      ativo: 'false',
    })).toEqual({
      nome: { contains: 'combustível', mode: 'insensitive' },
      tipoLancamento: TipoLancamento.DESPESA,
      ativo: false,
    });
  });
});
