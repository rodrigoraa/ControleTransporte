import { ConflictException } from '@nestjs/common';
import { UsersService } from './users.service';

describe('UsersService', () => {
  const environmentAdmin = {
    id: 'admin-id',
    nome: 'Administrador',
    email: 'admin@transportadora.com',
    senha: 'hash',
    perfil: 'ADMIN',
    ativo: true,
  };

  function makeService() {
    const prisma = {
      user: {
        findUnique: jest.fn(async () => environmentAdmin),
        update: jest.fn(),
        delete: jest.fn(),
      },
    } as any;
    const config = {
      get: jest.fn((key: string) => key === 'ADMIN_EMAIL' ? ' ADMIN@transportadora.com ' : undefined),
    } as any;
    return { service: new UsersService(prisma, config), prisma };
  }

  it('marca o administrador das variáveis de ambiente como protegido', async () => {
    const { service } = makeService();

    await expect(service.findOne(environmentAdmin.id)).resolves.toMatchObject({ protegido: true });
  });

  it('impede alterar o administrador das variáveis de ambiente', async () => {
    const { service, prisma } = makeService();

    await expect(service.update(environmentAdmin.id, { nome: 'Outro nome' })).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('impede excluir o administrador das variáveis de ambiente', async () => {
    const { service, prisma } = makeService();

    await expect(service.remove(environmentAdmin.id)).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.user.delete).not.toHaveBeenCalled();
  });
});
