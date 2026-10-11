# Importação de faturamentos por planilha

Administradores podem abrir **Faturamento → Importar planilha**, selecionar o arquivo, conferir a prévia, resolver associações e comissão e confirmar as linhas escolhidas. A listagem é atualizada após a confirmação. A seleção do arquivo e a atualização da prévia não gravam lançamentos nem mapeamentos.

## Layout e limites

A origem está centralizada em `ORIGEM_IMPORTACAO_CTRC = SISTEMA_CLIENTE_CTRC`. São aceitos `.xls` e `.xlsx`, incluindo os formatos legados Excel reconhecidos pelo leitor. Os cabeçalhos devem conter `dt_emissao`, `ds_placa`, `vl_peso`, `nm_pessoa_motorista`, `nm_pagador` e `vl_total`. A identificação exige `cd_ctrc` ou as três colunas `cd_pessoa_filial`, `ds_serie` e `nr_ctrc`.

O limite padrão é 5 MiB, configurável por `IMPORT_MAX_FILE_BYTES` até 10 MiB, inclusive no Compose de produção. O proxy libera até 11 MiB somente nas rotas de importação para acomodar arquivo, opções e multipart; o limite efetivo do arquivo continua validado na API. Também há limites de 1.000 linhas, 256 colunas, 32 MiB descompactados e tempo/memória para a leitura. Arquivos enviados não são gravados em disco nem publicados. Extensão, MIME, estrutura, layout e valores são verificados no servidor.

Datas brasileiras, ISO e seriais Excel são convertidas para a data calendário da planilha e armazenadas à meia-noite UTC. Números reais de células são tratados diretamente; representações brasileiras como `32.500` e `4.850,00` são reconhecidas. Valores inválidos ou com precisão excedente permanecem pendentes, sem arredondamento silencioso.

## Associações

A placa é comparada exatamente depois da normalização já utilizada pelo projeto. Cavalos não são criados automaticamente; é possível escolher um cadastro existente para resolver uma placa não encontrada.

Motoristas e pagadores usam primeiro os mapeamentos confirmados, depois um nome normalizado com correspondência única. Similaridade e nomes exatos ambíguos geram sugestões que exigem escolha explícita. O texto original permanece preservado. A confirmação grava `MapeamentoImportacao` para motorista e cliente, com origem, identificação externa e usuário.

Quando existe código numérico no padrão `CODIGO / NOME`, esse código identifica a pessoa. Sem código, a identificação persistida utiliza `nome:NOME_NORMALIZADO`. Escolher um destino diferente de um mapeamento já confirmado gera conflito; a importação não sobrescreve o mapeamento anterior.

## Financeiro e comissão

Cada linha importada cria `FATURAMENTO`, quantidade em `KG`, `valorUnitario = vl_total` e `multiplicarQuantidade = false`. Assim, o peso nunca multiplica o valor do frete.

Preview e confirmação reutilizam `LancamentosFinanceirosService`. Na importação, a composição é determinada pela data de emissão do faturamento, consultando os vínculos e snapshots históricos existentes, inclusive de conjuntos atualmente inativos. `conjuntoId`, eixos e comissão usam essa mesma resolução. O cadastro e a edição manuais mantêm seu comportamento anterior.

O período operacional é `[dataInicio, dataFim)`: início inclusivo, fim exclusivo; fim nulo representa vínculo vigente. Encerramento e novo engate usam o mesmo instante na transferência. Como a planilha informa somente a data, a resolução exige uma composição inequívoca durante o dia calendário UTC inteiro. Uma transferência exatamente à meia-noite permite usar a nova composição nesse dia. Trocas intradia, períodos sobrepostos, vínculos incompletos e alterações estruturais legadas que impeçam reconstruir o conjunto com segurança geram `PENDENTE_COMPOSICAO`, sem criação financeira. A composição atual só é usada quando seu histórico comprova a vigência na data informada; ela não preenche lacunas anteriores ao primeiro vínculo conhecido.

Conjuntos sem implementos dependem dos registros de criação e encerramento no histórico operacional. Não se usa `updatedAt` como término de operação nem se recalculam eixos antigos pelos cadastros atuais dos implementos. As consultas históricas são carregadas em lote dentro da transação e a confirmação relê esses dados.

Para 4, 7 e 9 eixos históricos, o usuário precisa escolher o tipo de comissão. Os valores padrão existentes continuam disponíveis, sem escolher automaticamente entre percentual e por viagem. A comissão e sua despesa automática seguem os mesmos cálculos do cadastro manual. Linhas fora dessas regras são explicitadas na confirmação como lançamentos sem comissão automática.

## Duplicidade e transação

