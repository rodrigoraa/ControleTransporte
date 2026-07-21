import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditActor } from '../common/audit/audit-context';
import { CrudService } from '../common/crud/crud.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateAbastecimentoDto } from './dto/create-abastecimento.dto';
import { UpdateAbastecimentoDto } from './dto/update-abastecimento.dto';

@Injectable()
export class AbastecimentosService extends CrudService<CreateAbastecimentoDto, UpdateAbastecimentoDto> {
  constructor(prisma: PrismaService) {
    super(prisma, 'abastecimento', [], { cavaloMecanico: true });
  }

  async findByCavalo(cavaloMecanicoId: string) {
    if (!cavaloMecanicoId) throw new BadRequestException('Informe o cavalo mecânico.');
    const cavalo = await this.prisma.cavaloMecanico.findUnique({ where: { id: cavaloMecanicoId } });
    if (!cavalo) throw new NotFoundException('Cavalo mecânico não encontrado.');

    const registros = await this.prisma.abastecimento.findMany({
      where: { cavaloMecanicoId },
      orderBy: [{ data: 'desc' }, { createdAt: 'desc' }],
    });
    const distanciaTotal = registros.reduce((total, item) => total.add(item.distanciaPercorrida), new Prisma.Decimal(0));
    const litrosTotal = registros.reduce((total, item) => total.add(item.litros), new Prisma.Decimal(0));
    const ultimo = registros[0] || null;
    const cronologicos = [...registros].reverse();
    const divergencias = cronologicos.flatMap((item, index) => {
      const proximo = cronologicos[index + 1];
      return proximo && !item.kmAtual.equals(proximo.kmAnterior) ? [item.id, proximo.id] : [];
    });

    return {
      cavalo,
      registros,
      divergencias: [...new Set(divergencias)],
      resumo: {
        quantidadeRegistros: registros.length,
        distanciaTotal,
        litrosTotal,
        mediaGeralKmLitro: litrosTotal.greaterThan(0) ? distanciaTotal.div(litrosTotal).toDecimalPlaces(3) : new Prisma.Decimal(0),
        ultimaQuilometragem: ultimo?.kmAtual ?? null,
        kmAnteriorSugerido: ultimo?.kmAtual ?? null,
      },
    };
  }

  async create(dto: CreateAbastecimentoDto, actor?: AuditActor) {
    await this.assertCavalo(dto.cavaloMecanicoId);
    const calculated = this.calculate(dto.kmAnterior, dto.kmAtual, dto.litros);
    const created = await this.prisma.abastecimento.create({
      data: { ...dto, observacoes: dto.observacoes || null, ...calculated },
      include: { cavaloMecanico: true },
    });
    await this.audit('CRIACAO', created.id, null, created, actor);
    return created;
  }

  async update(id: string, dto: UpdateAbastecimentoDto, actor?: AuditActor) {
    const before = await this.prisma.abastecimento.findUnique({ where: { id }, include: { cavaloMecanico: true } });
    if (!before) throw new NotFoundException('Registro de consumo não encontrado.');
    const cavaloMecanicoId = dto.cavaloMecanicoId ?? before.cavaloMecanicoId;
    await this.assertCavalo(cavaloMecanicoId);
    const kmAnterior = dto.kmAnterior ?? Number(before.kmAnterior);
    const kmAtual = dto.kmAtual ?? Number(before.kmAtual);
    const litros = dto.litros ?? Number(before.litros);
    const calculated = this.calculate(kmAnterior, kmAtual, litros);
    const updated = await this.prisma.abastecimento.update({
      where: { id },
      data: { ...dto, cavaloMecanicoId, ...calculated },
      include: { cavaloMecanico: true },
    });
    await this.audit('ATUALIZACAO', id, before, updated, actor);
    return updated;
  }

  private calculate(kmAnterior: number, kmAtual: number, litros: number) {
    const anterior = new Prisma.Decimal(kmAnterior);
    const atual = new Prisma.Decimal(kmAtual);
    const quantidadeLitros = new Prisma.Decimal(litros);
    if (!atual.greaterThan(anterior)) throw new BadRequestException('A quilometragem atual deve ser maior que a quilometragem anterior.');
    if (!quantidadeLitros.greaterThan(0)) throw new BadRequestException('A quantidade de litros deve ser maior que zero.');
    const distanciaPercorrida = atual.minus(anterior);
    return { distanciaPercorrida, mediaKmLitro: distanciaPercorrida.div(quantidadeLitros).toDecimalPlaces(3) };
  }

  private async assertCavalo(id: string) {
    if (!(await this.prisma.cavaloMecanico.count({ where: { id } }))) throw new NotFoundException('Cavalo mecânico não encontrado.');
  }
}
