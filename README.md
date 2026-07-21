# Controle Transporte

Sistema web para controle financeiro, operacional e cadastral de uma transportadora. A aplicação substitui planilhas e organiza clientes, fornecedores, motoristas, frota, conjuntos operacionais, despesas, faturamento, dashboard, relatórios e auditoria.

## Índice

- [O que o sistema faz](#o-que-o-sistema-faz)
- [Visão operacional](#visão-operacional)
- [Exemplos reais](#exemplos-reais)
- [Fluxo operacional](#fluxo-operacional)
- [Tecnologias](#tecnologias)
- [Configuração](#configuração)
- [Telas do frontend](#telas-do-frontend)
- [Backend](#backend)
- [Banco e modelo operacional de frota](#banco-e-modelo-operacional-de-frota)
- [Relatórios e exportações](#relatórios-e-exportações)
- [Documentação técnica](#documentação-técnica)
- [Produção](#produção)
- [Melhorias futuras](#melhorias-futuras)

## O que o sistema faz

O sistema centraliza a operação da transportadora em uma aplicação com backend NestJS, frontend React e banco PostgreSQL. Ele permite:

- Gerenciar clientes, fornecedores, motoristas e usuários.
- Cadastrar a frota de forma realista, separando cavalo mecânico, implemento e conjunto operacional.
- Registrar despesas e faturamento vinculados a motorista, cavalo mecânico, conjunto operacional, implemento, fornecedor, cliente e categoria financeira.
- Calcular automaticamente valores financeiros.
- Consultar dashboard com indicadores financeiros e operacionais.
- Gerar relatórios com filtros por período, cavalo, implemento, conjunto, tipo de conjunto, quantidade de eixos, motorista, fornecedor, cliente, categoria e tipo financeiro.
- Exportar relatórios em CSV/Excel e PDF.
- Registrar auditoria de operações importantes.
- Controlar permissões por perfil `ADMIN` e `USUARIO`.

## Visão operacional

Em uma transportadora real, a operação não depende apenas de um "caminhão" genérico. A composição usada em uma viagem pode mudar conforme carga, rota, tipo de carroceria, capacidade, quantidade de eixos, motorista e disponibilidade da frota.

O sistema foi estruturado para refletir essa realidade:

```txt
Motorista dirige um cavalo mecânico
Cavalo mecânico traciona um ou mais implementos
Implementos formam um conjunto operacional
Conjunto operacional gera despesas, faturamento e relatórios
```

### Cavalo mecânico

É o veículo trator. Ele possui motor, cabine e quinta-roda, e puxa um semirreboque, carreta ou composição maior.

Exemplos:

- Volvo FH 540.
- Scania R 440.
- Mercedes-Benz Actros.
- DAF XF.

No sistema, o cavalo mecânico tem placa, marca, modelo, ano, chassi, renavam, cor, status e motorista atual.

### Implemento

É o equipamento rebocado ou semirrebocado pelo cavalo mecânico. Pode ser usado para carga seca, grãos, combustível, máquinas, paletes, minério, entre outros.

Tipos cadastrados:

| Tipo | Explicação |
| --- | --- |
| `CARRETA` | Implemento rebocado usado para transporte de carga. No uso comum, muitas empresas chamam genericamente qualquer implemento de carreta. |
| `SEMIRREBOQUE` | Implemento que apoia parte do peso no cavalo mecânico por meio da quinta-roda. Muito comum em cavalos mecânicos. |
| `REBOQUE` | Implemento que possui eixo dianteiro e traseiro, rebocado por outro veículo. |
| `DOLLY` | Equipamento intermediário com eixos usado para ligar um semirreboque a outro, comum em rodotrens. |

Carrocerias cadastradas:

| Carroceria | Uso comum |
| --- | --- |
| `BAU` | Carga seca protegida. |
| `GRANELEIRO` | Grãos, insumos agrícolas e carga a granel. |
| `SIDER` | Cargas paletizadas com abertura lateral. |
| `TANQUE` | Líquidos, combustíveis ou produtos específicos. |
| `PRANCHA` | Máquinas e cargas especiais. |
| `OUTRO` | Casos não classificados. |

### O que é carreta

Na linguagem operacional, "carreta" costuma ser usada como nome genérico para o implemento de carga. Tecnicamente, pode se referir a um semirreboque ou reboque, dependendo da composição. Por isso o sistema separa `tipo` e `carroceria`, evitando tratar tudo como um único "caminhão".

### O que é semirreboque

O semirreboque não se sustenta totalmente sozinho em operação: parte de seu peso fica apoiada no cavalo mecânico. Ele é muito usado em conjuntos simples, bitrens e rodotrens.

### O que é dolly

O dolly é uma estrutura com eixos e engate que permite conectar outro semirreboque em uma composição. Ele não transporta carga principal, mas conta na quantidade de eixos e faz parte da configuração operacional.

### O que é bitrem

Bitrem é uma composição normalmente formada por:

```txt
Cavalo mecânico + 1ª carreta + 2ª carreta
```

No sistema, o bitrem aparece como um `Conjunto operacional` com tipo `BITREM`, um cavalo mecânico e dois implementos. A ordem correta dos implementos é: 1ª carreta e 2ª carreta.

### O que é rodotrem

Rodotrem é uma composição maior, normalmente formada por:

```txt
Cavalo mecânico + 1ª carreta + dolly + 2ª carreta
```

No sistema, o rodotrem aparece como um `Conjunto operacional` com tipo `RODOTREM`, um cavalo mecânico e implementos vinculados. A ordem correta dos implementos é: 1ª carreta, dolly e 2ª carreta.

### Diferença entre 7 eixos e 9 eixos

A quantidade de eixos influencia capacidade, enquadramento operacional, restrições de rota, pedágio, custo, manutenção e análise financeira.

| Composição | Exemplo operacional | Impacto no sistema |
| --- | --- | --- |
| 7 eixos | Cavalo + 1ª carreta + 2ª carreta | Pode ser classificado como bitrem. O sistema valida a composição sem dolly. |
| 9 eixos | Cavalo + 1ª carreta + dolly + 2ª carreta | Pode ser classificado como rodotrem. O sistema valida a presença do dolly. |

No sistema, a quantidade total de eixos e a capacidade total do conjunto são calculadas automaticamente a partir dos implementos. Isso evita erro manual e permite relatórios por tipo de composição.

## Exemplos reais

### Exemplo 1: Cavalo Volvo FH com bitrem 7 eixos

Operação:

```txt
Cavalo mecânico:
  Placa: ABC1D23
  Marca/modelo: Volvo FH 540
  Motorista atual: Carlos Almeida

Implementos:
  1. 1ª carreta / semirreboque graneleiro CAR1A01 - 2 eixos - 32.000 kg
  2. 2ª carreta / semirreboque graneleiro CAR1A02 - 2 eixos - 32.000 kg

Conjunto operacional:
  Nome gerado: ABC1D23 - Volvo
  Tipo identificado: BITREM
  Total de eixos dos implementos: 4 (7 com o cavalo)
  Capacidade total: 64.000 kg
```

Como aparece no sistema:

| Tela | Registro |
| --- | --- |
| Cavalos mecânicos | Volvo FH 540, placa ABC1D23, motorista Carlos Almeida |
| Implementos | CAR1A01 e CAR1A02 como semirreboques graneleiros |
| Conjuntos operacionais | Bitrem graneleiro 7 eixos com o cavalo e os dois implementos |
| Despesas | Abastecimento, pneus ou manutenção vinculados ao cavalo/conjunto |
| Faturamento | Frete do cliente vinculado ao conjunto operacional |
| Relatórios | Filtro por cavalo, conjunto, tipo `BITREM` ou quantidade de eixos |

Payload de exemplo para criar um conjunto:

```json
{
  "cavaloMecanicoId": "id-do-cavalo-volvo",
  "implementoIds": ["id-car1a01", "id-car1a02"],
  "status": "ATIVO",
  "observacoes": "Composição para transporte de grãos"
}
```

### Exemplo 2: Rodotrem 9 eixos com dolly

Operação:

```txt
Cavalo mecânico:
  Placa: MID5J90
  Marca/modelo: Scania R 440

Implementos:
  1. 1ª carreta / semirreboque sider CAR1A03 - 3 eixos - 30.000 kg
  2. Dolly DLY1A02 - 2 eixos - 0 kg de carga
  3. 2ª carreta / semirreboque sider CAR1A04 - 3 eixos - 30.000 kg

Conjunto operacional:
  Nome gerado: MID5J90 - Scania
  Tipo identificado: RODOTREM
  Capacidade total: 60.000 kg
```

Como aparece no sistema:

| Tela | Registro |
| --- | --- |
| Implementos | O dolly aparece como implemento tipo `DOLLY` |
| Conjuntos operacionais | O rodotrem vincula cavalo, dois semirreboques e dolly |
| Dashboard | Conta como conjunto ativo por tipo `RODOTREM` |
| Relatórios | Pode ser filtrado por tipo `RODOTREM`, implemento dolly ou quantidade de eixos |

Payload de exemplo para lançar faturamento:

```json
{
  "data": "2026-05-22",
  "placa": "MID5J90",
  "cavaloMecanicoId": "id-do-cavalo-scania",
  "conjuntoId": "id-do-rodotrem",
  "motoristaId": "id-do-motorista",
  "clienteId": "id-do-cliente",
  "categoriaId": "id-categoria-frete",
  "tipoLancamento": "FATURAMENTO",
  "descricao": "Frete de carga paletizada",
  "quantidade": 32,
  "unidadeQuantidade": "KG",
  "valorUnitario": 210
}
```

## Fluxo operacional

O fluxo recomendado para usar o sistema em uma operação real é:

### 1. Cadastro de motorista

Cadastre o motorista com nome, CPF, CNH, categoria, validade da CNH, telefone e status. Esse cadastro será usado no cavalo mecânico e nos lançamentos financeiros.

### 2. Cadastro de cavalo mecânico

Cadastre o cavalo mecânico com placa, marca, modelo, ano, renavam, chassi, cor, status e motorista atual. O cavalo é o veículo trator da operação.

### 3. Cadastro de implementos

Cadastre carretas, semirreboques, reboques e dollies. Informe tipo, carroceria, quantidade de eixos e capacidade de carga.

### 4. Criação de conjunto operacional

Crie uma composição selecionando:

- Um cavalo mecânico.
- Um ou mais implementos.

O sistema gera automaticamente o nome do conjunto usando placa e marca do cavalo mecânico. O sistema também identifica automaticamente se a composição é simples, bitrem 7 eixos ou rodotrem 9 eixos, além de calcular total de eixos e capacidade total.

Para conjuntos com duas ou mais carretas, selecione os implementos na ordem operacional:

| Tipo | Ordem esperada |
| --- | --- |
| Bitrem 7 eixos | 1ª carreta, 2ª carreta |
| Rodotrem 9 eixos | 1ª carreta, dolly, 2ª carreta |

### 5. Lançamento de despesas

Registre despesas como combustível, pneus, manutenção, lavagem, seguro ou borracharia. A despesa deve ter fornecedor e pode ser vinculada a cavalo, conjunto e implemento.

### 6. Lançamento de faturamento

Registre o faturamento do frete ou serviço. O faturamento deve ter cliente e pode ser vinculado ao conjunto operacional usado na viagem.

### 7. Geração de relatórios

Use os filtros para analisar o desempenho:

- Por período.
- Por cavalo mecânico.
- Por implemento.
- Por conjunto operacional.
- Por tipo de conjunto.
- Por motorista.
- Por cliente ou fornecedor.
- Por categoria financeira.

## Tecnologias

- Backend: Node.js, NestJS, Prisma, JWT, class-validator.
- Banco de dados: PostgreSQL.
- Frontend: React, Vite, React Router, Recharts, Axios.
- Segurança: bcrypt, JWT, guards de autenticação e autorização.
- Monorepo: npm workspaces.

## Estrutura do projeto

```txt
ControleTransporte/
  transportadora-api/   Backend NestJS
  transportadora-web/   Frontend React/Vite
  docker-compose.yml    PostgreSQL local
  package.json          Scripts raiz do monorepo
```

## Como as partes se comunicam

1. O usuário acessa o frontend em `http://localhost:5173`.
2. O frontend envia requisições HTTP para a API em `http://localhost:3000/api`.
3. A API autentica o usuário com JWT.
4. Controllers do NestJS recebem as requisições.
5. DTOs validam os dados de entrada.
6. Services aplicam regras de negócio.
7. Prisma consulta ou altera o PostgreSQL.
8. A API retorna JSON, CSV ou PDF para o frontend.
9. O frontend renderiza telas, tabelas, formulários, gráficos e mensagens de erro/sucesso.

Fluxo resumido:

```txt
React/Vite -> Axios -> NestJS Controller -> Service -> Prisma -> PostgreSQL
```

## Configuração

Instale as dependências:

```bash
npm install
```

Crie os arquivos de ambiente:

```bash
cp .env.example transportadora-api/.env
cp .env.example transportadora-web/.env
```

Exemplo de variáveis:

```env
DATABASE_URL="postgresql://postgres:SUA_SENHA_LOCAL@localhost:5433/controle_transporte?schema=public"
DIRECT_URL="postgresql://postgres:SUA_SENHA_LOCAL@localhost:5433/controle_transporte?schema=public"
JWT_SECRET="dev-local-controle-transporte-jwt-secret-32"
JWT_EXPIRES_IN="8h"
PORT=3000
FRONTEND_URL="http://localhost:5173"
VITE_API_URL="http://localhost:3000"
VITE_BASE_PATH="/"
ADMIN_NAME="Administrador"
ADMIN_EMAIL="admin@transportadora.com"
ADMIN_PASSWORD="troque-esta-senha-local"
```

## Banco de dados

Suba um PostgreSQL local com Docker:

```bash
docker compose up -d postgres
```

Ou crie o banco manualmente:

```sql
CREATE DATABASE controle_transporte;
```

Rode migrations, gere o Prisma Client e execute o seed:

```bash
npm run prisma:migrate --workspace transportadora-api
npm run prisma:generate --workspace transportadora-api
npm run prisma:seed --workspace transportadora-api
```

Login inicial criado pelo seed:

```txt
ADMIN_EMAIL
ADMIN_PASSWORD
```

Defina `ADMIN_EMAIL` e `ADMIN_PASSWORD` no `.env` antes de executar o seed. Não use senha padrão em produção.

## Rodando o sistema

Rodar backend e frontend juntos:

```bash
npm run dev
```

Rodar apenas o backend:

```bash
npm run dev --workspace transportadora-api
```

Rodar apenas o frontend:

```bash
npm run dev --workspace transportadora-web
```

URLs:

- Frontend: `http://localhost:5173`
- API: `http://localhost:3000/api`

## Build e testes

Build completo:

```bash
npm run build
```

Testes completos:

```bash
npm run test
```

Build por workspace:

```bash
npm run build --workspace transportadora-api
npm run build --workspace transportadora-web
```

Testes por workspace:

```bash
npm run test --workspace transportadora-api
npm run test --workspace transportadora-web
```

## Perfis e permissões

### ADMIN

Pode:

- Visualizar todas as telas.
- Criar, editar e excluir cadastros.
- Gerenciar usuários.
- Consultar auditoria.
- Gerar e exportar relatórios.
- Acessar dashboard.

### USUARIO

Pode:

- Visualizar cadastros.
- Visualizar dashboard.
- Gerar e exportar relatórios.

Não pode:

- Criar, editar ou excluir registros.
- Gerenciar usuários.
- Consultar auditoria administrativa.

## Telas do frontend

### Login

Tela inicial de autenticação. O usuário informa email e senha. O frontend envia as credenciais para `/api/auth/login`. A API valida a senha com bcrypt, gera um JWT e retorna os dados do usuário autenticado.

### Dashboard

Mostra resumo financeiro e operacional:

- Total faturado no mês.
- Total de despesas no mês.
- Saldo do mês.
- Cavalos mecânicos ativos.
- Implementos ativos.
- Conjuntos operacionais ativos.
- Itens inativos ou em manutenção.
- Motoristas ativos.
- Gráfico de despesas por categoria.
- Gráfico de conjuntos por tipo.
- Comparativo mensal de faturamento e despesas.
- Últimos lançamentos.

Dados consumidos de `/api/dashboard`.

Como interpretar:

| Indicador | Interpretação |
| --- | --- |
| Total faturado no mês | Receita bruta registrada em lançamentos de faturamento no mês atual. |
| Total de despesas no mês | Soma das despesas registradas no mês atual. |
| Saldo do mês | Faturamento menos despesas. Não substitui DRE contábil, mas ajuda no controle operacional. |
| Cavalos mecânicos ativos | Quantidade de tratores disponíveis para operação. |
| Implementos ativos | Quantidade de carretas, semirreboques, reboques e dollies disponíveis. |
| Conjuntos ativos | Quantidade de composições operacionais cadastradas como ativas. |
| Itens inativos ou em manutenção | Frota ou implementos fora da operação. |
| Motoristas ativos | Motoristas disponíveis para operação. |

Gráficos:

- Despesas por categoria: ajuda a identificar maiores centros de custo.
- Conjuntos por tipo: mostra distribuição entre simples, bitrem, rodotrem e outros.
- Comparativo faturamento x despesas: ajuda a perceber meses com maior margem ou maior pressão de custos.

### Clientes

Cadastro de clientes atendidos pela transportadora.

Campos principais:

- Nome.
- CPF/CNPJ.
- Telefone.
- Email.
- Endereço.
- Observações.
- Ativo.

Usado em lançamentos de faturamento e relatórios.

### Motoristas

Cadastro de motoristas da transportadora.

Campos principais:

- Nome.
- CPF.
- CNH.
- Categoria da CNH.
- Validade da CNH.
- Telefone.
- Status.
- Observações.

Motoristas podem ser vinculados a cavalos mecânicos e lançamentos financeiros.

### Cavalos mecânicos

Representa o veículo trator da composição.

Campos principais:

- Placa.
- Marca.
- Modelo.
- Ano.
- Motorista atual.
- Cor.
- Chassi.
- Renavam.
- Status: ativo, inativo ou manutenção.
- Observações.

A rota do frontend permanece em `/caminhoes` por compatibilidade, mas o conceito operacional exibido e usado pelo sistema é `Cavalo mecânico`.

Regras:

- Placa única.
- Placa validada no formato brasileiro antigo ou Mercosul.
- Chassi único quando informado.
- Renavam único quando informado.
- Alterações geram histórico.

### Implementos

Representa carreta, semirreboque, reboque ou dolly.

Campos principais:

- Placa, quando existir.
- Tipo: carreta, semirreboque, reboque ou dolly.
- Carroceria: baú, graneleiro, sider, tanque, prancha ou outro.
- Quantidade de eixos.
- Capacidade de carga.
- Status: ativo, inativo ou manutenção.
- Observações.

Regras:

- Placa única quando informada.
- Placa validada no formato brasileiro antigo ou Mercosul.
- Quantidade de eixos obrigatória.
- Capacidade de carga obrigatória.
- Alterações geram histórico.

### Conjuntos operacionais

Representa a composição usada na viagem ou operação.

Exemplos:

- Cavalo + carreta.
- Bitrem.
- Rodotrem.
- Cavalo + dolly + carreta.

Campos principais:

- Nome do conjunto, gerado automaticamente.
- Tipo, identificado automaticamente como simples, bitrem, rodotrem ou outro.
- Cavalo mecânico.
- Implementos vinculados.
- Quantidade total de eixos.
- Capacidade total.
- Status.
- Justificativa para conjunto sem implemento.
- Observações.

Regras:

- Não permite conjunto sem cavalo mecânico.
- Não permite conjunto sem implemento, exceto com justificativa.
- Nome do conjunto é gerado automaticamente pela placa e marca do cavalo mecânico.
- Tipo do conjunto é identificado automaticamente pela composição.
- Total de eixos e capacidade total são calculados automaticamente com base nos implementos.
- Um cavalo pode trocar de composição.
- Um implemento pode trocar de composição.
- Alterações de composição geram histórico.

### Fornecedores

Cadastro de fornecedores da transportadora.

Campos principais:

- Nome.
- CPF/CNPJ.
- Telefone.
- Email.
- Endereço.
- Observações.
- Ativo.

Usado principalmente em despesas.

### Categorias financeiras

Classifica despesas e faturamentos.

Campos principais:

- Nome.
- Tipo do lançamento: despesa ou faturamento.
- Ativo.
- Observações.

Exemplos:

- Combustível.
- Manutenção.
- Pneus.
- Frete.
- Serviço extra.

### Despesas

Tela de lançamentos financeiros do tipo `DESPESA`.

Campos principais:

- Data.
- Placa do cavalo mecânico.
- Cavalo mecânico.
- Conjunto operacional.
- Implemento vinculado, quando a despesa for especifica de uma carreta/dolly.
- Motorista.
- Fornecedor.
- Categoria.
- Descrição.
- Quantidade.
- Unidade: KG ou unidade.
- Valor unitário.
- Valor total calculado automaticamente.
- Opção marcada por padrão para multiplicar quantidade pelo valor unitário; ao desmarcar, o valor unitário passa a ser o total do lançamento.
- Observações.

Regras:

- Despesa exige fornecedor.
- Despesa não usa cliente.
- Valor total = quantidade x valor unitário.
- Pode ser filtrada em relatórios por frota, pessoa, período, categoria e tipo.

### Faturamento

Tela de lançamentos financeiros do tipo `FATURAMENTO`.

Campos principais:

- Data.
- Placa do cavalo mecânico.
- Cavalo mecânico.
- Conjunto operacional.
- Implemento vinculado, quando aplicável.
- Motorista.
- Cliente.
- Categoria.
- Descrição.
- Quantidade.
- Unidade.
- Valor unitário.
- Valor total calculado automaticamente.
- Observações.

Regras:

- Faturamento exige cliente.
- Faturamento não usa fornecedor.
- Valor total = quantidade x valor unitário.

### Usuários

Tela administrativa para gerenciar usuários do sistema.

Campos principais:

- Nome.
- Email.
- Senha.
- Perfil: ADMIN ou USUARIO.
- Ativo.

Disponível apenas para `ADMIN`.

### Auditoria

Tela administrativa para consultar registros de auditoria.

Mostra:

- Data.
- Entidade.
- ID do registro.
- Ação.
- Usuário, quando informado.
- Dados anteriores.
- Dados novos.

Disponível apenas para `ADMIN`.

### Relatórios

Tela de consulta financeira com filtros operacionais e exportação.

Filtros disponíveis:

- Data inicial.
- Data final.
- Motorista.
- Cavalo mecânico.
- Implemento.
- Conjunto operacional.
- Tipo de conjunto.
- Quantidade de eixos.
- Placa.
- Fornecedor.
- Cliente.
- Tipo financeiro: despesa ou faturamento.
- Categoria.
- Ordenação por data ou valor total.
- Direcao crescente ou decrescente.

Resultados exibidos:

- Total de despesas.
- Total de faturamento.
- Saldo final.
- Histórico de lançamentos.
- Despesas por cavalo mecânico.
- Despesas por motorista.
- Faturamento por cavalo mecânico.
- Faturamento por motorista.

Exportações:

- CSV/Excel.
- PDF.

Relatórios vazios mostram mensagem informando que nenhum lançamento foi encontrado para os filtros aplicados.

Como interpretar os relatórios:

| Campo | Como usar |
| --- | --- |
| Total de despesas | Mostra o custo filtrado. Pode ser por período, cavalo, conjunto, motorista, fornecedor ou categoria. |
| Total de faturamento | Mostra a receita filtrada. Pode ser por cliente, conjunto, motorista, cavalo ou período. |
| Saldo final | Diferença entre faturamento e despesas dentro dos filtros aplicados. |
| Histórico de lançamentos | Lista detalhada das movimentações que compõem os totais. |
| Despesas por cavalo mecânico | Ajuda a identificar cavalos com maior custo. |
| Faturamento por cavalo mecânico | Ajuda a identificar cavalos com maior geração de receita. |
| Despesas por motorista | Pode indicar concentração de custos por operação/motorista. |
| Faturamento por motorista | Ajuda a analisar produtividade operacional. |

Exemplos de análise financeira:

```txt
Pergunta: Qual conjunto gerou mais faturamento no mes?
Filtro: dataInicial + dataFinal + conjunto operacional
Análise: comparar faturamento total com despesas do mesmo período.
```

```txt
Pergunta: Um bitrem esta dando lucro?
Filtro: tipoConjunto=BITREM, período desejado
Análise: verificar saldo final e detalhar despesas por categoria.
```

```txt
Pergunta: Um implemento específico está gerando muita manutenção?
Filtro: implementoId + categoria Manutenção/Pneus
Análise: comparar despesas do implemento com faturamento dos conjuntos em que ele aparece.
```

Exemplo de filtros pela API:

```http
GET /api/relatorios/financeiros?dataInicial=2026-05-01&dataFinal=2026-05-31&tipoConjunto=BITREM&orderBy=valorTotal&orderDirection=desc
```

Exemplo de resposta resumida:

```json
{
  "totalDespesas": 88023.44,
  "totalFaturamento": 387150,
  "saldoFinal": 299126.56,
  "total": 96,
  "page": 1,
  "limit": 50,
  "historico": []
}
```

## Backend

O backend fica em `transportadora-api`.

Principais modulos:

- `auth`: login, JWT, recuperação de senha e usuário autenticado.
- `users`: usuários e perfis.
- `clientes`: cadastro de clientes.
- `fornecedores`: cadastro de fornecedores.
- `motoristas`: cadastro de motoristas e histórico.
- `caminhoes`: rota de compatibilidade que opera cavalos mecânicos.
- `implementos`: cadastro de implementos.
- `conjuntos`: cadastro de conjuntos operacionais.
- `categorias-financeiras`: categorias de despesa/faturamento.
- `lancamentos-financeiros`: despesas e faturamento.
- `dashboard`: indicadores e gráficos.
- `relatorios`: consultas financeiras e exportações.
- `auditorias`: rastreio de operações.
- `common`: Prisma, CRUD genérico, decorators e guards.

Fluxo interno padrão de um módulo:

```txt
Controller
  recebe HTTP, lê parâmetros e body

DTO
  valida dados, tipos, enums e campos obrigatórios

Service
  aplica regras de negócio e chama Prisma

Prisma
  executa consultas e gravações no PostgreSQL

Auditoria/Histórico
  registra alterações relevantes
```

## Banco e modelo operacional de frota

### Cavalo mecânico

Tabela: `cavalos_mecanicos`.

Representa o trator. Pode estar vinculado a motorista e a conjuntos operacionais.

### Implemento

Tabela: `implementos`.

Representa carreta, semirreboque, reboque ou dolly.

### Conjunto operacional

Tabela: `conjuntos`.

Representa a composição operacional usada nos lançamentos e relatórios.

Relacionamento com implementos:

```txt
conjuntos -> conjuntos_implementos -> implementos
```

### Lançamento financeiro

Tabela: `lancamentos_financeiros`.

Pode apontar para:

- Motorista.
- Cavalo mecânico.
- Conjunto operacional.
- Implemento.
- Fornecedor, em despesas.
- Cliente, em faturamento.
- Categoria financeira.

## Documentação técnica

### Diagrama textual das entidades

```txt
User
  id
  nome
  email
  perfil
  ativo

Motorista
  id
  nome
  cpf
  cnh
  status
  -> CavalosMecanicos
  -> LancamentosFinanceiros

CavaloMecanico
  id
  placa
  marca/modelo/ano
  motoristaId
  status
  -> Motorista
  -> Conjuntos
  -> LancamentosFinanceiros
  -> HistoricoCavaloMecanico

Implemento
  id
  placa
  tipo
  carroceria
  quantidadeEixos
  capacidadeCarga
  status
  -> ConjuntoImplemento
  -> LancamentosFinanceiros
  -> HistoricoImplemento

Conjunto
  id
  nome
  tipo
  cavaloMecanicoId
  quantidadeTotalEixos
  capacidadeTotal
  status
  -> CavaloMecanico
  -> ConjuntoImplemento
  -> LancamentosFinanceiros
  -> HistoricoConjuntoOperacional

ConjuntoImplemento
  conjuntoId
  implementoId
  ordem

LancamentoFinanceiro
  data
  tipoLancamento
  motoristaId
  cavaloMecanicoId
  conjuntoId
  implementoId
  fornecedorId
  clienteId
  categoriaId
  quantidade
  valorUnitario
  valorTotal
```

### Relacionamento entre tabelas

```txt
motoristas 1:N cavalos_mecanicos
cavalos_mecanicos 1:N conjuntos
conjuntos N:N implementos via conjuntos_implementos
motoristas 1:N lancamentos_financeiros
cavalos_mecanicos 1:N lancamentos_financeiros
conjuntos 1:N lancamentos_financeiros
implementos 1:N lancamentos_financeiros
fornecedores 1:N lancamentos_financeiros
clientes 1:N lancamentos_financeiros
categorias_financeiras 1:N lancamentos_financeiros
```

Diagrama ASCII simplificado:

```txt
              +----------------+
              |   Motorista    |
              +-------+--------+
                      |
                      v
+----------------+   1:N   +-------------------+
| CavaloMecanico | ------> |     Conjunto      |
+-------+--------+        +---------+---------+
        |                           |
        |                           | N:N
        |                           v
        |                 +-------------------+
        |                 |    Implemento     |
        |                 +-------------------+
        |
        v
+-----------------------+
| LancamentoFinanceiro  |
+-----------------------+
        ^
        |
+-------+--------+     +---------+---------+
|  Fornecedor    |     |      Cliente      |
+----------------+     +-------------------+
```

### Fluxo frontend -> backend -> banco

```txt
1. Usuário preenche formulário no React.
2. React chama a API usando Axios.
3. Axios envia JWT no header Authorization.
4. JwtAuthGuard valida o token.
5. RolesGuard verifica permissão quando necessário.
6. Controller recebe requisicao.
7. ValidationPipe valida DTO.
8. Service aplica regras.
9. Prisma executa transação ou query.
10. PostgreSQL retorna dados.
11. API responde JSON/CSV/PDF.
12. Frontend atualiza tabela, gráfico, toast ou download.
```

### Autenticação JWT

O login acontece em:

```http
POST /api/auth/login
```

Payload:

```json
{
  "email": "admin@transportadora.com",
  "senha": "senha-configurada-no-seed"
}
```

Resposta:

```json
{
  "accessToken": "jwt-gerado-pela-api",
  "user": {
    "id": "uuid",
    "nome": "Administrador",
    "email": "admin@transportadora.com",
    "perfil": "ADMIN"
  }
}
```

Nas chamadas autenticadas, o frontend envia:

```http
Authorization: Bearer jwt-gerado-pela-api
```

### Permissões técnicas

As permissões são aplicadas por guards:

- `JwtAuthGuard`: exige usuário autenticado.
- `RolesGuard`: exige perfil específico quando o endpoint é restrito.
- `@Roles(PerfilUsuario.ADMIN)`: usado em criação, edição, exclusão, usuários e auditoria.

### Auditoria

A auditoria registra a entidade alterada, ação, ID do registro, usuário quando disponível, dados anteriores e dados novos.

Exemplo conceitual:

```json
{
  "entidade": "conjunto",
  "entidadeId": "uuid-do-conjunto",
  "acao": "ATUALIZACAO",
  "dadosAntes": {
    "tipo": "SIMPLES"
  },
  "dadosDepois": {
    "tipo": "BITREM"
  }
}
```

Históricos específicos complementam a auditoria para alterações de cavalo mecânico, implemento, conjunto operacional e motorista.

## Regras de negócio principais

- Despesa deve ter fornecedor.
- Faturamento deve ter cliente.
- Valor total financeiro é calculado automaticamente.
- Cavalo mecânico exige placa válida e única.
- Implemento com placa exige placa válida e única.
- Conjunto operacional exige cavalo mecânico.
- Conjunto operacional exige pelo menos um implemento, salvo justificativa.
- Quantidade total de eixos do conjunto é calculada automaticamente.
- Capacidade total do conjunto é calculada automaticamente.
- Alterações relevantes geram auditoria e/ou histórico.
- Exclusoes com vínculos são bloqueadas pelo backend.

## Relatórios e exportações

Endpoint de opções:

```http
GET /api/relatorios/opcoes
```

Endpoint financeiro:

```http
GET /api/relatorios/financeiros
```

Exportar CSV:

```http
GET /api/relatorios/financeiros/exportar.csv
```

Exportar PDF:

```http
GET /api/relatorios/financeiros/exportar.pdf
```

Parametros aceitos:

- `dataInicial`
- `dataFinal`
- `motoristaId`
- `cavaloMecanicoId`
- `implementoId`
- `conjuntoId`
- `fornecedorId`
- `clienteId`
- `categoriaId`
- `tipoLancamento`
- `tipoConjunto`
- `quantidadeEixos`
- `placa`
- `page`
- `limit`
- `orderBy`
- `orderDirection`

O backend valida os parâmetros com DTO. Parâmetros inválidos retornam erro `400`.

O filtro por implemento considera:

- Lançamentos diretamente vinculados ao implemento.
- Lançamentos vinculados a conjuntos que contem o implemento.

## Auditoria e históricos

O sistema registra auditoria de criação, atualização e exclusão em cadastros operacionais. Também existem históricos específicos para:

- Motoristas.
- Cavalos mecânicos.
- Implementos.
- Conjuntos operacionais.

A auditoria ajuda a rastrear quem alterou registros e quais dados mudaram.

## Frontend

O frontend fica em `transportadora-web`.

Ele usa:

- `AuthContext` para guardar usuário autenticado e token.
- `api.ts` para configurar Axios.
- `AppLayout` para menu, topo e controle de acesso visual.
- `CrudPage` para telas CRUD genéricas configuradas em `resources.ts`.
- Páginas específicas para dashboard, login e relatórios.

As telas CRUD usam uma configuração de campos. Cada campo define:

- Nome.
- Label.
- Tipo.
- Se aparece na tabela.
- Se é obrigatório.
- Relacionamento com outro endpoint.
- Máscara, quando aplicável.

Isso reduz duplicação de formulários e tabelas.

## Seed

O seed cria dados de exemplo:

- Usuários ADMIN e USUARIO.
- Clientes.
- Fornecedores.
- Motoristas.
- Cavalos mecânicos.
- Implementos.
- Conjuntos operacionais.
- Categorias financeiras.
- Lançamentos de despesas e faturamento.

Também cria massa suficiente para testar dashboard e relatórios.

## Migração de dados legados

A estrutura nova preserva dados antigos e migra o que for possível:

- Registros antigos de `caminhoes` são mapeados para `cavalos_mecanicos`.
- Placas antigas em conjuntos são usadas para criar implementos quando possível.
- Conjuntos antigos recebem cavalo mecânico quando era possível inferir a relação.
- Lançamentos antigos recebem vínculo com cavalo mecânico e conjunto quando possível.

Quando algum dado antigo não tem informação suficiente, o sistema usa valores seguros e deixa observações para revisão manual.

## Validações importantes

- Placa: aceita formato brasileiro antigo e Mercosul.
- Datas de relatório: formato ISO de data.
- Enums: tipos financeiros, status, tipo de implemento, carroceria e tipo de conjunto são validados.
- Paginação: `page` mínimo 1, `limit` entre 1 e 500.
- Ordenação: apenas campos permitidos.

## Comandos uteis

Instalar dependências:

```bash
npm install
```

Subir banco:

```bash
docker compose up -d postgres
```

Rodar migrations:

```bash
npm run prisma:migrate --workspace transportadora-api
```

Gerar Prisma Client:

```bash
npm run prisma:generate --workspace transportadora-api
```

Rodar seed:

```bash
npm run prisma:seed --workspace transportadora-api
```

Rodar aplicação:

```bash
npm run dev
```

Build:

```bash
npm run build
```

Testes:

```bash
npm run test
```

## Produção

Está secao resume cuidados para colocar o sistema em ambiente real de transportadora.

### O que já está preparado

- API com Fastify, headers de segurança, CORS restrito e limite de corpo.
- Rate limit global e limites mais rigorosos no login e na recuperação de senha.
- Recuperação temporária de senha bloqueada por padrão e sempre bloqueada em produção enquanto não houver SMTP.
- Tokens invalidados quando o usuário é alterado, desativado ou tem a senha redefinida.
- Protecao contra remoção ou desativação do último administrador ativo.
- Health checks em `/api/health` e `/api/health/ready`.
- Logs HTTP estruturados com `X-Request-Id`.
- Encerramento gracioso da API.
- Imagens Docker separadas para migrations, API e frontend.
- Nginx com proxy para `/api`, CSP e cache seguro de assets.
- Pipeline de CI com lint, testes, build e auditoria das dependências de produção.

### Variáveis obrigatórias

Backend:

| Variável | Uso |
| --- | --- |
| `DATABASE_URL` | URL de conexão usada pela aplicação. No Supabase, pode usar a URL pooler. |
| `DIRECT_URL` | URL direta do PostgreSQL usada pelo Prisma para migrations. No Supabase, use a URL direta. |
| `DATABASE_POOL_MODE` | `auto`, `direct` ou `transaction`. Use `transaction` para pooler transacional. |
| `JWT_SECRET` | Chave secreta para assinar tokens JWT. Em produção deve ter pelo menos 64 caracteres aleatórios. |
| `JWT_EXPIRES_IN` | Tempo de validade do token. Exemplo: `8h`. |
| `BCRYPT_ROUNDS` | Custo do hash de senha. Valor recomendado: `12`. |
| `PORT` | Porta da API. |
| `FRONTEND_URL` | Origem liberada no CORS. Use virgulas para mais de uma origem. |
| `TRUST_PROXY` | Use `true` quando a API estiver atrás de proxy reverso confiável. |
| `MAX_BODY_BYTES` | Limite de corpo das requisições. Padrão: `1048576`. |
| `ADMIN_EMAIL` | E-mail do administrador criado pelo seed. |
| `ADMIN_PASSWORD` | Senha do administrador criado pelo seed. Deve ser forte e privada. |

Frontend:

| Variável | Uso |
| --- | --- |
| `VITE_API_URL` | URL base da API. Pode ficar vazia quando frontend e API usam o mesmo domínio. |
| `VITE_BASE_PATH` | Caminho base do frontend. No GitHub Pages use `/<nome-do-repositorio>/`. |

### Deploy

#### Opcao portatil com Docker Compose

Copie o modelo e substitua todos os segredos:

```bash
cp .env.production.example .env.production
```

Suba banco, migration, API e frontend:

```bash
docker compose --env-file .env.production -f compose.production.yml up -d --build
```

Crie ou sincronize o primeiro administrador somente quando necessário:

```bash
docker compose --env-file .env.production -f compose.production.yml run --rm migrate npm run prisma:seed --workspace transportadora-api
```

O frontend fica em `http://servidor:8080` por padrão. Em ambiente público, coloque esse serviço atrás de um proxy, load balancer ou CDN com HTTPS.

Verificação:

```bash
curl https://transporte.exemplo.com/api/health
curl https://transporte.exemplo.com/api/health/ready
```

Antes de publicar uma versão:

```bash
npm ci
npm run prisma:generate --workspace transportadora-api
npm run check
npm run audit:prod
```

#### Opcao com serviços gerenciados

Fluxo recomendado:

```txt
1. Provisionar banco PostgreSQL no Supabase.
2. Configurar a API no Render com variáveis de ambiente.
3. Configurar `VITE_API_URL` como secret do GitHub Actions.
4. Publicar o frontend no GitHub Pages.
5. Rodar migrations contra o banco de produção.
6. Configurar backup e monitoramento.
```

Comandos de build:

```bash
npm run build --workspace transportadora-api
npm run build --workspace transportadora-web
```

Render para o backend, mantendo a raiz do repositorio:

```bash
# Build Command
npm ci && npm run prisma:generate --workspace transportadora-api && npm run build --workspace transportadora-api

# Start Command
npm run prisma:deploy --workspace transportadora-api && npm run start --workspace transportadora-api
```

Não rode `npx prisma db seed` automaticamente no Start Command de produção. Execute o seed manualmente apenas quando precisar criar o usuário inicial, com `ADMIN_EMAIL` e `ADMIN_PASSWORD` configurados.

### Backup

O banco de dados é o principal ativo do sistema. Recomenda-se:

- Backup diário automático.
- Retencao minima de 7 a 30 dias.
- Backup antes de migrations.
- Teste periódico de restauração.
- Armazenamento fora do servidor principal.

Exemplo PostgreSQL:

```bash
pg_dump "$DATABASE_URL" > backup-controle-transporte.sql
```

### Segurança

Cuidados mínimos:

- Usar `JWT_SECRET` forte e exclusivo por ambiente.
- Não versionar arquivos `.env`.
- Usar HTTPS obrigatoriamente.
- Restringir acesso direto ao banco.
- Criar usuários de banco com permissões adequadas.
- Manter dependências atualizadas.
- Revisar usuários ADMIN periodicamente.
- Proteger backups.

### HTTPS e proxy reverso

Em produção, a API e o frontend devem ficar atrás de proxy reverso com HTTPS.

Exemplo de arquitetura:

```txt
Internet
  |
  v
Nginx/Proxy com HTTPS
  |------------------> Frontend React buildado
  |
  +------------------> API NestJS em porta interna
                         |
                         v
                     PostgreSQL
```

### Logs

Logs recomendados:

- Requisicoes HTTP.
- Erros da API.
- Falhas de autenticação.
- Erros de banco.
- Execução de migrations.
- Jobs futuros de backup e integrações.

Em produção, é recomendado enviar logs para uma ferramenta centralizada.

### Monitoramento

Monitorar:

- Uso de CPU e memória.
- Espaco em disco.
- Disponibilidade da API.
- Disponibilidade do banco.
- Tempo de resposta.
- Erros 4xx e 5xx.
- Crescimento do banco.
- Execução de backups.

### Recuperação de senha e SMTP

Enquanto não houver SMTP, a recuperação automática fica desabilitada em produção e não altera a senha silenciosamente. Em desenvolvimento, o fluxo temporário só pode ser habilitado explicitamente com `ALLOW_INSECURE_PASSWORD_RECOVERY=true`.

Variáveis futuras sugeridas:

```env
SMTP_HOST="smtp.exemplo.com"
SMTP_PORT=587
SMTP_USER="usuario"
SMTP_PASS="senha"
SMTP_FROM="nao-responda@transportadora.com"
```

### Cuidados em produção

- Nunca rodar seed de massa de teste em banco real sem revisar.
- Rodar migrations primeiro em homologação.
- Fazer backup antes de atualizar versão.
- Usar senhas fortes para usuários ADMIN.
- Validar CORS apenas para domínio real do frontend.
- Usar banco com volume persistente.
- Documentar qualquer ajuste manual feito no banco.

## Melhorias futuras

Roadmap sugerido para evoluir o sistema:

| Área | Melhoria |
| --- | --- |
| Manutenção preventiva | Plano de revisões por km, data, horimetro ou tipo de frota. |
| Rastreamento | Integração com telemetria e posição dos veículos. |
| Pneus | Controle de vida útil, sulco, recapagem, rodízio e custo por eixo. |
| Abastecimento | Controle detalhado de litros, média, posto, motorista e km. |
| Integração fiscal | Vínculo com NFe, CTe, MDFe e documentos fiscais. |
| Emissão de documentos | Geração operacional de ordens de carregamento, comprovantes e manifestos. |
| App mobile | Lançamento de despesas e envio de comprovantes pelo motorista. |
| Integração GPS | Histórico de rotas, paradas, alertas e tempos de viagem. |
| Oficina | Ordens de serviço e histórico completo de manutenção. |
| Estoque | Peças, lubrificantes, pneus e insumos. |
| Financeiro avançado | Contas a pagar/receber, vencimentos, baixa e conciliação. |
| BI | Indicadores por rota, cliente, conjunto, motorista e centro de custo. |
| Anexos | Upload de notas, recibos, fotos e documentos. |
| Permissões finas | Perfis por módulo e permissão granular. |

## Exemplos de payloads da API

Criar cavalo mecânico:

```json
{
  "placa": "ABC1D23",
  "marca": "Volvo",
  "modelo": "FH 540",
  "ano": 2021,
  "renavam": "12345678901",
  "chassi": "9BWZZZ377VT004251",
  "cor": "Branco",
  "status": "ATIVO",
  "motoristaId": "uuid-do-motorista",
  "observacoes": "Cavalo principal da frota"
}
```

Criar implemento:

```json
{
  "placa": "CAR1A01",
  "tipo": "SEMIRREBOQUE",
  "carroceria": "GRANELEIRO",
  "quantidadeEixos": 3,
  "capacidadeCarga": 32000,
  "status": "ATIVO",
  "observacoes": "Primeira carreta do bitrem"
}
```

Criar despesa:

```json
{
  "data": "2026-05-22",
  "placa": "ABC1D23",
  "motoristaId": "uuid-do-motorista",
  "fornecedorId": "uuid-do-fornecedor",
  "cavaloMecanicoId": "uuid-do-cavalo",
  "conjuntoId": "uuid-do-conjunto",
  "categoriaId": "uuid-categoria-combustivel",
  "tipoLancamento": "DESPESA",
  "descricao": "Abastecimento",
  "quantidade": 300,
  "unidadeQuantidade": "KG",
  "valorUnitario": 5.89
}
```

Consultar relatório filtrado:

```http
GET /api/relatorios/financeiros?dataInicial=2026-05-01&dataFinal=2026-05-31&cavaloMecanicoId=uuid&tipoLancamento=DESPESA&page=1&limit=50
```

## Observações técnicas

- A rota `/caminhoes` foi mantida por compatibilidade com o frontend e com partes existentes do sistema, mas hoje representa o cadastro de cavalos mecânicos.
- A tabela legada `caminhoes` permanece no banco para preservar histórico e permitir migração segura.
- O sistema evita apagar dados automaticamente quando a conversão não é totalmente confiável.
- O CSV usa separador `;`, adequado para abertura em Excel configurado em pt-BR.
- O PDF é gerado no backend de forma simples, suficiente para exportação operacional.
