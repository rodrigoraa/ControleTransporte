# Manual de Usabilidade - Controle Transporte

Este manual explica como usar o sistema no dia a dia da transportadora. Ele foi escrito para usuários administrativos e operacionais, sem exigir conhecimento técnico.

## 1. Visão Geral

O Controle Transporte organiza as principais informações da operação:

- Clientes e fornecedores.
- Motoristas.
- Cavalos mecânicos e suas composições.
- Despesas.
- Faturamento.
- Relatórios financeiros.
- Usuários do sistema.
- Auditoria das alterações.

O sistema trabalha com a ideia de preservar histórico. Por isso, quando um cadastro já foi usado em lançamentos ou composições, o ideal é inativar em vez de excluir.

## 2. Entrada no Sistema

1. Acesse o endereço do sistema.
2. Informe e-mail e senha.
3. Clique em `Entrar no sistema`.

Se esquecer a senha, use `Esqueci minha senha`. Em produção, a recuperação automática pode estar desativada; nesse caso, solicite a redefinição a um administrador.

## 3. Menu Principal

O menu lateral organiza o sistema por áreas:

- `Dashboard`: resumo geral da operação.
- `Cadastros`: clientes, fornecedores, motoristas, cavalos mecânicos e categorias financeiras.
- `Financeiro`: despesas e faturamento.
- `Análises`: relatórios.
- `Administração`: usuários e auditoria, visível para administradores.

## 4. Status dos Cadastros

Alguns cadastros possuem status como `Ativo`, `Inativo` e `Manutenção`.

### Ativo

Use quando o cadastro está em uso normal.

Exemplos:

- Motorista trabalhando.
- Cavalo mecânico disponível.
- Implemento disponível.
- Categoria financeira ainda utilizada.

### Inativo

Use quando o cadastro não deve mais ser usado, mas precisa continuar no histórico.

Exemplos:

- Motorista que saiu da empresa.
- Cavalo mecânico vendido.
- Implemento que não pertence mais à frota.
- Categoria antiga que não deve aparecer em novos lançamentos.

Importante: inativar não apaga os dados antigos. Os relatórios e auditorias continuam mantendo o histórico.

### Manutenção

Use quando o veículo ou implemento ainda pertence à operação, mas está temporariamente indisponível.

Exemplos:

- Cavalo em oficina.
- Implemento aguardando reparo.

Quando voltar ao uso, altere novamente para `Ativo`.

## 5. Excluir ou Inativar?

Use `Excluir` apenas quando o cadastro foi criado por engano e ainda não possui histórico.

Se o cadastro já aparece em despesas, faturamentos, composições ou auditorias, o sistema pode bloquear a exclusão. Isso evita perder o vínculo histórico dos relatórios.

Regra prática:

- Criou errado e não usou: pode excluir.
- Já usou em algum lançamento ou composição: inative.

## 6. Dashboard

O Dashboard mostra um resumo rápido:

- Total faturado no mês.
- Total de despesas no mês.
- Saldo do mês.
- Cavalos mecânicos ativos.
- Implementos ativos.
- Conjuntos ativos.
- Itens inativos ou em manutenção.
- Motoristas ativos.
- Últimos lançamentos.
- Gráficos de despesas, faturamento e composições.

Use essa tela para acompanhar a situação geral antes de entrar nos detalhes.

## 7. Clientes

Use `Clientes` para cadastrar empresas ou pessoas que geram faturamento.

Campos comuns:

- Nome.
- CPF/CNPJ.
- Telefone.
- E-mail.
- Endereço.
- Observações.
- Ativo.

Clientes usados em faturamentos não devem ser excluídos. Se não forem mais usados, marque como inativos.

## 8. Fornecedores

Use `Fornecedores` para cadastrar postos, oficinas, prestadores de serviço e outras empresas ligadas às despesas.

Campos comuns:

- Nome.
- CPF/CNPJ.
- Telefone.
- E-mail.
- Endereço.
- Observações.
- Ativo.

Fornecedores usados em despesas não devem ser excluídos. Se não forem mais usados, marque como inativos.

## 9. Motoristas

Use `Motoristas` para manter o cadastro dos profissionais.

Campos comuns:

- Nome.
- CPF.
- CNH.
- Categoria da CNH.
- Validade da CNH.
- Telefone.
- Status.
- Observações.

Se um motorista sair da empresa, altere o status para `Inativo`. Isso preserva os lançamentos e relatórios antigos.

## 10. Cavalos Mecânicos

Use `Cavalos mecânicos` para cadastrar o cavalo e, quando necessário, os implementos vinculados.

Campos comuns do cavalo:

- Placa.
- Marca.
- Modelo.
- Ano.
- Tipo de cavalo.
- Motorista atual.
- Cor.
- Chassi.
- Renavam.
- Status.
- Observações.

Tipos de cavalo:

- `Simples / Toco (4x2)`: normalmente 2 eixos.
- `Trucado (6x2)`: normalmente 3 eixos.
- `Traçado (6x4)`: normalmente 3 eixos.

O tipo do cavalo ajuda o sistema a calcular a composição e quantidade total de eixos.

## 11. Implementos e Composição

Na tela de cavalos mecânicos, você pode adicionar implementos como:

- Carreta.
- Semirreboque.
- Reboque.
- Dolly.

Campos comuns do implemento:

