import { validateEnv } from './env.validation';

const baseConfig = {
  NODE_ENV: 'development',
  DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/controle_transporte?schema=public',
  DIRECT_URL: 'postgresql://postgres:postgres@localhost:5432/controle_transporte?schema=public',
  JWT_SECRET: 'development-secret-with-at-least-32-characters',
  JWT_EXPIRES_IN: '8h',
  FRONTEND_URL: 'http://localhost:5173',
};

describe('validateEnv', () => {
  it('normaliza valores numericos e aceita desenvolvimento local', () => {
    const result = validateEnv({ ...baseConfig, PORT: '3100', BCRYPT_ROUNDS: '12' });

    expect(result.PORT).toBe(3100);
    expect(result.BCRYPT_ROUNDS).toBe(12);
    expect(result.DATABASE_POOL_MODE).toBe('auto');
  });

  it('exige segredo forte e HTTPS em produção', () => {
    expect(() =>
      validateEnv({
        ...baseConfig,
        NODE_ENV: 'production',
        JWT_SECRET: 'short-production-secret',
        FRONTEND_URL: 'http://transporte.example.com',
      }),
    ).toThrow(/JWT_SECRET/);
  });

  it('aceita configuração segura de produção', () => {
    const result = validateEnv({
      ...baseConfig,
      NODE_ENV: 'production',
      JWT_SECRET: 'a'.repeat(64),
      FRONTEND_URL: 'https://transporte.example.com',
      DATABASE_POOL_MODE: 'transaction',
    });

    expect(result.NODE_ENV).toBe('production');
    expect(result.DATABASE_POOL_MODE).toBe('transaction');
  });
});
