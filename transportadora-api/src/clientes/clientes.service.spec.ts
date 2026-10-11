import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ClientesService } from './clientes.service';

function makeService(mapeado = false) {
  const cliente = { id: 'client-1', nome: 'Cliente existente', ativo: true };
  const prisma: any = {
    cliente: {
      findUnique: jest.fn(async () => cliente),
      delete: jest.fn(async () => cliente),
      update: jest.fn(async ({ data }: any) => ({ ...cliente, ...data })),
    },
    lancamentoFinanceiro: { count: jest.fn(async () => 0) },
    historicoCliente: { create: jest.fn(async (args: any) => args) },
    mapeamentoImportacao: { count: jest.fn(async () => mapeado ? 1 : 0) },
    auditoria: { create: jest.fn(async (args: any) => args) },
  };
  return { prisma, service: new ClientesService(prisma) };
}

describe('ClientesService - associações de importação', () => {
  it('retorna erro de negócio para cliente mapeado mesmo sem faturamentos', async () => {
    const { prisma, service } = makeService(true);
    const error = await service.remove('client-1').catch((error) => error);
    expect(error).toBeInstanceOf(BadRequestException);
    expect(error.getStatus()).toBe(400);
    expect(error.message).toContain('associações de importação confirmadas');
    expect(error.message).toContain('Inative o cadastro');
    expect(prisma.mapeamentoImportacao.count).toHaveBeenCalledWith({ where: { clienteId: 'client-1' } });
    expect(prisma.cliente.delete).not.toHaveBeenCalled();
    expect(prisma.auditoria.create).not.toHaveBeenCalled();
  });

  it('mantém exclusão e auditoria quando o cliente não tem referências', async () => {
    const { prisma, service } = makeService();
    await expect(service.remove('client-1', { id: 'admin-1' })).resolves.toEqual({ message: 'Registro excluído com sucesso.' });
    expect(prisma.cliente.delete).toHaveBeenCalledWith({ where: { id: 'client-1' } });
    expect(prisma.auditoria.create).toHaveBeenCalledWith({ data: expect.objectContaining({ acao: 'EXCLUSAO', usuarioId: 'admin-1' }) });
  });

  it('preserva o bloqueio financeiro existente antes de consultar associações de importação', async () => {
    const { prisma, service } = makeService(true);
    prisma.lancamentoFinanceiro.count.mockResolvedValueOnce(1);
    await expect(service.remove('client-1')).rejects.toThrow('faturamentos vinculados ao histórico');
    expect(prisma.mapeamentoImportacao.count).not.toHaveBeenCalled();
    expect(prisma.cliente.delete).not.toHaveBeenCalled();
  });

  it('permite inativar cliente mapeado e registra o histórico normalmente', async () => {
    const { prisma, service } = makeService(true);
    await expect(service.update('client-1', { ativo: false })).resolves.toMatchObject({ ativo: false });
    expect(prisma.cliente.delete).not.toHaveBeenCalled();
    expect(prisma.mapeamentoImportacao.count).not.toHaveBeenCalled();
    expect(prisma.historicoCliente.create).toHaveBeenCalledWith({ data: expect.objectContaining({ clienteId: 'client-1', acao: 'ATUALIZACAO' }) });
  });

  it('mantém retorno 400 se a FK RESTRICT aparecer depois da consulta', async () => {
    const { prisma, service } = makeService();
    prisma.cliente.delete.mockRejectedValueOnce(new Prisma.PrismaClientUnknownRequestError(
      'PostgresError { code: "23001", message: "violates RESTRICT setting of foreign key constraint mapeamentos_importacao_clienteId_fkey" }',
      { clientVersion: '5.22.0' },
    ));
    const error = await service.remove('client-1').catch((error) => error);
    expect(error).toBeInstanceOf(BadRequestException);
    expect(error.getStatus()).toBe(400);
    expect(error.message).toContain('vínculos com outros cadastros');
    expect(prisma.auditoria.create).not.toHaveBeenCalled();
  });
});
