import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnv } from './config/env.validation';
import { AuthModule } from './auth/auth.module';
import { AuditoriasModule } from './auditorias/auditorias.module';
import { CaminhoesModule } from './caminhoes/caminhoes.module';
import { CategoriasFinanceirasModule } from './categorias-financeiras/categorias-financeiras.module';
import { ClientesModule } from './clientes/clientes.module';
import { ConjuntosModule } from './conjuntos/conjuntos.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { FornecedoresModule } from './fornecedores/fornecedores.module';
import { ImplementosModule } from './implementos/implementos.module';
import { LancamentosFinanceirosModule } from './lancamentos-financeiros/lancamentos-financeiros.module';
import { MotoristasModule } from './motoristas/motoristas.module';
import { PrismaModule } from './common/prisma/prisma.module';
import { RelatoriosModule } from './relatorios/relatorios.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
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
})
export class AppModule {}