`LancamentoImportado` possui unicidade de `origem + chaveExterna`. A chave usa `cd_ctrc`; o fallback usa filial, série e número, sem depender de data, placa ou valor. Viagens diferentes com os mesmos valores continuam possíveis.

O fingerprint usa os dados financeiros normalizados e as pessoas externas. Reimportações idênticas são ignoradas explicitamente. Uma chave existente com conteúdo diferente gera conflito, sem modificar o lançamento anterior. Repetições idênticas no arquivo indicam a primeira ocorrência; repetições com dados diferentes bloqueiam essas linhas.

Na confirmação, o arquivo é reenviado e seu SHA-256 deve coincidir com o da prévia. O servidor relê o arquivo e revalida as linhas, associações, comissão e duplicidade. As linhas selecionadas, comissões, mapeamentos, rastreamento e auditorias são gravados na mesma transação `Serializable`. Falhas revertem o lote. Conflitos concorrentes provocam repetição completa e nova leitura de duplicados.

Os vínculos de importação impedem editar ou excluir um faturamento importado pelo CRUD comum, preservando a consistência entre financeiro, dados originais e hash. A API recusa essas ações antes de recalcular comissão ou gravar dados; a listagem informa `importacao: { id }` e a interface oferece apenas visualização para esses registros. Lançamentos manuais continuam editáveis pelas regras anteriores, e despesas automáticas de comissão mantêm sua proteção própria. Uma correção de CTRC importado ou de mapeamento conflitante precisa de um fluxo específico de revisão, fora deste importador.

## API

As rotas exigem JWT e perfil `ADMIN`:

- `POST /api/importacoes/lancamentos/preview`
- `POST /api/importacoes/lancamentos/confirmar`

Ambas recebem multipart com `arquivo` e `opcoes` JSON. As opções aceitam `hashArquivo`, `selecoes` por número físico da linha e `linhasSelecionadas`. A confirmação exige o hash e a seleção explícita. Seleções permitem `cavaloMecanicoId`, `motoristaId`, `clienteId`, `tipoComissao`, `percentualComissao`, `valorComissaoPorViagem` e `descontoImpostos`. Outros campos são recusados.

## Preparação do ambiente e testes

A migration aditiva `20261011000000_importacao_lancamentos_financeiros` cria os dois modelos, constraints e índices. As correções de composição histórica e proteção de edição reutilizam o schema existente e não exigem nova migration. Para validar o código:

```text
npm ci
npm run prisma:generate --workspace transportadora-api
npm run check
npm run audit:prod
```

O audit precisa consultar o registro online; configurações npm em modo offline podem ocultar advisories. Para publicar em um sistema em uso: faça backup, confira as migrations pendentes e valide em homologação com uma cópia do banco e a planilha real. Gere o Prisma Client e o build da nova versão; aplique as migrations pendentes com `npm run prisma:deploy` e só inicie a nova API após sucesso. Publique o frontend depois. O Compose de produção já depende da conclusão do serviço de migrations. Não execute seed, reset ou `db push` como parte dessa atualização.

Os testes de integração criam um PostgreSQL temporário isolado, confirmam sua identidade antes de aplicar migrations e encerram/removem o cluster ao terminar. É necessária uma instalação local de PostgreSQL, ou `POSTGRES_TEST_BIN` apontando para seus binários; sem eles, as integrações são ignoradas. Nenhum teste usa o banco configurado no projeto.

A migration foi validada em banco temporário. A comparação completa entre migrations antigas e schema revelou diferenças preexistentes em índices/defaults da frota. Elas foram preservadas; os modelos novos de importação correspondem à migration. O fluxo habitual de migração deve continuar sendo usado, sem `db push` para corrigir essas diferenças.

As fixtures exercitam os formatos de planilha e o layout informado. A validação com um arquivo real do sistema de origem deve ser repetida quando esse arquivo estiver disponível.

## Resultado da revisão de 11/10/2026

A revisão foi realizada sobre a importação já existente. O problema corrigido era o uso do conjunto atualmente ativo para um faturamento antigo, inclusive depois da transferência dos implementos. A resolução compartilhada agora consulta a vigência na data do faturamento e fornece o mesmo conjunto e os mesmos eixos ao preview, à confirmação e ao cálculo financeiro. Histórico insuficiente ou ambíguo bloqueia a linha; não existe seleção arbitrária nem substituição silenciosa pela composição atual.

Foram acrescentados **59 testes**: 23 da resolução histórica, 18 do serviço financeiro, 8 de integração da importação e 10 da interface. Eles cobrem a composição anterior e posterior a uma transferência real, o limite à meia-noite, trocas intradia, sobreposição, ausência de histórico, revalidação na confirmação, comissão histórica de 7 eixos, consulta e proteção do importado, integridade dos dados após tentativas recusadas e edição/recalculo do lançamento manual. As verificações anteriores de formatos, duplicidade, conflitos, rollback, concorrência, auditoria, permissões e limites continuam na suíte.

