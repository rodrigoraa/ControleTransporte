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

Preview e confirmação reutilizam `LancamentosFinanceirosService`. A composição e os eixos são resolvidos como no cadastro manual, a partir da composição atual na confirmação. Para 4, 7 e 9 eixos, o usuário precisa escolher o tipo de comissão. Os valores padrão existentes continuam disponíveis, sem escolher automaticamente entre percentual e por viagem. A comissão e sua despesa automática seguem os mesmos cálculos do cadastro manual. Linhas fora dessas regras são explicitadas na confirmação como lançamentos sem comissão automática.

## Duplicidade e transação

`LancamentoImportado` possui unicidade de `origem + chaveExterna`. A chave usa `cd_ctrc`; o fallback usa filial, série e número, sem depender de data, placa ou valor. Viagens diferentes com os mesmos valores continuam possíveis.

O fingerprint usa os dados financeiros normalizados e as pessoas externas. Reimportações idênticas são ignoradas explicitamente. Uma chave existente com conteúdo diferente gera conflito, sem modificar o lançamento anterior. Repetições idênticas no arquivo indicam a primeira ocorrência; repetições com dados diferentes bloqueiam essas linhas.

Na confirmação, o arquivo é reenviado e seu SHA-256 deve coincidir com o da prévia. O servidor relê o arquivo e revalida as linhas, associações, comissão e duplicidade. As linhas selecionadas, comissões, mapeamentos, rastreamento e auditorias são gravados na mesma transação `Serializable`. Falhas revertem o lote. Conflitos concorrentes provocam repetição completa e nova leitura de duplicados.

Os vínculos de importação impedem excluir um faturamento importado e perder sua identidade externa. A importação não altera registros financeiros já existentes. Uma correção de CTRC importado ou de mapeamento conflitante precisa de um fluxo específico de revisão, fora deste importador.

## API

As rotas exigem JWT e perfil `ADMIN`:

- `POST /api/importacoes/lancamentos/preview`
- `POST /api/importacoes/lancamentos/confirmar`

Ambas recebem multipart com `arquivo` e `opcoes` JSON. As opções aceitam `hashArquivo`, `selecoes` por número físico da linha e `linhasSelecionadas`. A confirmação exige o hash e a seleção explícita. Seleções permitem `cavaloMecanicoId`, `motoristaId`, `clienteId`, `tipoComissao`, `percentualComissao`, `valorComissaoPorViagem` e `descontoImpostos`. Outros campos são recusados.

## Preparação do ambiente e testes

A migration aditiva `20261011000000_importacao_lancamentos_financeiros` cria os dois modelos, constraints e índices. Antes de disponibilizar a funcionalidade no ambiente de destino, execute os comandos habituais:

```text
npm run prisma:generate --workspace transportadora-api
npm run prisma:deploy
npm run check
```

Os testes de integração criam um PostgreSQL temporário isolado, confirmam sua identidade antes de aplicar migrations e encerram/removem o cluster ao terminar. É necessária uma instalação local de PostgreSQL, ou `POSTGRES_TEST_BIN` apontando para seus binários; sem eles, as integrações são ignoradas. Nenhum teste usa o banco configurado no projeto.

A migration foi validada em banco temporário. A comparação completa entre migrations antigas e schema revelou diferenças preexistentes em índices/defaults da frota. Elas foram preservadas; os modelos novos de importação correspondem à migration. O fluxo habitual de migração deve continuar sendo usado, sem `db push` para corrigir essas diferenças.

As fixtures exercitam os formatos de planilha e o layout informado. A validação com um arquivo real do sistema de origem deve ser repetida quando esse arquivo estiver disponível.
