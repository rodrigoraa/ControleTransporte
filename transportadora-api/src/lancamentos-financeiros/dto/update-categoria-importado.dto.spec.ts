import 'reflect-metadata';
import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import { PerfilUsuario } from '@prisma/client';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ROLES_KEY } from '../../common/decorators/roles.decorator';
import { LancamentosFinanceirosController } from '../lancamentos-financeiros.controller';
import { UpdateCategoriaImportadoDto } from './update-categoria-importado.dto';

describe('edição restrita de categoria importada', () => {
  const pipe = new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true });
  const transform = (value: unknown) => pipe.transform(value, { type: 'body', metatype: UpdateCategoriaImportadoDto });

  it.each([{ categoriaId: '  category-1  ' }, { categoriaId: null }])('aceita categoria ou remoção explícita: %j', async (value) => {
    expect(await transform(value)).toEqual({ categoriaId: value.categoriaId?.trim() ?? null });
  });

  it.each([{}, { categoriaId: '' }, { categoriaId: '   ' }, { categoriaId: 1 }, { categoriaId: [] }, { categoriaId: 'a'.repeat(129) },
    { categoriaId: null, valorUnitario: 999 }, { categoriaId: 'cat', conjuntoId: 'set' }, { categoriaId: 'cat', tipoComissao: null },
  ])('rejeita payload que não seja somente uma categoria válida: %j', async (value) => {
    await expect(transform(value)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('exige JWT, ADMIN e DTO concreto na rota de categoria', () => {
    const handler = LancamentosFinanceirosController.prototype.atualizarCategoria;
    expect(Reflect.getMetadata(GUARDS_METADATA, handler)).toEqual([JwtAuthGuard, RolesGuard]);
    expect(Reflect.getMetadata(ROLES_KEY, handler)).toEqual([PerfilUsuario.ADMIN]);
    expect(Reflect.getMetadata('design:paramtypes', LancamentosFinanceirosController.prototype, 'atualizarCategoria')[1]).toBe(UpdateCategoriaImportadoDto);
    const guard = new RolesGuard(new Reflector());
    const context = (perfil: PerfilUsuario) => ({ getHandler: () => handler, getClass: () => LancamentosFinanceirosController, switchToHttp: () => ({ getRequest: () => ({ user: { perfil } }) }) }) as any;
    expect(guard.canActivate(context(PerfilUsuario.ADMIN))).toBe(true);
    expect(guard.canActivate(context(PerfilUsuario.USUARIO))).toBe(false);
  });
});
