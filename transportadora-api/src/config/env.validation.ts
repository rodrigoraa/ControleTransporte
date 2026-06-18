const requiredEnv = ['DATABASE_URL', 'JWT_SECRET', 'JWT_EXPIRES_IN', 'FRONTEND_URL'] as const;
const nodeEnvironments = new Set(['development', 'test', 'production']);
const poolModes = new Set(['auto', 'direct', 'transaction']);

export function validateEnv(config: Record<string, unknown>) {
  for (const key of requiredEnv) {
    if (!config[key]) throw new Error(`Variavel de ambiente obrigatoria ausente: ${key}`);
  }

  const nodeEnv = String(config.NODE_ENV || 'development');
  if (!nodeEnvironments.has(nodeEnv)) {
    throw new Error('NODE_ENV deve ser development, test ou production.');
  }

  const jwtSecret = String(config.JWT_SECRET);
  const minimumSecretLength = nodeEnv === 'production' ? 64 : 32;
  if (jwtSecret.length < minimumSecretLength) {
    throw new Error(`JWT_SECRET deve ter pelo menos ${minimumSecretLength} caracteres neste ambiente.`);
  }
  if (nodeEnv === 'production' && /dev|local|example|troque|secret/i.test(jwtSecret)) {
    throw new Error('JWT_SECRET de producao nao pode usar um valor de exemplo ou desenvolvimento.');
  }

  if (!/^\d+[smhd]$/.test(String(config.JWT_EXPIRES_IN))) {
    throw new Error('JWT_EXPIRES_IN deve usar formato como 30m, 8h ou 7d.');
  }

  validateDatabaseUrl('DATABASE_URL', config.DATABASE_URL);
  if (config.DIRECT_URL) validateDatabaseUrl('DIRECT_URL', config.DIRECT_URL);

  const frontendOrigins = String(config.FRONTEND_URL)
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  if (!frontendOrigins.length) throw new Error('FRONTEND_URL deve informar ao menos uma origem.');
  for (const origin of frontendOrigins) {
    const parsed = parseUrl('FRONTEND_URL', origin);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new Error('FRONTEND_URL aceita apenas origens HTTP ou HTTPS.');
    }
    if (nodeEnv === 'production' && parsed.protocol !== 'https:' && !isLocalHost(parsed.hostname)) {
      throw new Error('FRONTEND_URL deve usar HTTPS em producao.');
    }
  }

  const port = parseInteger(config.PORT ?? 3000, 'PORT', 1, 65_535);
  const bcryptRounds = parseInteger(config.BCRYPT_ROUNDS ?? 12, 'BCRYPT_ROUNDS', 10, 15);
  const maxBodyBytes = parseInteger(config.MAX_BODY_BYTES ?? 1_048_576, 'MAX_BODY_BYTES', 1_024, 10_485_760);
  const poolMode = String(config.DATABASE_POOL_MODE || 'auto');
  if (!poolModes.has(poolMode)) {
    throw new Error('DATABASE_POOL_MODE deve ser auto, direct ou transaction.');
  }

  return {
    ...config,
    NODE_ENV: nodeEnv,
    PORT: port,
    BCRYPT_ROUNDS: bcryptRounds,
    MAX_BODY_BYTES: maxBodyBytes,
    DATABASE_POOL_MODE: poolMode,
  };
}

function validateDatabaseUrl(name: string, value: unknown) {
  const parsed = parseUrl(name, String(value));
  if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) {
    throw new Error(`${name} deve ser uma URL PostgreSQL valida.`);
  }
}

function parseUrl(name: string, value: string) {
  try {
    return new URL(value);
  } catch {
    throw new Error(`${name} possui uma URL invalida.`);
  }
}

function parseInteger(value: unknown, name: string, minimum: number, maximum: number) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(`${name} deve ser um numero inteiro entre ${minimum} e ${maximum}.`);
  }
  return parsed;
}

function isLocalHost(hostname: string) {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
}
