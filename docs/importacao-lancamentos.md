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

Preview e confirmação reutilizam `LancamentosFinanceirosService` com as mesmas regras do cadastro manual. Ao escolher um cavalo, utiliza-se sua composição atualmente ativa, ordenada por `updatedAt`, como no formulário manual. A data do frete continua sendo a da planilha; ela não exige comprovar vínculos antigos nem cadastrar engates retroativos. A prévia identifica a composição que será usada, os eixos e a comissão.

A composição apresentada deve ser conferida antes da confirmação, especialmente em fretes antigos: usar a composição atual para uma data antiga reproduz o cadastro manual, mas não comprova que aquelas carretas foram usadas naquela viagem. A confirmação relê a frota dentro da transação. O conjunto usado fica vinculado ao lançamento e as comissões guardam seus eixos e valores calculados.

A importação não altera conjuntos, vínculos, datas de engate/desengate ou eventos da frota. Transferências posteriores preservam o conjunto anterior e seus lançamentos. O histórico do cavalo continua mostrando os faturamentos, composições e transferências. A auditoria financeira e o rastreamento do CTRC são gravados junto com o lote.

Se o cavalo não tiver composição ativa, o lançamento pode ser criado sem comissão automática, como no cadastro manual. Essa condição aparece na prévia e na confirmação. A falta de um registro histórico antigo, por si só, não bloqueia a importação. Cavalos, motoristas e pagadores continuam exigindo associações válidas.

O contexto da frota é carregado uma vez por lote e passado ao mesmo serviço financeiro usado no cadastro manual, evitando consultas de composição por linha. A resolução histórica existente permanece disponível para consultas e seus testes; a importação usa explicitamente o modo `CADASTRO_MANUAL`.

Para composições de 4, 7 e 9 eixos, o usuário precisa escolher o tipo de comissão. Os valores padrão existentes continuam disponíveis, sem escolher automaticamente entre percentual e por viagem. A comissão e sua despesa automática seguem os mesmos cálculos do cadastro manual. Linhas fora dessas regras são explicitadas na confirmação como lançamentos sem comissão automática.

A aplicação de comissão em lote informa quantas linhas selecionadas podem recebê-la. Depois de alterar o cavalo, é necessário atualizar a prévia para conferir sua composição e os eixos. O botão fica desabilitado quando nenhuma linha é elegível e informa o motivo. Sem composição ativa, a linha não recebe comissão, mas pode ser importada se as demais associações estiverem prontas.

## Duplicidade e transação

`LancamentoImportado` possui unicidade de `origem + chaveExterna`. A chave usa `cd_ctrc`; o fallback usa filial, série e número, sem depender de data, placa ou valor. Viagens diferentes com os mesmos valores continuam possíveis.

O fingerprint usa os dados financeiros normalizados e as pessoas externas. Reimportações idênticas são ignoradas explicitamente. Uma chave existente com conteúdo diferente gera conflito, sem modificar o lançamento anterior. Repetições idênticas no arquivo indicam a primeira ocorrência; repetições com dados diferentes bloqueiam essas linhas.

Na confirmação, o arquivo é reenviado e seu SHA-256 deve coincidir com o da prévia. O servidor relê o arquivo e revalida as linhas, associações, comissão e duplicidade. As linhas selecionadas, comissões, mapeamentos, rastreamento e auditorias são gravados na mesma transação `Serializable`. Falhas revertem o lote. Conflitos concorrentes provocam repetição completa e nova leitura de duplicados.

Administradores podem usar **Faturamento → Editar** (ícone de lápis) tanto nos faturamentos manuais quanto nos importados. O formulário permite corrigir data, cavalo, motorista, cliente, categoria, descrição, quantidade, unidade, valor, multiplicação, comissão, impostos e observações. Valores totais e despesas de comissão são calculados pelo sistema. O faturamento importado continua identificado por `importacao: { id }`; sua exclusão permanece bloqueada para impedir duplicidades.

