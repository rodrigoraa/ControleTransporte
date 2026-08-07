import { CrudService } from './crud.service';

class SearchableCrudService extends CrudService<Record<string, unknown>, Record<string, unknown>> {
  constructor() {
    super({} as any, 'cliente', ['nome', 'documento', 'telefone', 'email']);
  }

  where(query: Record<string, unknown>) {
    return this.buildWhere(query as any);
  }
}

describe('CrudService - filtros por coluna', () => {
  it('combina a pesquisa geral com os filtros textuais e de status', () => {
    const where = new SearchableCrudService().where({
      search: 'geral',
      nome: '  Cliente teste  ',
      documento: '123',
      status: 'ATIVO',
    });

    expect(where).toEqual({
      OR: [
        { nome: { contains: 'geral', mode: 'insensitive' } },
        { documento: { contains: 'geral', mode: 'insensitive' } },
        { telefone: { contains: 'geral', mode: 'insensitive' } },
        { email: { contains: 'geral', mode: 'insensitive' } },
      ],
      nome: { contains: 'Cliente teste', mode: 'insensitive' },
      documento: { contains: '123', mode: 'insensitive' },
      status: 'ATIVO',
    });
  });
});
