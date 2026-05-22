import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { PaginationDto } from '../common/crud/pagination.dto';

@Injectable()
export class AuditoriasService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: PaginationDto & Record<string, string>) {
    const page = Math.max(Number(query.page || 1), 1);
    const limit = Math.min(Math.max(Number(query.limit || 20), 1), 100);
    const where: any = {};
    if (query.search) {
      where.OR = [
        { entidade: { contains: query.search, mode: 'insensitive' } },
        { acao: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    const [data, total] = await Promise.all([
      this.prisma.auditoria.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.auditoria.count({ where }),
    ]);
    return { data, total, page, limit };
  }
}
