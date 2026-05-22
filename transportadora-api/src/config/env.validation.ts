const requiredEnv = ['DATABASE_URL', 'JWT_SECRET', 'JWT_EXPIRES_IN', 'FRONTEND_URL'] as const;

export function validateEnv(config: Record<string, unknown>) {
  for (const key of requiredEnv) {
    if (!config[key]) throw new Error(`Variavel de ambiente obrigatoria ausente: ${key}`);
  }

  if (String(config.JWT_SECRET).length < 32) {
    throw new Error('JWT_SECRET deve ter pelo menos 32 caracteres.');
  }

  return config;
}
