import { AuthService } from './auth.service';

describe('AuthService', () => {
  it('nao altera senha quando a recuperacao insegura esta desabilitada', async () => {
    const prisma = {
      user: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      auditoria: {
        create: jest.fn(),
      },
    };
    const jwt = { signAsync: jest.fn() };
    const config = {
      get: jest.fn((key: string) => {
        if (key === 'NODE_ENV') return 'production';
        return undefined;
      }),
    };
    const service = new AuthService(prisma as any, jwt as any, config as any);

    const result = await service.forgotPassword({ email: 'admin@example.com' });

    expect(result.available).toBe(false);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(prisma.auditoria.create).not.toHaveBeenCalled();
  });
});
