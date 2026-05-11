# Controle Transporte

Projeto para controle financeiro de uma transportadora, dividido em:

- `transportadora-api`: backend em Node.js, Express, Prisma e PostgreSQL
- `transportadora-web`: frontend ja compilado na pasta `dist`

## Pre-requisitos

Antes de rodar o projeto apos um `git clone`, instale:

- Git
- Node.js
- npm
- PostgreSQL

## 1. Clonar o repositorio

```powershell
git clone URL_DO_REPOSITORIO
```

```powershell
cd ControleTransporte\ControleTransporte
```

Troque `URL_DO_REPOSITORIO` pela URL real do repositorio.

## 2. Criar o banco de dados

No PostgreSQL, crie um banco chamado `controle_transporte`.

Se tiver o `psql` instalado, execute:

```powershell
psql -U postgres -h localhost
```

Depois, dentro do terminal do PostgreSQL, execute:

```sql
CREATE DATABASE controle_transporte;
```

Para sair do `psql`, execute:

```sql
\q
```

## 3. Configurar as variaveis de ambiente

Entre na pasta da API:

```powershell
cd transportadora-api
```

Crie um arquivo chamado `.env` dentro de `transportadora-api`.

No PowerShell, voce pode criar o arquivo com:

```powershell
New-Item -ItemType File -Name .env
```

Abra o arquivo `.env` e coloque:

```env
DATABASE_URL="postgresql://postgres:SUA_SENHA@localhost:5432/controle_transporte?schema=public"
PORT=3000
```

Troque `SUA_SENHA` pela senha do seu usuario PostgreSQL.

Exemplo:

```env
DATABASE_URL="postgresql://postgres:123456@localhost:5432/controle_transporte?schema=public"
PORT=3000
```

Caso sua senha tenha caracteres especiais, como `@`, `#`, `%`, `:` ou `/`, eles precisam ser codificados na URL.

Exemplo:

```env
DATABASE_URL="postgresql://postgres:abc%40123@localhost:5432/controle_transporte?schema=public"
PORT=3000
```

Nesse exemplo, a senha real e `abc@123`.

## 4. Instalar as dependencias da API

Dentro da pasta `transportadora-api`, rode:

```powershell
npm install
```

## 5. Criar as tabelas no banco

Ainda dentro da pasta `transportadora-api`, rode:

```powershell
npx prisma migrate dev
```

Esse comando carrega o arquivo `.env`, conecta no PostgreSQL e cria as tabelas definidas no Prisma.

Se aparecer erro de autenticacao, confira usuario e senha no `DATABASE_URL`.

## 6. Rodar a API

```powershell
npm run dev
```

A API ficara disponivel em:

```text
http://localhost:3000
```

Para testar no navegador:

```text
http://localhost:3000
http://localhost:3000/clientes
```

Para testar pelo PowerShell:

```powershell
Invoke-RestMethod http://localhost:3000/clientes
```

Para criar um cliente de teste:

```powershell
Invoke-RestMethod http://localhost:3000/clientes `
  -Method POST `
  -ContentType "application/json" `
  -Body '{"nome":"Cliente Teste"}'
```

## 7. Rodar o frontend

Abra outro terminal e entre na pasta do frontend:

```powershell
cd E:\Projetos\ControleTransporte\ControleTransporte\transportadora-web
```

Como esta pasta contem o build pronto em `dist`, rode:

```powershell
npx vite preview --host 127.0.0.1 --port 5173
```

Depois acesse:

```text
http://127.0.0.1:5173
```

Tela para controlar cavalo, carretas, dolly, motorista e historico:

```text
http://127.0.0.1:5173/conjuntos.html
```

Nessa tela, confira o campo `API`. Por padrao ele usa:

```text
http://localhost:3000
```

Se a API estiver rodando em outra porta, altere esse campo e clique em `Atualizar`.

## Rotas disponiveis na API

Atualmente, a API possui rotas para clientes:

```text
GET /clientes
POST /clientes
```

Tambem existem rotas para motoristas, veiculos e composicoes de caminhoes:

```text
GET    /motoristas
POST   /motoristas
GET    /motoristas/:id
PUT    /motoristas/:id
DELETE /motoristas/:id
```

```text
GET    /veiculos
POST   /veiculos
GET    /veiculos/:id
PUT    /veiculos/:id
DELETE /veiculos/:id
GET    /veiculos/:id/extrato
```

```text
GET    /caminhoes
POST   /caminhoes
PUT    /caminhoes/:id
DELETE /caminhoes/:id
GET    /caminhoes/:id/extrato
```

```text
GET   /composicoes-veiculos
POST  /composicoes-veiculos
PATCH /composicoes-veiculos/:id/encerrar
```

O cadastro de veiculos aceita os tipos:

```text
CAVALO
CARRETA
DOLLY
```

## Exemplo de cadastro de conjunto do caminhao

Criar um cavalo:

```powershell
Invoke-RestMethod http://localhost:3000/veiculos `
  -Method POST `
  -ContentType "application/json" `
  -Body '{"placa":"MID5390","tipo":"CAVALO","marca":"SCANIA","modelo":"CAVALO TRUCADO"}'