A edição grava o faturamento, a atualização/criação/remoção de sua despesa automática e as auditorias anteriores/posteriores na mesma transação `Serializable`, com nova leitura após conflitos concorrentes. Uma falha de auditoria reverte a edição inteira. Alterar o cavalo usa sua composição atual, como no cadastro manual; manter o cavalo preserva o conjunto e os eixos armazenados. A edição financeira não muda engates, desengates ou eventos da frota. A auditoria conserva os valores anteriores; as consultas financeiras mostram o cadastro corrigido.

Os dados originais da planilha, hashes, chave do CTRC e mapeamentos externos permanecem inalterados. Reimportar o mesmo arquivo ignora o CTRC já importado e mantém as correções manuais. Um arquivo com dados originais diferentes para o mesmo CTRC continua gerando conflito. O controle automático, os dados originais e a despesa automática não podem ser editados diretamente; esta deve ser alterada pelo faturamento de origem.

A categoria não vem no layout da planilha e pode ser preenchida depois da importação. Em **Faturamento → Editar** (ícone de lápis), o administrador altera o campo **Categoria** e clica em **Salvar**, junto com os demais campos do faturamento. Valores ausentes aparecem como **Sem categoria**, em vez de `null`. A coluna Ações não possui um botão separado para categoria.

A edição completa usa `PATCH /api/lancamentos-financeiros/:id`, com DTO concreto, JWT e ADMIN, e recalcula os valores pelas regras do cadastro manual. A API anterior `PATCH /api/lancamentos-financeiros/:id/categoria` continua disponível por compatibilidade, sem botão próprio na interface; aceita somente `categoriaId`, exige JWT e ADMIN e grava a classificação e a auditoria na mesma transação, sem recalcular a comissão.

## Controle dos faturamentos

Todos os faturamentos recebem um controle automático exibido como **F01, F02, …, F99, F100**, sem reiniciar por ano. O número aparece na listagem e no formulário, onde é somente para leitura. A busca aceita `F01` ou `1`; a ordenação considera o número, colocando F99 antes de F100. O banco armazena o inteiro em `numeroControle` e a interface aplica a letra F e o mínimo de dois dígitos.

A migration aditiva `20261014000000_controle_faturamentos` numera os faturamentos existentes pela ordem de cadastro (`createdAt`, com desempate por ID), sem alterar seus valores, datas ou vínculos. Os novos continuam a sequência, incluindo os importados. Despesas comuns e comissões automáticas não recebem numeração. A geração usa uma sequência PostgreSQL e índice único, inclusive para cadastros simultâneos; um trigger impede alteração manual do número. Edições e reimportações preservam o controle. Números consumidos por transações desfeitas ou registros excluídos não são reutilizados; podem existir intervalos na sequência.

Para publicar esta versão, aplique as migrations com `npm run prisma:deploy --workspace transportadora-api` antes de iniciar a API atualizada e publique também o frontend. A migration mantém as alterações em uma única transação; a atribuição inicial exige bloqueio da tabela durante sua execução. Ela foi testada somente em PostgreSQL temporário isolado, incluindo dados anteriores à nova coluna.

## Como resolver pendências na tela

Erros de arquivo, conferência ou confirmação aparecem no alto do modal com título, motivo e próximo passo. Depois de uma conferência com pendências, o foco vai para um painel persistente que identifica linha, placa e data. O botão **Como resolver** leva ao formulário e mostra instruções para aquela linha, incluindo pendências adicionais que antes ficavam escondidas pelo status principal.

