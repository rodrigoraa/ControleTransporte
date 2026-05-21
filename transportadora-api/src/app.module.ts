import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { AcompanhamentosModule } from './acompanhamentos/acompanhamentos.module';
import { CaminhoesModule } from './caminhoes/caminhoes.module';
import { CategoriasFinanceirasModule } from './categorias-financeiras/categorias-financeiras.module';
import { ClientesModule } from './clientes/clientes.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { EngatesCarretasModule } from './engates-carretas/engates-carretas.module';
import { FornecedoresModule } from './fornecedores/fornecedores.module';
import { FuncionariosModule } from './funcionarios/funcionarios.module';
import { LancamentosFinanceirosModule } from './lancamentos-financeiros/lancamentos-financeiros.module';
import { MotoristasModule } from './motoristas/motoristas.module';
import { PrismaModule } from './common/prisma/prisma.module';
import { RelatoriosModule } from './relatorios/relatorios.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    UsersModule,
    ClientesModule,
    FuncionariosModule,
    MotoristasModule,
    CaminhoesModule,
    CategoriasFinanceirasModule,
    AcompanhamentosModule,
    EngatesCarretasModule,
    FornecedoresModule,
    LancamentosFinanceirosModule,
    DashboardModule,
    RelatoriosModule,
  ],
})
export class AppModule {}
