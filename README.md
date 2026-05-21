# Controle Transporte

Sistema web para substituir planilhas de controle financeiro e operacional de uma transportadora.

## Tecnologias

- Backend: Node.js, NestJS, JWT, Prisma
- Banco de dados: PostgreSQL
- Frontend: React, Vite, React Router, Recharts
- Seguranca: bcrypt, JWT, guards e validacao com class-validator

## Estrutura

```txt
transportadora-api/   Backend NestJS
transportadora-web/   Frontend React
```

## Configuracao

1. Instale as dependencias:

```bash
npm install
```

2. Crie os arquivos de ambiente:

```bash
cp .env.example transportadora-api/.env
cp .env.example transportadora-web/.env
```

3. Ajuste `DATABASE_URL` para o seu PostgreSQL.

Exemplo:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/controle_transporte?schema=public"
JWT_SECRET="troque-esta-chave-em-producao"
JWT_EXPIRES_IN="8h"
PORT=3000
FRONTEND_URL="http://localhost:5173"
VITE_API_URL="http://localhost:3000"
```

## Banco de dados

Crie o banco no PostgreSQL:

```sql
CREATE DATABASE controle_transporte;
```

Ou suba um PostgreSQL local com Docker:

```bash
docker compose up -d postgres
```

Rode as migrations e o seed:

```bash
npm run prisma:migrate --workspace transportadora-api
npm run prisma:seed --workspace transportadora-api
```

Login inicial:

```txt
admin@transportadora.com
admin123
```

## Rodando

Backend:

```bash
npm run dev --workspace transportadora-api
```

Frontend:

```bash
npm run dev --workspace transportadora-web
```

Ou os dois juntos:

```bash
npm run dev
```

URLs:

- API: `http://localhost:3000/api`
- Frontend: `http://localhost:5173`

## Modulos

- Login, logout, JWT e usuarios com perfil `ADMIN` e `USUARIO`
- Clientes: obrigatorios `nome` e `ativo`; documento, telefone, email, endereco e observacoes opcionais
- Funcionarios: obrigatorios `nome`, `cpf` e `status`; telefone, cargo, data de admissao e observacoes opcionais
- Motoristas: obrigatorio `nome`; CPF, CNH, categoria, validade, telefone, status e observacoes opcionais
- Caminhoes / veiculos: obrigatorio `placa`; demais dados cadastrais opcionais
- Acompanhamentos de caminhao: obrigatorios caminhao, motorista, tipo de operacao e tipo de veiculo; datas sao opcionais
- Fornecedores: obrigatorio `nome`; documento, telefone, email, endereco, observacoes e ativo opcionais
- Lancamentos financeiros com calculo automatico de `valorTotal` e selecao de `unidadeQuantidade` entre `KG` e `UNIDADE`
- Dashboard com cards e graficos
- Relatorios financeiros e de acompanhamentos

## Observacoes

O frontend usa formularios CRUD genericos por configuracao para manter o codigo enxuto e facil de evoluir. O backend mantem controller, service, dto e entity/model separados por modulo.