| Problema | Orientação apresentada |
| --- | --- |
| Cavalo não encontrado | Conferir a placa e escolher o cavalo correto no campo da linha; depois atualizar a prévia. |
| Motorista ou cliente sem associação | Escolher o cadastro correto no campo indicado e atualizar a prévia. |
| Composição usada no cadastro | Conferir a composição atual do cavalo na prévia. Sem composição ativa, o frete segue sem comissão automática, como no cadastro manual; não é exigido registrar vínculos retroativos. |
| Comissão pendente | Escolher percentual ou por viagem, conferir o valor e os impostos e atualizar a prévia. |
| Dados inválidos da planilha | Conferir os detalhes da linha, corrigir o arquivo original e selecionar a versão corrigida. |
| Conflito | Conferir CTRC, valores e associações com o responsável financeiro; preservar o registro já confirmado. |

A consulta de histórico continua mostrando as carretas e as datas de início/fim registradas. A importação não muda esses períodos nem registra uma composição antiga como se estivesse comprovada. O lançamento usa o vínculo selecionado pelas regras do cadastro manual.

Quando há linhas prontas, **Selecionar apenas N linhas prontas** permite continuar com elas, mantendo a confirmação explícita. Quando nenhuma linha está pronta, o painel informa isso. Alterações ainda não conferidas exigem **Atualizar prévia**. Os detalhes técnicos originais continuam disponíveis em **Ver detalhes da conferência**.

A validação inclui a equivalência financeira entre importação e cadastro manual, datas anteriores ao primeiro vínculo, trocas no dia do frete, ausência de composição ativa e preservação de faturamentos/comissões após transferências posteriores. A verificação de navegação/foco em navegador real permanece pendente porque nenhum navegador estava conectado. A publicação no ambiente em uso não foi realizada.

## API

As rotas exigem JWT e perfil `ADMIN`:

- `POST /api/importacoes/lancamentos/preview`
- `POST /api/importacoes/lancamentos/confirmar`

Ambas recebem multipart com `arquivo` e `opcoes` JSON. As opções aceitam `hashArquivo`, `selecoes` por número físico da linha e `linhasSelecionadas`. A confirmação exige o hash e a seleção explícita. Seleções permitem `cavaloMecanicoId`, `motoristaId`, `clienteId`, `tipoComissao`, `percentualComissao`, `valorComissaoPorViagem` e `descontoImpostos`. Outros campos são recusados. Cada linha da resposta informa `modoComposicao: CADASTRO_MANUAL`, diferenciando o uso da composição atual de uma comprovação histórica da viagem.

## Preparação do ambiente e testes

A migration `20261011000000_importacao_lancamentos_financeiros` cria os modelos da importação, constraints e índices. A numeração automática exige também a migration aditiva `20261014000000_controle_faturamentos`. A edição completa utiliza as relações e auditorias já existentes. Para validar o código:

```text
npm ci
npm run prisma:generate --workspace transportadora-api
npm run check
npm run audit:prod
```

O audit precisa consultar o registro online; configurações npm em modo offline podem ocultar advisories. Para publicar em um sistema em uso: faça backup, confira as migrations pendentes e valide em homologação com uma cópia do banco e a planilha real. Gere o Prisma Client e o build da nova versão; aplique as migrations pendentes com `npm run prisma:deploy` e só inicie a nova API após sucesso. Publique o frontend depois. O Compose de produção já depende da conclusão do serviço de migrations. Não execute seed, reset ou `db push` como parte dessa atualização.

Os testes de integração criam um PostgreSQL temporário isolado, confirmam sua identidade antes de aplicar migrations e encerram/removem o cluster ao terminar. É necessária uma instalação local de PostgreSQL, ou `POSTGRES_TEST_BIN` apontando para seus binários; sem eles, as integrações são ignoradas. Nenhum teste usa o banco configurado no projeto.

A migration foi validada em banco temporário. A comparação completa entre migrations antigas e schema revelou diferenças preexistentes em índices/defaults da frota. Elas foram preservadas; os modelos novos de importação correspondem à migration. O fluxo habitual de migração deve continuar sendo usado, sem `db push` para corrigir essas diferenças.

