import { BadRequestException, ValidationError, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  const allowedOrigins = config
    .getOrThrow<string>('FRONTEND_URL')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.use(helmet());
  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
  });
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: (errors) => new BadRequestException(formatValidationErrors(errors)),
    }),
  );

  await app.listen(config.get<number>('PORT') || 3000);
}

bootstrap();

function formatValidationErrors(errors: ValidationError[], parentPath = ''): string[] {
  return errors.flatMap((error) => {
    const path = parentPath ? `${parentPath}.${error.property}` : error.property;
    const ownMessages = Object.keys(error.constraints || {}).map((constraint) => validationMessage(path, constraint, error));
    const childMessages = formatValidationErrors(error.children || [], path);
    return [...ownMessages, ...childMessages];
  });
}

function validationMessage(path: string, constraint: string, error: ValidationError) {
  const field = fieldLabel(path);

  if (constraint === 'whitelistValidation') return `${field} não é permitido neste cadastro.`;
  if (constraint === 'isNotEmpty') return `${field} é obrigatório.`;
  if (constraint === 'isString') return `${field} deve ser texto.`;
  if (constraint === 'isEmail') return `${field} deve ser um e-mail válido.`;
  if (constraint === 'isBoolean') return `${field} deve ser sim ou não.`;
  if (constraint === 'isDate') return `${field} deve ser uma data válida.`;
  if (constraint === 'isNumber') return `${field} deve ser um número válido.`;
  if (constraint === 'isInt') return `${field} deve ser um número inteiro.`;
  if (constraint === 'isArray') return `${field} deve ser uma lista.`;
  if (constraint === 'minLength') return `${field} deve ter pelo menos ${(error.constraints?.[constraint] || '').match(/\d+/)?.[0] || 'mais'} caracteres.`;
  if (constraint === 'min') return `${field} está abaixo do mínimo permitido.`;
  if (constraint === 'max') return `${field} está acima do máximo permitido.`;
  if (constraint === 'isEnum') return `${field} possui uma opção inválida. Selecione uma opção da lista.`;
  if (constraint === 'matches') return `${field} está em formato inválido.`;

  return `${field} está inválido.`;
}

function fieldLabel(path: string) {
  const implementoMatch = path.match(/^implementos\.(\d+)\.(.+)$/);
  if (implementoMatch) {
    const index = Number(implementoMatch[1]) + 1;
    return `${baseFieldLabel(implementoMatch[2])} do implemento ${index}`;
  }
  return baseFieldLabel(path.split('.').at(-1) || path);
}

function baseFieldLabel(field: string) {
  const labels: Record<string, string> = {
    ano: 'Ano',
    ativo: 'Ativo',
    capacidadeCarga: 'Capacidade de carga',
    carroceria: 'Carroceria',
    categoriaId: 'Categoria',
    categoriaCnh: 'Categoria da CNH',
    cavaloMecanicoId: 'Cavalo mecânico',
    chassi: 'Chassi',
    clienteId: 'Cliente',
    cnh: 'CNH',
    conjuntoId: 'Conjunto operacional',
    cpf: 'CPF',
    cor: 'Cor',
    data: 'Data',
    dataFinal: 'Data final',
    dataInicial: 'Data inicial',
    descricao: 'Descrição',
    documento: 'CPF/CNPJ',
    email: 'E-mail',
    endereco: 'Endereço',
    fornecedorId: 'Fornecedor',
    implementoId: 'Implemento',
    implementoIds: 'Implementos',
    justificativaSemImplemento: 'Justificativa para conjunto sem implemento',
    limit: 'Limite',
    marca: 'Marca',
    modelo: 'Modelo',
    motoristaId: 'Motorista',
    nome: 'Nome',
    observacoes: 'Observações',
    orderBy: 'Ordenação',
    orderDirection: 'Direção da ordenação',
    page: 'Página',
    perfil: 'Perfil',
    placa: 'Placa',
    quantidade: 'Quantidade',
    quantidadeEixos: 'Quantidade de eixos',
    quantidadeTotalEixos: 'Quantidade total de eixos',
    renavam: 'Renavam',
    search: 'Busca',
    senha: 'Senha',
    status: 'Status',
    telefone: 'Telefone',
    tipo: 'Tipo',
    tipoCavalo: 'Tipo do cavalo',
    tipoConjunto: 'Tipo de conjunto',
    tipoLancamento: 'Tipo financeiro',
    unidadeQuantidade: 'Unidade da quantidade',
    validadeCnh: 'Validade da CNH',
    valorUnitario: 'Valor unitário',
  };
  return labels[field] || field;
}




