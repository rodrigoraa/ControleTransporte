# Controle Transporte

Sistema web para controle financeiro, operacional e cadastral de uma transportadora. A aplicacao substitui planilhas e organiza clientes, fornecedores, motoristas, frota, conjuntos operacionais, despesas, faturamento, dashboard, relatorios e auditoria.

## Indice

- [O que o sistema faz](#o-que-o-sistema-faz)
- [Visao operacional](#visao-operacional)
- [Exemplos reais](#exemplos-reais)
- [Fluxo operacional](#fluxo-operacional)
- [Tecnologias](#tecnologias)
- [Configuracao](#configuracao)
- [Telas do frontend](#telas-do-frontend)
- [Backend](#backend)
- [Banco e modelo operacional de frota](#banco-e-modelo-operacional-de-frota)
- [Relatorios e exportacoes](#relatorios-e-exportacoes)
- [Documentacao tecnica](#documentacao-tecnica)
- [Producao](#producao)
- [Melhorias futuras](#melhorias-futuras)

## O que o sistema faz

O sistema centraliza a operacao da transportadora em uma aplicacao com backend NestJS, frontend React e banco PostgreSQL. Ele permite:

- Gerenciar clientes, fornecedores, motoristas e usuarios.
- Cadastrar a frota de forma realista, separando cavalo mecanico, implemento e conjunto operacional.
- Registrar despesas e faturamento vinculados a motorista, cavalo mecanico, conjunto operacional, implemento, fornecedor, cliente e categoria financeira.
- Calcular automaticamente valores financeiros.
- Consultar dashboard com indicadores financeiros e operacionais.
- Gerar relatorios com filtros por periodo, cavalo, implemento, conjunto, tipo de conjunto, quantidade de eixos, motorista, fornecedor, cliente, categoria e tipo financeiro.
- Exportar relatorios em CSV/Excel e PDF.
- Registrar auditoria de operacoes importantes.
- Controlar permissoes por perfil `ADMIN` e `USUARIO`.

## Visao operacional

Em uma transportadora real, a operacao nao depende apenas de um "caminhao" generico. A composicao usada em uma viagem pode mudar conforme carga, rota, tipo de carroceria, capacidade, quantidade de eixos, motorista e disponibilidade da frota.

O sistema foi estruturado para refletir essa realidade:

```txt
Motorista dirige um cavalo mecanico
Cavalo mecanico traciona um ou mais implementos
Implementos formam um conjunto operacional
Conjunto operacional gera despesas, faturamento e relatorios
```

### Cavalo mecanico

E o veiculo trator. Ele possui motor, cabine e quinta-roda, e puxa um semirreboque, carreta ou composicao maior.

Exemplos:

- Volvo FH 540.
- Scania R 440.
- Mercedes-Benz Actros.
- DAF XF.

No sistema, o cavalo mecanico tem placa, marca, modelo, ano, chassi, renavam, cor, status e motorista atual.

### Implemento

E o equipamento rebocado ou semirrebocado pelo cavalo mecanico. Pode ser usado para carga seca, graos, combustivel, maquinas, paletes, minerio, entre outros.

Tipos cadastrados:

| Tipo | Explicacao |
| --- | --- |
| `CARRETA` | Implemento rebocado usado para transporte de carga. No uso comum, muitas empresas chamam genericamente qualquer implemento de carreta. |
| `SEMIRREBOQUE` | Implemento que apoia parte do peso no cavalo mecanico por meio da quinta-roda. Muito comum em cavalos mecanicos. |
| `REBOQUE` | Implemento que possui eixo dianteiro e traseiro, rebocado por outro veiculo. |
| `DOLLY` | Equipamento intermediario com eixos usado para ligar um semirreboque a outro, comum em rodotrens. |

Carrocerias cadastradas:

| Carroceria | Uso comum |
| --- | --- |
| `BAU` | Carga seca protegida. |
| `GRANELEIRO` | Graos, insumos agricolas e carga a granel. |
| `SIDER` | Cargas paletizadas com abertura lateral. |
| `TANQUE` | Liquidos, combustiveis ou produtos especificos. |
| `PRANCHA` | Maquinas e cargas especiais. |
| `OUTRO` | Casos nao classificados. |

### O que e carreta

Na linguagem operacional, "carreta" costuma ser usada como nome generico para o implemento de carga. Tecnicamente, pode se referir a um semirreboque ou reboque, dependendo da composicao. Por isso o sistema separa `tipo` e `carroceria`, evitando tratar tudo como um unico "caminhao".

### O que e semirreboque

O semirreboque nao se sustenta totalmente sozinho em operacao: parte de seu peso fica apoiada no cavalo mecanico. Ele e muito usado em conjuntos simples, bitrens e rodotrens.

### O que e dolly

O dolly e uma estrutura com eixos e engate que permite conectar outro semirreboque em uma composicao. Ele nao transporta carga principal, mas conta na quantidade de eixos e faz parte da configuracao operacional.

### O que e bitrem

Bitrem e uma composicao normalmente formada por:

```txt
Cavalo mecanico + 1a carreta + 2a carreta
```

No sistema, o bitrem aparece como um `Conjunto operacional` com tipo `BITREM`, um cavalo mecanico e dois implementos. A ordem correta dos implementos e: 1a carreta e 2a carreta.

### O que e rodotrem

Rodotrem e uma composicao maior, normalmente formada por:

```txt
Cavalo mecanico + 1a carreta + dolly + 2a carreta
```

No sistema, o rodotrem aparece como um `Conjunto operacional` com tipo `RODOTREM`, um cavalo mecanico e implementos vinculados. A ordem correta dos implementos e: 1a carreta, dolly e 2a carreta.

### Diferenca entre 7 eixos e 9 eixos

A quantidade de eixos influencia capacidade, enquadramento operacional, restricoes de rota, pedagio, custo, manutencao e analise financeira.

| Composicao | Exemplo operacional | Impacto no sistema |
| --- | --- | --- |
| 7 eixos | Cavalo + 1a carreta + 2a carreta | Pode ser classificado como bitrem. O sistema valida a composicao sem dolly. |
| 9 eixos | Cavalo + 1a carreta + dolly + 2a carreta | Pode ser classificado como rodotrem. O sistema valida a presenca do dolly. |

No sistema, a quantidade total de eixos e a capacidade total do conjunto sao calculadas automaticamente a partir dos implementos. Isso evita erro manual e permite relatorios por tipo de composicao.

## Exemplos reais

### Exemplo 1: Cavalo Volvo FH com bitrem 7 eixos

Operacao:

```txt
Cavalo mecanico:
  Placa: ABC1D23
  Marca/modelo: Volvo FH 540
  Motorista atual: Carlos Almeida

Implementos:
  1. 1a carreta / semirreboque graneleiro CAR1A01 - 3 eixos - 32.000 kg
  2. 2a carreta / semirreboque graneleiro CAR1A02 - 3 eixos - 32.000 kg

Conjunto operacional:
  Nome gerado: ABC1D23 - Volvo
  Tipo identificado: BITREM
  Total de eixos dos implementos: 6
  Capacidade total: 64.000 kg
```

Como aparece no sistema:

| Tela | Registro |
| --- | --- |
| Cavalos mecanicos | Volvo FH 540, placa ABC1D23, motorista Carlos Almeida |
| Implementos | CAR1A01 e CAR1A02 como semirreboques graneleiros |
| Conjuntos operacionais | Bitrem graneleiro 7 eixos com o cavalo e os dois implementos |
| Despesas | Abastecimento, pneus ou manutencao vinculados ao cavalo/conjunto |
| Faturamento | Frete do cliente vinculado ao conjunto operacional |
| Relatorios | Filtro por cavalo, conjunto, tipo `BITREM` ou quantidade de eixos |

Payload de exemplo para criar um conjunto:

```json
{
  "cavaloMecanicoId": "id-do-cavalo-volvo",
  "implementoIds": ["id-car1a01", "id-car1a02"],
  "status": "ATIVO",
  "observacoes": "Composicao para transporte de graos"
}
```

### Exemplo 2: Rodotrem 9 eixos com dolly

Operacao:

```txt
Cavalo mecanico:
  Placa: MID5J90
  Marca/modelo: Scania R 440

Implementos:
  1. 1a carreta / semirreboque sider CAR1A03 - 3 eixos - 30.000 kg
  2. Dolly DLY1A02 - 2 eixos - 0 kg de carga
  3. 2a carreta / semirreboque sider CAR1A04 - 3 eixos - 30.000 kg

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
| Relatorios | Pode ser filtrado por tipo `RODOTREM`, implemento dolly ou quantidade de eixos |

Payload de exemplo para lancar faturamento:

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

O fluxo recomendado para usar o sistema em uma operacao real e:

### 1. Cadastro de motorista

Cadastre o motorista com nome, CPF, CNH, categoria, validade da CNH, telefone e status. Esse cadastro sera usado no cavalo mecanico e nos lancamentos financeiros.

### 2. Cadastro de cavalo mecanico

Cadastre o cavalo mecanico com placa, marca, modelo, ano, renavam, chassi, cor, status e motorista atual. O cavalo e o veiculo trator da operacao.

### 3. Cadastro de implementos

Cadastre carretas, semirreboques, reboques e dollies. Informe tipo, carroceria, quantidade de eixos e capacidade de carga.

### 4. Criacao de conjunto operacional

Crie uma composicao selecionando:

- Um cavalo mecanico.
- Um ou mais implementos.

O sistema gera automaticamente o nome do conjunto usando placa e marca do cavalo mecanico. O sistema tambem identifica automaticamente se a composicao e simples, bitrem 7 eixos ou rodotrem 9 eixos, alem de calcular total de eixos e capacidade total.

Para conjuntos com duas ou mais carretas, selecione os implementos na ordem operacional:

| Tipo | Ordem esperada |
| --- | --- |
| Bitrem 7 eixos | 1a carreta, 2a carreta |
| Rodotrem 9 eixos | 1a carreta, dolly, 2a carreta |

### 5. Lancamento de despesas

Registre despesas como combustivel, pneus, manutencao, lavagem, seguro ou borracharia. A despesa deve ter fornecedor e pode ser vinculada a cavalo, conjunto e implemento.

### 6. Lancamento de faturamento

Registre o faturamento do frete ou servico. O faturamento deve ter cliente e pode ser vinculado ao conjunto operacional usado na viagem.

### 7. Geracao de relatorios

Use os filtros para analisar o desempenho:

- Por periodo.
- Por cavalo mecanico.
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
- Seguranca: bcrypt, JWT, guards de autenticacao e autorizacao.
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

1. O usuario acessa o frontend em `http://localhost:5173`.
2. O frontend envia requisicoes HTTP para a API em `http://localhost:3000/api`.
3. A API autentica o usuario com JWT.
4. Controllers do NestJS recebem as requisicoes.
5. DTOs validam os dados de entrada.
6. Services aplicam regras de negocio.
7. Prisma consulta ou altera o PostgreSQL.
8. A API retorna JSON, CSV ou PDF para o frontend.
9. O frontend renderiza telas, tabelas, formularios, graficos e mensagens de erro/sucesso.

Fluxo resumido:

```txt
React/Vite -> Axios -> NestJS Controller -> Service -> Prisma -> PostgreSQL
```

## Configuracao

Instale as dependencias:

```bash
npm install
```

Crie os arquivos de ambiente:

```bash
cp .env.example transportadora-api/.env
cp .env.example transportadora-web/.env
```

Exemplo de variaveis:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5433/controle_transporte?schema=public"
JWT_SECRET="dev-local-controle-transporte-jwt-secret-32"
JWT_EXPIRES_IN="8h"
PORT=3000
FRONTEND_URL="http://localhost:5173"
VITE_API_URL="http://localhost:3000"
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
admin@transportadora.com
admin123
```

Usuario operacional criado pelo seed:

```txt
usuario@transportadora.com
usuario123
```

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

## Perfis e permissoes

### ADMIN

Pode:

- Visualizar todas as telas.
- Criar, editar e excluir cadastros.
- Gerenciar usuarios.
- Consultar auditoria.
- Gerar e exportar relatorios.
- Acessar dashboard.

### USUARIO

Pode:

- Visualizar cadastros.
- Visualizar dashboard.
- Gerar e exportar relatorios.

Nao pode:

- Criar, editar ou excluir registros.
- Gerenciar usuarios.
- Consultar auditoria administrativa.

## Telas do frontend

### Login

Tela inicial de autenticacao. O usuario informa email e senha. O frontend envia as credenciais para `/api/auth/login`. A API valida a senha com bcrypt, gera um JWT e retorna os dados do usuario autenticado.

### Dashboard

Mostra resumo financeiro e operacional:

- Total faturado no mes.
- Total de despesas no mes.
- Saldo do mes.
- Cavalos mecanicos ativos.
- Implementos ativos.
- Conjuntos operacionais ativos.
- Itens inativos ou em manutencao.
- Motoristas ativos.
- Grafico de despesas por categoria.
- Grafico de conjuntos por tipo.
- Comparativo mensal de faturamento e despesas.
- Ultimos lancamentos.

Dados consumidos de `/api/dashboard`.

Como interpretar:

| Indicador | Interpretacao |
| --- | --- |
| Total faturado no mes | Receita bruta registrada em lancamentos de faturamento no mes atual. |
| Total de despesas no mes | Soma das despesas registradas no mes atual. |
| Saldo do mes | Faturamento menos despesas. Nao substitui DRE contabil, mas ajuda no controle operacional. |
| Cavalos mecanicos ativos | Quantidade de tratores disponiveis para operacao. |
| Implementos ativos | Quantidade de carretas, semirreboques, reboques e dollies disponiveis. |
| Conjuntos ativos | Quantidade de composicoes operacionais cadastradas como ativas. |
| Itens inativos ou em manutencao | Frota ou implementos fora da operacao. |
| Motoristas ativos | Motoristas disponiveis para operacao. |

Graficos:

- Despesas por categoria: ajuda a identificar maiores centros de custo.
- Conjuntos por tipo: mostra distribuicao entre simples, bitrem, rodotrem e outros.
- Comparativo faturamento x despesas: ajuda a perceber meses com maior margem ou maior pressao de custos.

### Clientes

Cadastro de clientes atendidos pela transportadora.

Campos principais:

- Nome.
- CPF/CNPJ.
- Telefone.
- Email.
- Endereco.
- Observacoes.
- Ativo.

Usado em lancamentos de faturamento e relatorios.

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
- Observacoes.

Motoristas podem ser vinculados a cavalos mecanicos e lancamentos financeiros.

### Cavalos mecanicos

Representa o veiculo trator da composicao.

Campos principais:

- Placa.
- Marca.
- Modelo.
- Ano.
- Motorista atual.
- Cor.
- Chassi.
- Renavam.
- Status: ativo, inativo ou manutencao.
- Observacoes.

A rota do frontend permanece em `/caminhoes` por compatibilidade, mas o conceito operacional exibido e usado pelo sistema e `Cavalo mecanico`.

Regras:

- Placa unica.
- Placa validada no formato brasileiro antigo ou Mercosul.
- Chassi unico quando informado.
- Renavam unico quando informado.
- Alteracoes geram historico.

### Implementos

Representa carreta, semirreboque, reboque ou dolly.

Campos principais:

- Placa, quando existir.
- Tipo: carreta, semirreboque, reboque ou dolly.
- Carroceria: bau, graneleiro, sider, tanque, prancha ou outro.
- Quantidade de eixos.
- Capacidade de carga.
- Status: ativo, inativo ou manutencao.
- Observacoes.

Regras:

- Placa unica quando informada.
- Placa validada no formato brasileiro antigo ou Mercosul.
- Quantidade de eixos obrigatoria.
- Capacidade de carga obrigatoria.
- Alteracoes geram historico.

### Conjuntos operacionais

Representa a composicao usada na viagem ou operacao.

Exemplos:

- Cavalo + carreta.
- Bitrem.
- Rodotrem.
- Cavalo + dolly + carreta.

Campos principais:

- Nome do conjunto, gerado automaticamente.
- Tipo, identificado automaticamente como simples, bitrem, rodotrem ou outro.
- Cavalo mecanico.
- Implementos vinculados.
- Quantidade total de eixos.
- Capacidade total.
- Status.
- Justificativa para conjunto sem implemento.
- Observacoes.

Regras:

- Nao permite conjunto sem cavalo mecanico.
- Nao permite conjunto sem implemento, exceto com justificativa.
- Nome do conjunto e gerado automaticamente pela placa e marca do cavalo mecanico.
- Tipo do conjunto e identificado automaticamente pela composicao.
- Total de eixos e capacidade total sao calculados automaticamente com base nos implementos.
- Um cavalo pode trocar de composicao.
- Um implemento pode trocar de composicao.
- Alteracoes de composicao geram historico.

### Fornecedores

Cadastro de fornecedores da transportadora.

Campos principais:

- Nome.
- CPF/CNPJ.
- Telefone.
- Email.
- Endereco.
- Observacoes.
- Ativo.

Usado principalmente em despesas.

### Categorias financeiras

Classifica despesas e faturamentos.

Campos principais:

- Nome.
- Tipo do lancamento: despesa ou faturamento.
- Ativo.
- Observacoes.

Exemplos:

- Combustivel.
- Manutencao.
- Pneus.
- Frete.
- Servico extra.

### Despesas

Tela de lancamentos financeiros do tipo `DESPESA`.

Campos principais:

- Data.
- Placa do cavalo mecanico.
- Cavalo mecanico.
- Conjunto operacional.
- Implemento vinculado, quando a despesa for especifica de uma carreta/dolly.
- Motorista.
- Fornecedor.
- Categoria.
- Descricao.
- Quantidade.
- Unidade: KG ou unidade.
- Valor unitario.
- Valor total calculado automaticamente.
- Observacoes.

Regras:

- Despesa exige fornecedor.
- Despesa nao usa cliente.
- Valor total = quantidade x valor unitario.
- Pode ser filtrada em relatorios por frota, pessoa, periodo, categoria e tipo.

### Faturamento

Tela de lancamentos financeiros do tipo `FATURAMENTO`.

Campos principais:

- Data.
- Placa do cavalo mecanico.
- Cavalo mecanico.
- Conjunto operacional.
- Implemento vinculado, quando aplicavel.
- Motorista.
- Cliente.
- Categoria.
- Descricao.
- Quantidade.
- Unidade.
- Valor unitario.
- Valor total calculado automaticamente.
- Observacoes.

Regras:

- Faturamento exige cliente.
- Faturamento nao usa fornecedor.
- Valor total = quantidade x valor unitario.

### Usuarios

Tela administrativa para gerenciar usuarios do sistema.

Campos principais:

- Nome.
- Email.
- Senha.
- Perfil: ADMIN ou USUARIO.
- Ativo.

Disponivel apenas para `ADMIN`.

### Auditoria

Tela administrativa para consultar registros de auditoria.

Mostra:

- Data.
- Entidade.
- ID do registro.
- Acao.
- Usuario, quando informado.
- Dados anteriores.
- Dados novos.

Disponivel apenas para `ADMIN`.

### Relatorios

Tela de consulta financeira com filtros operacionais e exportacao.

Filtros disponiveis:

- Data inicial.
- Data final.
- Motorista.
- Cavalo mecanico.
- Implemento.
- Conjunto operacional.
- Tipo de conjunto.
- Quantidade de eixos.
- Placa.
- Fornecedor.
- Cliente.
- Tipo financeiro: despesa ou faturamento.
- Categoria.
- Ordenacao por data ou valor total.
- Direcao crescente ou decrescente.

Resultados exibidos:

- Total de despesas.
- Total de faturamento.
- Saldo final.
- Historico de lancamentos.
- Despesas por cavalo mecanico.
- Despesas por motorista.
- Faturamento por cavalo mecanico.
- Faturamento por motorista.

Exportacoes:

- CSV/Excel.
- PDF.

Relatorios vazios mostram mensagem informando que nenhum lancamento foi encontrado para os filtros aplicados.

Como interpretar os relatorios:

| Campo | Como usar |
| --- | --- |
| Total de despesas | Mostra o custo filtrado. Pode ser por periodo, cavalo, conjunto, motorista, fornecedor ou categoria. |
| Total de faturamento | Mostra a receita filtrada. Pode ser por cliente, conjunto, motorista, cavalo ou periodo. |
| Saldo final | Diferenca entre faturamento e despesas dentro dos filtros aplicados. |
| Historico de lancamentos | Lista detalhada das movimentacoes que compoem os totais. |
| Despesas por cavalo mecanico | Ajuda a identificar cavalos com maior custo. |
| Faturamento por cavalo mecanico | Ajuda a identificar cavalos com maior geracao de receita. |
| Despesas por motorista | Pode indicar concentracao de custos por operacao/motorista. |
| Faturamento por motorista | Ajuda a analisar produtividade operacional. |

Exemplos de analise financeira:

```txt
Pergunta: Qual conjunto gerou mais faturamento no mes?
Filtro: dataInicial + dataFinal + conjunto operacional
Analise: comparar faturamento total com despesas do mesmo periodo.
```

```txt
Pergunta: Um bitrem esta dando lucro?
Filtro: tipoConjunto=BITREM, periodo desejado
Analise: verificar saldo final e detalhar despesas por categoria.
```

```txt
Pergunta: Um implemento especifico esta gerando muita manutencao?
Filtro: implementoId + categoria Manutencao/Pneus
Analise: comparar despesas do implemento com faturamento dos conjuntos em que ele aparece.
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

- `auth`: login, JWT, recuperacao de senha e usuario autenticado.
- `users`: usuarios e perfis.
- `clientes`: cadastro de clientes.
- `fornecedores`: cadastro de fornecedores.
- `motoristas`: cadastro de motoristas e historico.
- `caminhoes`: rota de compatibilidade que opera cavalos mecanicos.
- `implementos`: cadastro de implementos.
- `conjuntos`: cadastro de conjuntos operacionais.
- `categorias-financeiras`: categorias de despesa/faturamento.
- `lancamentos-financeiros`: despesas e faturamento.
- `dashboard`: indicadores e graficos.
- `relatorios`: consultas financeiras e exportacoes.
- `auditorias`: rastreio de operacoes.
- `common`: Prisma, CRUD generico, decorators e guards.

Fluxo interno padrao de um modulo:

```txt
Controller
  recebe HTTP, le parametros e body

DTO
  valida dados, tipos, enums e campos obrigatorios

Service
  aplica regras de negocio e chama Prisma

Prisma
  executa consultas e gravacoes no PostgreSQL

Auditoria/Historico
  registra alteracoes relevantes
```

## Banco e modelo operacional de frota

### Cavalo mecanico

Tabela: `cavalos_mecanicos`.

Representa o trator. Pode estar vinculado a motorista e a conjuntos operacionais.

### Implemento

Tabela: `implementos`.

Representa carreta, semirreboque, reboque ou dolly.

### Conjunto operacional

Tabela: `conjuntos`.

Representa a composicao operacional usada nos lancamentos e relatorios.

Relacionamento com implementos:

```txt
conjuntos -> conjuntos_implementos -> implementos
```

### Lancamento financeiro

Tabela: `lancamentos_financeiros`.

Pode apontar para:

- Motorista.
- Cavalo mecanico.
- Conjunto operacional.
- Implemento.
- Fornecedor, em despesas.
- Cliente, em faturamento.
- Categoria financeira.

## Documentacao tecnica

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
1. Usuario preenche formulario no React.
2. React chama a API usando Axios.
3. Axios envia JWT no header Authorization.
4. JwtAuthGuard valida o token.
5. RolesGuard verifica permissao quando necessario.
6. Controller recebe requisicao.
7. ValidationPipe valida DTO.
8. Service aplica regras.
9. Prisma executa transacao ou query.
10. PostgreSQL retorna dados.
11. API responde JSON/CSV/PDF.
12. Frontend atualiza tabela, grafico, toast ou download.
```

### Autenticacao JWT

O login acontece em:

```http
POST /api/auth/login
```

Payload:

```json
{
  "email": "admin@transportadora.com",
  "senha": "admin123"
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

### Permissoes tecnicas

As permissoes sao aplicadas por guards:

- `JwtAuthGuard`: exige usuario autenticado.
- `RolesGuard`: exige perfil especifico quando o endpoint e restrito.
- `@Roles(PerfilUsuario.ADMIN)`: usado em criacao, edicao, exclusao, usuarios e auditoria.

### Auditoria

A auditoria registra a entidade alterada, acao, ID do registro, usuario quando disponivel, dados anteriores e dados novos.

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

Historicos especificos complementam a auditoria para alteracoes de cavalo mecanico, implemento, conjunto operacional e motorista.

## Regras de negocio principais

- Despesa deve ter fornecedor.
- Faturamento deve ter cliente.
- Valor total financeiro e calculado automaticamente.
- Cavalo mecanico exige placa valida e unica.
- Implemento com placa exige placa valida e unica.
- Conjunto operacional exige cavalo mecanico.
- Conjunto operacional exige pelo menos um implemento, salvo justificativa.
- Quantidade total de eixos do conjunto e calculada automaticamente.
- Capacidade total do conjunto e calculada automaticamente.
- Alteracoes relevantes geram auditoria e/ou historico.
- Exclusoes com vinculos sao bloqueadas pelo backend.

## Relatorios e exportacoes

Endpoint de opcoes:

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

O backend valida os parametros com DTO. Parametros invalidos retornam erro `400`.

O filtro por implemento considera:

- Lancamentos diretamente vinculados ao implemento.
- Lancamentos vinculados a conjuntos que contem o implemento.

## Auditoria e historicos

O sistema registra auditoria de criacao, atualizacao e exclusao em cadastros operacionais. Tambem existem historicos especificos para:

- Motoristas.
- Cavalos mecanicos.
- Implementos.
- Conjuntos operacionais.

A auditoria ajuda a rastrear quem alterou registros e quais dados mudaram.

## Frontend

O frontend fica em `transportadora-web`.

Ele usa:

- `AuthContext` para guardar usuario autenticado e token.
- `api.ts` para configurar Axios.
- `AppLayout` para menu, topo e controle de acesso visual.
- `CrudPage` para telas CRUD genericas configuradas em `resources.ts`.
- Paginas especificas para dashboard, login e relatorios.

As telas CRUD usam uma configuracao de campos. Cada campo define:

- Nome.
- Label.
- Tipo.
- Se aparece na tabela.
- Se e obrigatorio.
- Relacionamento com outro endpoint.
- Mascara, quando aplicavel.

Isso reduz duplicacao de formularios e tabelas.

## Seed

O seed cria dados de exemplo:

- Usuarios ADMIN e USUARIO.
- Clientes.
- Fornecedores.
- Motoristas.
- Cavalos mecanicos.
- Implementos.
- Conjuntos operacionais.
- Categorias financeiras.
- Lancamentos de despesas e faturamento.

Tambem cria massa suficiente para testar dashboard e relatorios.

## Migracao de dados legados

A estrutura nova preserva dados antigos e migra o que for possivel:

- Registros antigos de `caminhoes` sao mapeados para `cavalos_mecanicos`.
- Placas antigas em conjuntos sao usadas para criar implementos quando possivel.
- Conjuntos antigos recebem cavalo mecanico quando era possivel inferir a relacao.
- Lancamentos antigos recebem vinculo com cavalo mecanico e conjunto quando possivel.

Quando algum dado antigo nao tem informacao suficiente, o sistema usa valores seguros e deixa observacoes para revisao manual.

## Validacoes importantes

- Placa: aceita formato brasileiro antigo e Mercosul.
- Datas de relatorio: formato ISO de data.
- Enums: tipos financeiros, status, tipo de implemento, carroceria e tipo de conjunto sao validados.
- Paginacao: `page` minimo 1, `limit` entre 1 e 500.
- Ordenacao: apenas campos permitidos.

## Comandos uteis

Instalar dependencias:

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

Rodar aplicacao:

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

## Producao

Esta secao resume cuidados para colocar o sistema em ambiente real de transportadora.

### Variaveis obrigatorias

Backend:

| Variavel | Uso |
| --- | --- |
| `DATABASE_URL` | URL de conexao com PostgreSQL. |
| `JWT_SECRET` | Chave secreta para assinar tokens JWT. Deve ser longa e privada. |
| `JWT_EXPIRES_IN` | Tempo de validade do token. Exemplo: `8h`. |
| `PORT` | Porta da API. |
| `FRONTEND_URL` | Origem liberada no CORS. |

Frontend:

| Variavel | Uso |
| --- | --- |
| `VITE_API_URL` | URL base da API consumida pelo React. |

### Deploy

Fluxo recomendado:

```txt
1. Provisionar servidor ou ambiente cloud.
2. Configurar PostgreSQL gerenciado ou container persistente.
3. Configurar variaveis de ambiente.
4. Rodar migrations.
5. Gerar build do backend.
6. Gerar build do frontend.
7. Servir frontend por Nginx/Apache/CDN.
8. Rodar API como servico com PM2, Docker ou systemd.
9. Configurar proxy reverso com HTTPS.
10. Configurar backup e monitoramento.
```

Comandos de build:

```bash
npm run build --workspace transportadora-api
npm run build --workspace transportadora-web
```

### Backup

O banco de dados e o principal ativo do sistema. Recomenda-se:

- Backup diario automatico.
- Retencao minima de 7 a 30 dias.
- Backup antes de migrations.
- Teste periodico de restauracao.
- Armazenamento fora do servidor principal.

Exemplo PostgreSQL:

```bash
pg_dump "$DATABASE_URL" > backup-controle-transporte.sql
```

### Seguranca

Cuidados minimos:

- Usar `JWT_SECRET` forte e exclusivo por ambiente.
- Nao versionar arquivos `.env`.
- Usar HTTPS obrigatoriamente.
- Restringir acesso direto ao banco.
- Criar usuarios de banco com permissoes adequadas.
- Manter dependencias atualizadas.
- Revisar usuarios ADMIN periodicamente.
- Proteger backups.

### HTTPS e proxy reverso

Em producao, a API e o frontend devem ficar atras de proxy reverso com HTTPS.

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
- Falhas de autenticacao.
- Erros de banco.
- Execucao de migrations.
- Jobs futuros de backup e integracoes.

Em producao, e recomendado enviar logs para uma ferramenta centralizada.

### Monitoramento

Monitorar:

- Uso de CPU e memoria.
- Espaco em disco.
- Disponibilidade da API.
- Disponibilidade do banco.
- Tempo de resposta.
- Erros 4xx e 5xx.
- Crescimento do banco.
- Execucao de backups.

### SMTP futuro

O sistema ja possui base para recuperacao de senha, mas em producao o ideal e integrar SMTP real para envio de emails.

Variaveis futuras sugeridas:

```env
SMTP_HOST="smtp.exemplo.com"
SMTP_PORT=587
SMTP_USER="usuario"
SMTP_PASS="senha"
SMTP_FROM="nao-responda@transportadora.com"
```

### Cuidados em producao

- Nunca rodar seed de massa de teste em banco real sem revisar.
- Rodar migrations primeiro em homologacao.
- Fazer backup antes de atualizar versao.
- Usar senhas fortes para usuarios ADMIN.
- Validar CORS apenas para dominio real do frontend.
- Usar banco com volume persistente.
- Documentar qualquer ajuste manual feito no banco.

## Melhorias futuras

Roadmap sugerido para evoluir o sistema:

| Area | Melhoria |
| --- | --- |
| Manutencao preventiva | Plano de revisoes por km, data, horimetro ou tipo de frota. |
| Rastreamento | Integracao com telemetria e posicao dos veiculos. |
| Pneus | Controle de vida util, sulco, recapagem, rodizio e custo por eixo. |
| Abastecimento | Controle detalhado de litros, media, posto, motorista e km. |
| Integracao fiscal | Vinculo com NFe, CTe, MDFe e documentos fiscais. |
| Emissao de documentos | Geracao operacional de ordens de carregamento, comprovantes e manifestos. |
| App mobile | Lancamento de despesas e envio de comprovantes pelo motorista. |
| Integracao GPS | Historico de rotas, paradas, alertas e tempos de viagem. |
| Oficina | Ordens de servico e historico completo de manutencao. |
| Estoque | Pecas, lubrificantes, pneus e insumos. |
| Financeiro avancado | Contas a pagar/receber, vencimentos, baixa e conciliacao. |
| BI | Indicadores por rota, cliente, conjunto, motorista e centro de custo. |
| Anexos | Upload de notas, recibos, fotos e documentos. |
| Permissoes finas | Perfis por modulo e permissao granular. |

## Exemplos de payloads da API

Criar cavalo mecanico:

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

Consultar relatorio filtrado:

```http
GET /api/relatorios/financeiros?dataInicial=2026-05-01&dataFinal=2026-05-31&cavaloMecanicoId=uuid&tipoLancamento=DESPESA&page=1&limit=50
```

## Observacoes tecnicas

- A rota `/caminhoes` foi mantida por compatibilidade com o frontend e com partes existentes do sistema, mas hoje representa o cadastro de cavalos mecanicos.
- A tabela legada `caminhoes` permanece no banco para preservar historico e permitir migracao segura.
- O sistema evita apagar dados automaticamente quando a conversao nao e totalmente confiavel.
- O CSV usa separador `;`, adequado para abertura em Excel configurado em pt-BR.
- O PDF e gerado no backend de forma simples, suficiente para exportacao operacional.