As fixtures exercitam os formatos de planilha e o layout informado. Em 13/10/2026, o leitor real da aplicação também foi executado sobre uma exportação XLS BIFF8 fornecida pelo usuário: 15 lançamentos nas linhas 3 a 17, cabeçalho na linha 2, datas de 09 a 11/10/2026, sem erros de leitura ou CTRCs repetidos dentro do arquivo. O total calculado pelas linhas conferiu com o subtotal da planilha. Os nomes externos já estavam abreviados no conteúdo das células, exigindo associação aos cadastros corretos. A planilha não continha os vínculos históricos das carretas; essa conferência continua dependendo do banco do ambiente em uso. O arquivo foi preservado e nenhum lançamento foi gravado nessa validação. Os dados financeiros reais não foram incorporados aos fixtures do repositório.

## Registro de verificações anteriores

Os resultados abaixo documentam revisões anteriores. A regra de composição vigente é a equivalência com o cadastro manual descrita acima; a exigência de comprovação histórica na importação foi substituída.

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
| [lancamentos-financeiros.service.ts](../transportadora-api/src/lancamentos-financeiros/lancamentos-financeiros.service.ts) | Edição auditada, recálculo de comissão, busca por controle e proteção contra exclusão do importado. |
| [lancamentos-financeiros.service.spec.ts](../transportadora-api/src/lancamentos-financeiros/lancamentos-financeiros.service.spec.ts) | Proteções, contexto histórico e comportamento manual. |
| [transportadora-web/package.json](../transportadora-web/package.json) | Atualizações compatíveis de Axios e React Router. |
| [FinancialImportModal.tsx](../transportadora-web/src/components/FinancialImportModal.tsx) | Exibição da composição/eixos na data e orientação sobre pendências. |
| [FinancialImportModal.test.tsx](../transportadora-web/src/components/FinancialImportModal.test.tsx) | Validação da informação histórica e dos bloqueios exibidos. |
| [CrudPage.tsx](../transportadora-web/src/pages/CrudPage.tsx) | Visualização e edição dos importados, controle automático e identificação da origem junto ao controle. |
| [CrudPage.test.ts](../transportadora-web/src/pages/CrudPage.test.ts) | Ações de registros manuais, importados e protegidos. |
| [crudPermissions.ts](../transportadora-web/src/utils/crudPermissions.ts) | Regra compartilhada das ações disponíveis. |
| [financialImport.ts](../transportadora-web/src/utils/financialImport.ts) | Contrato e tratamento de composição pendente. |
| [financialImport.test.ts](../transportadora-web/src/utils/financialImport.test.ts) | Seleção e comissão em lote respeitando pendências. |
| [importacao-lancamentos.md](importacao-lancamentos.md) | Comportamento, limitações e resultados desta revisão. |
| [dependencias-producao.md](dependencias-producao.md) | Versões, advisories, instalação limpa e limitações restantes. |

## Correção de compatibilidade de 13/10/2026

Foram corrigidos dois falsos bloqueios possíveis em dados legados: horários distintos de gravação/encerramento e recriação dos mesmos vínculos ao editar uma composição. A recuperação depende das provas operacionais descritas acima; snapshots incompletos, cadeias contraditórias e sobreposições permanecem pendentes. A comissão em lote agora usa o mesmo critério de elegibilidade no botão e na aplicação, mostrando a quantidade de linhas aptas e o motivo das demais pendências.

Foram acrescentados 31 testes nesta correção: 16 do helper histórico, 2 integrações em PostgreSQL temporário e 13 do frontend. `npm run check` passou com lint, **480 testes** (378 API e 102 frontend) e os builds da API e da interface. A integração reproduziu notas de 09/10 e 11/10 anteriores à recriação dos mesmos vínculos em 12/10, verificando conjunto, eixos e despesa de comissão. Os registros dos cavalos exibidos nas imagens não foram consultados no banco do ambiente em uso; os cenários foram reproduzidos em banco temporário isolado.