- Placa.
- Tipo.
- Carroceria.
- Quantidade de eixos.
- Capacidade.
- Status.
- Observações.

O sistema calcula a composição com base no cavalo e nos implementos.

Regras importantes:

- Uma composição pode ter no máximo duas carretas/reboques.
- Se houver segunda carreta, deve haver dolly.
- Se houver apenas uma carreta, não informe dolly.
- Rodotrem deve usar cavalo trucado ou traçado.
- Carretas devem ter 2 ou 3 eixos.

Ao editar uma composição, o sistema encerra a composição anterior e registra uma nova, preservando o histórico.

## 12. Categorias Financeiras

Use `Categorias financeiras` para classificar despesas e faturamentos.

Exemplos:

- Combustível.
- Manutenção.
- Pneu.
- Frete.
- Pedágio.
- Outros.

Uma categoria pode ser vinculada a:

- Despesa.
- Faturamento.
- Ambos, se o tipo ficar em branco.

Se uma categoria antiga não deve mais ser usada, marque como inativa. Evite excluir categorias que já aparecem em lançamentos.

## 13. Despesas

Use `Despesas` para registrar custos da operação.

Campos comuns:

- Data.
- Cavalo mecânico.
- Motorista.
- Fornecedor.
- Categoria.
- Descrição.
- Quantidade.
- Unidade.
- Valor unitário.
- Observações.

O sistema calcula o valor total automaticamente:

`Quantidade x Valor unitário`

Para despesas, o fornecedor é obrigatório.

## 14. Faturamento

Use `Faturamento` para registrar entradas financeiras.

Campos comuns:

- Data.
- Cavalo mecânico.
- Motorista.
- Cliente.
- Categoria.
- Descrição.
- Quantidade.
- Unidade.
- Valor unitário.
- Observações.

O sistema calcula o valor total automaticamente:

`Quantidade x Valor unitário`

Para faturamento, o cliente é obrigatório.

## 15. Relatórios

Use `Relatórios` para analisar despesas, faturamento e saldo.

Filtros disponíveis:

- Data inicial e final.
- Motorista.
- Cavalo mecânico.
- Implemento.
- Conjunto operacional.
- Tipo de conjunto.
- Quantidade de eixos.
- Placa.
- Fornecedor.
- Cliente.
- Tipo financeiro.
- Categoria.
- Ordenação.

O relatório mostra:

- Total de despesas.
- Total de faturamento.
- Saldo final.
- Lançamentos encontrados.
- Despesas por cavalo.
- Despesas por motorista.
- Faturamento por cavalo.
- Faturamento por motorista.
- Resumo por composição do cavalo.

Também é possível exportar:

- Excel/CSV.
- PDF.

## 16. Usuários

Administradores podem criar e editar usuários.

Campos comuns:

- Nome.
- E-mail.
- Senha.
- Perfil.
- Ativo.

Perfis:

- `Admin`: pode cadastrar, editar, excluir quando permitido, gerenciar usuários e ver auditoria.
- `Usuário`: pode acessar e consultar as áreas liberadas, mas não tem controle administrativo completo.

Ao criar um novo usuário, informe uma senha forte. Ao editar um usuário, a senha pode ficar em branco caso não deseje alterá-la.

## 17. Auditoria

A auditoria registra eventos importantes do sistema, como:

- Criações.
- Atualizações.
- Exclusões permitidas.
- Alterações de composição.
- Recuperação de senha.

Ela mostra:

- Data.
- Ação.
- Registro alterado.
- Usuário responsável.
- Resumo da alteração.
- Dados anteriores e novos.

Use a auditoria para conferir quem alterou determinada informação e quando.

## 18. Boas Práticas

- Inative cadastros antigos em vez de excluir.
- Preencha placas corretamente; o sistema padroniza para letras maiúsculas.
- Mantenha categorias financeiras organizadas.
- Cadastre cliente e fornecedor antes de registrar lançamentos.
- Confira o cavalo mecânico antes de salvar despesas ou faturamentos.
- Use observações para registrar detalhes importantes.
- Revise relatórios por período antes de exportar.
- Mantenha poucos usuários administradores.

## 19. Problemas Comuns

### O sistema não deixa excluir um cadastro

Isso normalmente acontece porque o cadastro já possui histórico. Use `Inativo` em vez de excluir.

### Um motorista não aparece como ativo

Verifique o status do motorista. Se estiver `Inativo`, altere para `Ativo` quando ele voltar a trabalhar.

### Um veículo está parado temporariamente

Use `Manutenção`, não `Inativo`.

### O valor total ficou diferente do esperado

Confira a quantidade e o valor unitário. O sistema multiplica esses dois campos.

### O relatório não mostra dados

Revise os filtros de data, cavalo, motorista, cliente, fornecedor e categoria.

### Não consigo criar usuário

Verifique se a senha foi informada e se possui pelo menos 12 caracteres.

## 20. Fluxo Recomendado no Dia a Dia

1. Cadastre ou atualize clientes e fornecedores.
2. Cadastre motoristas.
3. Cadastre cavalos mecânicos e composições.
4. Cadastre categorias financeiras.
5. Lance despesas e faturamentos.
6. Acompanhe o Dashboard.
7. Gere relatórios periodicamente.
8. Inative cadastros que não serão mais usados.
9. Use a auditoria para conferir alterações importantes.
