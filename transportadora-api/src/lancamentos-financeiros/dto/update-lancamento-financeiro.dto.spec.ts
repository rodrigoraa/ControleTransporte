import 'reflect-metadata';
import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { PerfilUsuario } from '@prisma/client';
import { ROLES_KEY } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { LancamentosFinanceirosController } from '../lancamentos-financeiros.controller';
import { CreateLancamentoFinanceiroDto } from './create-lancamento-financeiro.dto';
import { UpdateLancamentoFinanceiroDto } from './update-lancamento-financeiro.dto';

describe('edição completa do faturamento', () => {
  const pipe = new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true });
  const transform = (value: unknown) => pipe.transform(value, { type: 'body', metatype: UpdateLancamentoFinanceiroDto });

  it('aceita campos manuais e converte data e valores do formulário', async () => {
    expect(await transform({ data: '2026-10-11', quantidade: '2', valorUnitario: '3000', categoriaId: null, observacoes: 'Conferido' }))
      .toMatchObject({ data: new Date('2026-10-11T00:00:00Z'), quantidade: 2, valorUnitario: 3000, categoriaId: null });
  });

  it.each([
    { numeroControle: 'F01' }, { id: 'outro' }, { importacao: { id: 'outro' } }, { dadosOriginais: {} },
    { hashDados: 'alterado' }, { faturamentoOrigemId: 'outro' }, { valorTotal: 1 }, { valorComissao: 1 },
    { quantidade: -1 }, { valorUnitario: -1 }, { percentualComissao: 101 }, { data: 'inválida' },
  ])('rejeita campos automáticos, origem e valores inválidos: %j', async (value) => {
    await expect(transform(value)).rejects.toBeInstanceOf(BadRequestException);
  });

  it.each([
    { method: 'create', dto: CreateLancamentoFinanceiroDto, index: 0 },
    { method: 'update', dto: UpdateLancamentoFinanceiroDto, index: 1 },
  ] as const)('exige ADMIN e valida o DTO concreto em $method', ({ method, dto, index }) => {
    const handler = LancamentosFinanceirosController.prototype[method];
    expect(Reflect.getMetadata(GUARDS_METADATA, handler)).toEqual([JwtAuthGuard, RolesGuard]);
    expect(Reflect.getMetadata(ROLES_KEY, handler)).toEqual([PerfilUsuario.ADMIN]);
    expect(Reflect.getMetadata('design:paramtypes', LancamentosFinanceirosController.prototype, method)[index]).toBe(dto);
  });
});
