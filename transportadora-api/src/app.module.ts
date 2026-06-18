import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module';
import { AuditoriasModule } from './auditorias/auditorias.module';
import { CaminhoesModule } from './caminhoes/caminhoes.module';
import { CategoriasFinanceirasModule } from './categorias-financeiras/categorias-financeiras.module';
import { ClientesModule } from './clientes/clientes.module';
import { RequestLoggingInterceptor } from './common/interceptors/request-logging.interceptor';
import { PrismaModule } from './common/prisma/prisma.module';
import { validateEnv } from './config/env.validation';
import { ConjuntosModule } from './conjuntos/conjuntos.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { FornecedoresModule } from './fornecedores/fornecedores.module';
import { HealthController } from './health/health.controller';
import { ImplementosModule } from './implementos/implementos.module';
import { LancamentosFinanceirosModule } from './lancamentos-financeiros/lancamentos-financeiros.module';
import { MotoristasModule } from './motoristas/motoristas.module';
import { RelatoriosModule } from './relatorios/relatorios.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60_000,
        limit: 120,
        blockDuration: 60_000,
      },
    ]),
    PrismaModule,
    AuthModule,
    AuditoriasModule,
    UsersModule,
    ClientesModule,
    MotoristasModule,
    CaminhoesModule,
    ImplementosModule,
    ConjuntosModule,
    CategoriasFinanceirasModule,
    FornecedoresModule,
    LancamentosFinanceirosModule,
    DashboardModule,
    RelatoriosModule,
  ],
  controllers: [HealthController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: RequestLoggingInterceptor,
    },
  ],
})
export class AppModule {}
