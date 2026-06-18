import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super({
      datasources: {
        db: {
          url: databaseUrl(),
        },
      },
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}

function databaseUrl() {
  const url = process.env.DATABASE_URL;
  if (!url) return undefined;

  const parsed = new URL(url);
  const poolMode = process.env.DATABASE_POOL_MODE || 'auto';
  const transactionPool =
    poolMode === 'transaction' ||
    (poolMode === 'auto' && (parsed.hostname.includes('pooler.supabase.com') || parsed.port === '6543'));

  if (!transactionPool) return parsed.toString();

  if (!parsed.searchParams.has('pgbouncer')) parsed.searchParams.set('pgbouncer', 'true');
  if (!parsed.searchParams.has('connection_limit')) parsed.searchParams.set('connection_limit', '1');
  if (!parsed.searchParams.has('statement_cache_size')) parsed.searchParams.set('statement_cache_size', '0');
  return parsed.toString();
}