| Verificação executada | Resultado local |
| --- | --- |
| `npm ci --offline=false --prefer-online` com npm padrão 11.6.1 | Aprovado; instalação limpa reproduziu as versões corrigidas. |
| `npm run prisma:generate --workspace transportadora-api` | Aprovado; Prisma Client 5.22.0. |
| `npm run lint` | API e frontend aprovados. |
| `npm test` | **449 testes aprovados**: 360 da API em 26 suítes e 89 do frontend em 13 arquivos; nenhuma integração ignorada nesta execução. |
| `npm run build` | API e frontend aprovados. |
| `npm run audit:prod` | Aprovado, saída 0: **0 HIGH, 0 CRITICAL, 2 MODERATE**. |
| `npm run check` | Aprovado; repetiu lint, os 449 testes e os dois builds. |
| `git diff --check` | Aprovado. |

As versões principais resultantes são Nest **11.2.7**, Fastify **5.12.5**, find-my-way **9.7.0**, fast-uri **3.1.8 / 4.2.2**, Axios **1.20.0** e React Router/DOM **6.30.6**. As duas entradas MODERATE restantes do Router, seus advisories, condições de impacto, motivo para preservar a major 6 e migração recomendada estão em [dependencias-producao.md](dependencias-producao.md). O documento também registra o diagnóstico de overrides do npm 11.6.1 e sua diferença em relação à versão efetivamente instalada.

Não houve alteração de schema, nova migration, reset, `db push` ou alteração de dados de produção. Os comandos equivalentes ao workflow Quality passaram localmente; o workflow remoto não foi disparado nesta tarefa. A homologação com cópia do banco e uma planilha real ainda depende desses dados. Faturamentos cujo histórico legado não permita determinar a composição continuarão pendentes, e a correção de CTRCs importados permanece fora do CRUD comum.

Arquivos alterados ou criados nesta revisão:

| Arquivo | Alteração |
| --- | --- |
| [package.json](../package.json) | Audit explicitamente online e overrides compatíveis. |
| [package-lock.json](../package-lock.json) | Grafo de dependências corrigido e reproduzível. |
| [transportadora-api/package.json](../transportadora-api/package.json) | Atualização controlada do Nest. |
| [composicao-historica.ts](../transportadora-api/src/caminhoes/composicao-historica.ts) | Selector e resolução histórica compartilhada. |
| [composicao-historica.spec.ts](../transportadora-api/src/caminhoes/composicao-historica.spec.ts) | Testes de vigência, limites e inconsistências históricas. |
| [importacoes.service.ts](../transportadora-api/src/importacoes/importacoes.service.ts) | Carga histórica em lote, pendências e contexto transacional. |
| [importacoes.integration.spec.ts](../transportadora-api/src/importacoes/importacoes.integration.spec.ts) | Cenários reais de transferência, financeiro e rastreabilidade. |
| [lancamentos-financeiros.service.ts](../transportadora-api/src/lancamentos-financeiros/lancamentos-financeiros.service.ts) | Bloqueio de edição/exclusão e composição histórica na importação. |
| [lancamentos-financeiros.service.spec.ts](../transportadora-api/src/lancamentos-financeiros/lancamentos-financeiros.service.spec.ts) | Proteções, contexto histórico e comportamento manual. |
| [transportadora-web/package.json](../transportadora-web/package.json) | Atualizações compatíveis de Axios e React Router. |
| [FinancialImportModal.tsx](../transportadora-web/src/components/FinancialImportModal.tsx) | Exibição da composição/eixos na data e orientação sobre pendências. |
| [FinancialImportModal.test.tsx](../transportadora-web/src/components/FinancialImportModal.test.tsx) | Validação da informação histórica e dos bloqueios exibidos. |
| [CrudPage.tsx](../transportadora-web/src/pages/CrudPage.tsx) | Importados com visualização e sem editar/excluir. |
| [CrudPage.test.ts](../transportadora-web/src/pages/CrudPage.test.ts) | Ações de registros manuais, importados e protegidos. |
| [crudPermissions.ts](../transportadora-web/src/utils/crudPermissions.ts) | Regra compartilhada das ações disponíveis. |
| [financialImport.ts](../transportadora-web/src/utils/financialImport.ts) | Contrato e tratamento de composição pendente. |
| [financialImport.test.ts](../transportadora-web/src/utils/financialImport.test.ts) | Seleção e comissão em lote respeitando pendências. |
| [importacao-lancamentos.md](importacao-lancamentos.md) | Comportamento, limitações e resultados desta revisão. |
| [dependencias-producao.md](dependencias-producao.md) | Versões, advisories, instalação limpa e limitações restantes. |