```

Criar duas carretas:

```powershell
Invoke-RestMethod http://localhost:3000/veiculos `
  -Method POST `
  -ContentType "application/json" `
  -Body '{"placa":"EOE1517","tipo":"CARRETA","marca":"LIBRELATO","modelo":"BASCULANTE"}'
```

```powershell
Invoke-RestMethod http://localhost:3000/veiculos `
  -Method POST `
  -ContentType "application/json" `
  -Body '{"placa":"EOE1518","tipo":"CARRETA","marca":"LIBRELATO","modelo":"BASCULANTE"}'
```

Criar um dolly:

```powershell
Invoke-RestMethod http://localhost:3000/veiculos `
  -Method POST `
  -ContentType "application/json" `
  -Body '{"placa":"DOL1234","tipo":"DOLLY","marca":"RANDON"}'
```

Criar um motorista:

```powershell
Invoke-RestMethod http://localhost:3000/motoristas `
  -Method POST `
  -ContentType "application/json" `
  -Body '{"nome":"Rafael Geraldo","telefone":"67999506729","cidade":"Fatima do Sul / MS"}'
```

Criar a composicao atual do caminhao usando as placas:

```powershell
Invoke-RestMethod http://localhost:3000/composicoes-veiculos `
  -Method POST `
  -ContentType "application/json" `
  -Body '{"cavaloPlaca":"MID5390","motoristaNome":"Rafael Geraldo","carretas":["EOE1517","EOE1518"],"dollyPlaca":"DOL1234","observacao":"Conjunto atual"}'
```

Ao criar uma nova composicao para o mesmo cavalo, a composicao anterior e encerrada automaticamente e fica salva no historico.

Consultar o extrato do caminhao:

```powershell
Invoke-RestMethod http://localhost:3000/caminhoes/1/extrato
```

O extrato retorna:

```text
caminhao
conjuntoAtual
historico
```

Tambem e possivel fazer esse fluxo pela tela:

```text
http://127.0.0.1:5173/conjuntos.html
```

Fluxo recomendado:

```text
1. Cadastrar o cavalo
2. Cadastrar as carretas
3. Cadastrar o dolly, se houver
4. Cadastrar ou selecionar o motorista
5. Montar o conjunto atual
6. Consultar o extrato do caminhao
```

O frontend aparenta chamar tambem outras rotas, como:

```text
/despesas
/faturamentos
```

Se essas rotas ainda nao estiverem implementadas no backend, algumas telas ou acoes do frontend podem apresentar erro.

## Comandos resumidos

Depois de clonar o projeto, os comandos principais sao estes.

Criar o banco:

```powershell
psql -U postgres -h localhost
```

Dentro do `psql`:

```sql
CREATE DATABASE controle_transporte;
```

```sql
\q
```

Entrar na API:

```powershell
cd E:\Projetos\ControleTransporte\ControleTransporte\transportadora-api
```

Criar o `.env`, se ainda nao existir:

```powershell
New-Item -ItemType File -Name .env
```

Instalar dependencias:

```powershell
npm install
```

Aplicar as migrations:

```powershell
npx prisma migrate dev
```

Rodar a API:

```powershell
npm run dev
```

Em outro terminal, rodar o frontend:

```powershell
cd E:\Projetos\ControleTransporte\ControleTransporte\transportadora-web
```

```powershell
npx vite preview --host 127.0.0.1 --port 5173
```