Esta correção alterou o helper histórico e seu spec, o spec de integração da importação, o modal de importação e seu teste, os utilitários de importação e seus testes e este documento. Não houve mudanças de dependências, schema, migrations ou dados de produção. As alterações precisam ser publicadas na API e no frontend antes de atualizar a prévia no ambiente em uso.

## Validação da equivalência com o cadastro manual

Em 13/10/2026, os testes foram ajustados à regra de composição atual do cadastro manual. Foram mantidas as verificações de duplicidade, conflitos de CTRC, rollback, concorrência, auditoria, associação de pessoas, comissão e proteção dos importados. A integração verifica que um faturamento importado continua consultável no histórico do cavalo com o mesmo conjunto, eixos e valores de comissão depois de transferir suas carretas para outro cavalo.

Resultado: **526 testes aprovados**, sendo 380 da API e 146 do frontend; lint e builds aprovados. O audit de produção aprovou o nível HIGH, com zero HIGH/CRITICAL e duas entradas MODERATE já documentadas. Nenhuma dependência, schema, migration ou dado de produção foi alterado. O fluxo de cadastro retroativo proposto durante a análise não faz parte desta implementação. A publicação e a validação visual em navegador real continuam pendentes.

## Classificação manual dos importados — 14/10/2026

A ação **Editar categoria** permite completar a classificação dos faturamentos já importados, sem reenviar a planilha. Foram verificados preenchimento, troca e remoção da categoria; preservação de todos os campos financeiros, comissão e dados originais; reimportação idêntica mantendo a classificação; rejeição de categorias de despesa/inativas e de campos extras; restrição a ADMIN; rollback por falha de auditoria e concorrência com histórico de classificação consistente.

`npm run check` aprovado: **551 testes** (397 API e 154 frontend), lint e os dois builds. `npm run audit:prod` aprovado no nível HIGH, com zero HIGH/CRITICAL e duas entradas MODERATE preexistentes. Sem mudanças de dependências, schema ou migrations, e sem alteração dos dados do ambiente em uso. Nenhum navegador estava conectado para validação visual. A mudança precisa ser publicada na API e no frontend.

## Edição completa e controle automático — 14/10/2026

A versão atual amplia a edição para todos os campos do formulário manual e acrescenta o controle F01, F02, F03… solicitado. A categoria é editada pelo formulário completo. O número é gerado pelo banco, aparece na tabela e no formulário e não é enviado no payload de edição.

`npm run check` aprovado com **582 testes** (419 API e 163 frontend), lint e builds. Os novos cenários verificam atualização de valores e demais campos do importado, recálculo e sincronização da despesa, troca de cavalo sem reescrever a frota, preservação dos dados originais e das correções na reimportação, rollback por falha de auditoria e edição concorrente com histórico consistente. A numeração foi validada com 101 faturamentos anteriores à coluna, continuidade em F102, cadastros simultâneos, proteção contra renumeração, não reutilização após exclusão, busca e ordenação numérica. A interface foi verificada por testes de renderização e regras; não houve teste visual em navegador conectado.

A migration foi aplicada exclusivamente em PostgreSQL temporário de testes. Nenhum banco em uso foi alterado e nenhuma versão foi publicada. Esta etapa altera o schema e exige aplicar a migration descrita em **Controle dos faturamentos** antes de iniciar a API atualizada. Dependências permanecem inalteradas.

## Correção da coluna Ações — 14/10/2026

O botão separado de categoria e seu modal foram removidos da interface. A identificação **Importado** aparece abaixo do controle, e a coluna Ações reúne os ícones com largura fixa e alinhamento central, dentro de uma célula de tabela normal. A categoria continua disponível no formulário do lápis. A correção altera somente frontend e documentação, sem migration ou alteração de API. Lint, **161 testes da interface** e build aprovados. Não havia navegador conectado para inspeção visual.
