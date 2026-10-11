import { BadRequestException } from '@nestjs/common';
import { Prisma, StatusGeral } from '@prisma/client';
import { MotoristasService } from './motoristas.service';

function makeService(mapeado = false) {
  const motorista = { id: 'driver-1', nome: 'Motorista existente', status: StatusGeral.ATIVO };
  const prisma: any = {
    motorista: {
      findUnique: jest.fn(async () => motorista),
      delete: jest.fn(async () => motorista),
      update: jest.fn(async ({ data }: any) => ({ ...motorista, ...data })),
    },
    lancamentoFinanceiro: { count: jest.fn(async () => 0) },
    cavaloMecanico: { count: jest.fn(async () => 0) },
    historicoMotorista: { count: jest.fn(async () => 0), create: jest.fn(async (args: any) => args) },
    mapeamentoImportacao: { count: jest.fn(async () => mapeado ? 1 : 0) },
    auditoria: { create: jest.fn(async (args: any) => args) },
  };
  return { prisma, service: new MotoristasService(prisma) };
}

describe('MotoristasService - associações de importação', () => {
  it('retorna erro de negócio para motorista mapeado mesmo sem financeiro, cavalo ou histórico', async () => {
    const { prisma, service } = makeService(true);
    const error = await service.remove('driver-1').catch((error) => error);
    expect(error).toBeInstanceOf(BadRequestException);
    expect(error.getStatus()).toBe(400);
    expect(error.message).toContain('associações de importação confirmadas');
    expect(error.message).toContain('Inative o cadastro');
    expect(prisma.mapeamentoImportacao.count).toHaveBeenCalledWith({ where: { motoristaId: 'driver-1' } });
    expect(prisma.motorista.delete).not.toHaveBeenCalled();
    expect(prisma.auditoria.create).not.toHaveBeenCalled();
  });

  it('mantém a exclusão e auditoria quando o motorista não tem referências', async () => {
    const { prisma, service } = makeService();
    await expect(service.remove('driver-1', { sub: 'admin-1' })).resolves.toEqual({ message: 'Registro excluído com sucesso.' });
    expect(prisma.motorista.delete).toHaveBeenCalledWith({ where: { id: 'driver-1' } });
    expect(prisma.auditoria.create).toHaveBeenCalledWith({ data: expect.objectContaining({ acao: 'EXCLUSAO', usuarioId: 'admin-1' }) });
  });

  it.each([
    ['lancamentoFinanceiro', 'lançamentos financeiros'],
    ['cavaloMecanico', 'vinculado a um cavalo'],
    ['historicoMotorista', 'histórico registrado'],
  ])('preserva o bloqueio existente de %s antes da associação de importação', async (model, message) => {
    const { prisma, service } = makeService(true);
    prisma[model].count.mockResolvedValueOnce(1);
    await expect(service.remove('driver-1')).rejects.toThrow(message);
    expect(prisma.motorista.delete).not.toHaveBeenCalled();
  });

  it('permite inativar motorista mapeado e registra o histórico normalmente', async () => {
    const { prisma, service } = makeService(true);
    await expect(service.update('driver-1', { status: StatusGeral.INATIVO })).resolves.toMatchObject({ status: StatusGeral.INATIVO });
    expect(prisma.motorista.delete).not.toHaveBeenCalled();
    expect(prisma.mapeamentoImportacao.count).not.toHaveBeenCalled();
    expect(prisma.historicoMotorista.create).toHaveBeenCalledWith({ data: expect.objectContaining({ motoristaId: 'driver-1', acao: 'ATUALIZACAO' }) });
  });

  it('mantém retorno 400 se a FK RESTRICT aparecer depois da consulta', async () => {
    const { prisma, service } = makeService();
    prisma.motorista.delete.mockRejectedValueOnce(new Prisma.PrismaClientUnknownRequestError(
      'PostgresError { code: "23001", message: "violates RESTRICT setting of foreign key constraint mapeamentos_importacao_motoristaId_fkey" }',
      { clientVersion: '5.22.0' },
    ));
    const error = await service.remove('driver-1').catch((error) => error);
    expect(error).toBeInstanceOf(BadRequestException);
    expect(error.getStatus()).toBe(400);
    expect(error.message).toContain('vínculos com outros cadastros');
    expect(prisma.auditoria.create).not.toHaveBeenCalled();
  });
});
