import { Injectable } from '@nestjs/common';
import { AuditActor } from '../common/audit/audit-context';
import { CrudService } from '../common/crud/crud.service';
import { PaginationDto } from '../common/crud/pagination.dto';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateCategoriaFinanceiraDto } from './dto/create-categoria-financeira.dto';
import { UpdateCategoriaFinanceiraDto } from './dto/update-categoria-financeira.dto';

@Injectable()
export class CategoriasFinanceirasService extends CrudService<CreateCategoriaFinanceiraDto, UpdateCategoriaFinanceiraDto> {
  constructor(prisma: PrismaService) {
    super(prisma, 'categoriaFinanceira', ['nome', 'observacoes']);
  }

  protected buildWhere(query: PaginationDto & Record<string, any>) {
    const where = super.buildWhere(query);
    if (query.tipoLancamento) where.tipoLancamento = query.tipoLancamento;
    if (query.ativo !== undefined) where.ativo = query.ativo === 'true';
    return where;
  }

  async remove(id: string, actor?: AuditActor) {
    await this.assertNoRelatedRecords([
      {
        count: this.prisma.lancamentoFinanceiro.count({ where: { categoriaId: id } }),
        message: 'Não foi possível excluir: categoria possui lançamentos financeiros vinculados ao histórico.',
      },
    ]);
    return super.remove(id, actor);
  }
}
