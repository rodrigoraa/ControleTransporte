# Dependências de produção — revisão de 11/10/2026

O gate de produção é `npm run audit:prod`, executado na raiz dos workspaces. O comando consulta o registro online explicitamente, omite desenvolvimento/opcionais e falha para HIGH/CRITICAL. As vulnerabilidades MODERATE continuam visíveis no relatório; não há supressão de advisories.

## Diagnóstico e resultado

O ambiente local tinha `NPM_CONFIG_OFFLINE=true`. A execução inicial de `npm audit` sem sobrescrever essa configuração retornava zero, sem comprovar o estado atual do registro. A consulta online do lockfile original identificou **5 pacotes HIGH, 2 MODERATE e nenhum CRITICAL**. As cinco entradas HIGH eram `@nestjs/platform-fastify`, `fastify`, `find-my-way`, `fast-uri` e `axios`; entradas transitivas podem representar os mesmos advisories em mais de um pacote.

Após as atualizações abaixo, `npm run audit:prod` retorna **HIGH 0, CRITICAL 0 e MODERATE 2**, com código de saída 0. As duas entradas restantes correspondem a `react-router` e ao seu dependente `react-router-dom`, por dois advisories ainda sem correção na major 6. Esse resultado se refere ao recorte de produção solicitado, não ao audit completo das ferramentas de desenvolvimento.

## Versões e origem das dependências

| Pacote | Lockfile anterior | Lockfile atualizado | Introdução na aplicação |
| --- | --- | --- | --- |
| `@nestjs/common`, `@nestjs/core`, `@nestjs/platform-fastify` | 11.1.27 | 11.2.7 | Dependências diretas da API. Common/core continuam alinhados pelos overrides existentes. |
| `fastify` | 5.8.5 | **5.12.5** | Transitiva de `@nestjs/platform-fastify`; override explícito na raiz. |
| `find-my-way` | 9.6.0 | 9.7.0 | Adapter Nest/Fastify e `@fastify/middie`. |
| `fast-uri` | 3.1.2 | 3.1.8 e 4.2.2 | `ajv` continua na linha compatível 3; os compiladores atualizados do Fastify usam a linha 4. |
| `axios` | 1.18.0 | 1.20.0 | Dependência direta do frontend. |
| `react-router-dom`, `react-router` | 6.30.4 | 6.30.6 | Router DOM direto do frontend; Router transitivo. |
| `@remix-run/router` | 1.23.3 | 1.23.4 | Transitiva dos dois pacotes Router. |

Nest 11, Fastify 5, React 18, React Router 6, Prisma 5 e SheetJS 0.20.3 foram preservados. Não foi usado `npm audit fix --force`. O refresh do grafo Nest/Fastify também atualizou seus compiladores, CORS, roteador, proxy e utilitários transitivos conforme os ranges declarados pelos mantenedores; os manifests das demais dependências não foram alterados.

### Por que o override de Fastify é necessário

Mesmo `@nestjs/platform-fastify@11.2.7` declara **`fastify: "5.11.3"`**, versão abaixo das correções de validação/autorização em 5.12.2 e de HTTP/2 em 5.12.5. Apenas atualizar o adapter mantém vulnerabilidades HIGH. A raiz fixa `fastify: "5.12.5"` para manter a major 5 e tornar a versão corrigida reproduzível. A declaração upstream pode ser consultada no [manifest do adapter 11.2.7](https://github.com/nestjs/nest/blob/v11.2.7/packages/platform-fastify/package.json). O override pode ser reavaliado quando o adapter passar a declarar uma versão que cubra todos os advisories abaixo.

## Advisories removidos do audit de produção

Os ranges da tabela são os que atingiam a versão originalmente instalada, conforme a consulta online do npm. Eles não pretendem enumerar outras linhas antigas de cada biblioteca.

| Pacote / advisory oficial | Range afetado consultado | Impacto | Correção adotada |
| --- | --- | --- | --- |
| Nest [GHSA-9c5c-9qcx-q35q](https://github.com/nestjs/nest/security/advisories/GHSA-9c5c-9qcx-q35q) | `<11.2.4` na major 11 | Requisições HTTP absolute-form podem escapar de middleware limitado a caminhos. | Adapter 11.2.7. |
| Fastify [GHSA-667r-xxjv-c9mm](https://github.com/fastify/fastify/security/advisories/GHSA-667r-xxjv-c9mm) | `<5.12.2` | Colisão de propriedades em validação assíncrona. | 5.12.5. |
| Fastify [GHSA-p68q-wchp-6fh7](https://github.com/fastify/fastify/security/advisories/GHSA-p68q-wchp-6fh7) | `>=4 <5.12.2` | Bypass de autenticação em URL malformada. | 5.12.5. |
| Fastify [GHSA-hwr6-493r-vm6h](https://github.com/fastify/fastify/security/advisories/GHSA-hwr6-493r-vm6h) | `<5.12.2` | Tratamento incorreto de schemas booleanos `false`. | 5.12.5. |
| Fastify [GHSA-9q9j-q6p8-xq58](https://github.com/fastify/fastify/security/advisories/GHSA-9q9j-q6p8-xq58) | `<5.12.2` | Bypass de validação por diferenças de caixa nos headers. | 5.12.5. |
| Fastify [GHSA-w2qp-rph6-63g4](https://github.com/fastify/fastify/security/advisories/GHSA-w2qp-rph6-63g4) | `<5.12.1` | Coerção de valores primitivos. | 5.12.5. |
| Fastify [GHSA-3m5p-2c4r-xxw2](https://github.com/fastify/fastify/security/advisories/GHSA-3m5p-2c4r-xxw2) | `>=5.8.3 <5.12.1` | Contagem incorreta de hops de proxy confiável. | 5.12.5. |
| Fastify [GHSA-4mh8-r7rc-xpvc](https://github.com/fastify/fastify/security/advisories/GHSA-4mh8-r7rc-xpvc) | `<5.12.5` | Queda do processo em cenário de HTTP/2 com trailers. | 5.12.5. |
| find-my-way [GHSA-c96f-x56v-gq3h](https://github.com/delvedor/find-my-way/security/advisories/GHSA-c96f-x56v-gq3h) | `<=9.6.0` | Negação de serviço via HTTP/2. | 9.7.0. |
| fast-uri [GHSA-v2hh-gcrm-f6hx](https://github.com/fastify/fast-uri/security/advisories/GHSA-v2hh-gcrm-f6hx) | `>=3 <=3.1.3` | Interpretação de barra invertida na autoridade. | 3.1.8 / 4.2.2. |
| fast-uri [GHSA-7p8r-x3mc-p8w7](https://github.com/fastify/fast-uri/security/advisories/GHSA-7p8r-x3mc-p8w7) | `>=3 <3.1.5` | Interpretação de barra invertida como início de autoridade. | 3.1.8 / 4.2.2. |
| fast-uri [GHSA-f65p-4m7j-42xc](https://github.com/fastify/fast-uri/security/advisories/GHSA-f65p-4m7j-42xc) | `>=3 <3.1.6` | Host IPv6 malformado pode contornar validação e permitir SSRF. | 3.1.8 / 4.2.2. |
| fast-uri [GHSA-fph4-wmhf-6fwf](https://github.com/fastify/fast-uri/security/advisories/GHSA-fph4-wmhf-6fwf) | `>=3.1.2 <3.1.6` | Decodificação repetida de percentuais pode contornar validação de URLs. | 3.1.8 / 4.2.2. |
| fast-uri [GHSA-jqff-g426-hqxp](https://github.com/fastify/fast-uri/security/advisories/GHSA-jqff-g426-hqxp) | `>=3 <3.1.6` | Esquema codificado pode contornar validação. | 3.1.8 / 4.2.2. |
| fast-uri [GHSA-4c8g-83qw-93j6](https://github.com/fastify/fast-uri/security/advisories/GHSA-4c8g-83qw-93j6) | `>=3 <3.1.3` | Normalização IDN incorreta. | 3.1.8 / 4.2.2. |
| fast-uri [GHSA-qw65-cvwx-89v3](https://github.com/fastify/fast-uri/security/advisories/GHSA-qw65-cvwx-89v3) | `>=3 <3.1.7` | Serialização sem validar a porta. | 3.1.8 / 4.2.2. |
| fast-uri [GHSA-hrr3-gc8f-f4qj](https://github.com/fastify/fast-uri/security/advisories/GHSA-hrr3-gc8f-f4qj) | `>=3 <3.1.8` | Normalização inconsistente de caixa no host codificado. | 3.1.8 / 4.2.2. |
| Axios [GHSA-c29m-xwm3-cm6r](https://github.com/axios/axios/security/advisories/GHSA-c29m-xwm3-cm6r) | `>=1.16.1 <1.20.0` | ReDoS ao interpretar `data:` no adapter Node. | 1.20.0. |
| Axios [GHSA-mghh-pgcx-3jjj](https://github.com/axios/axios/security/advisories/GHSA-mghh-pgcx-3jjj) | `>=1.15.0 <1.20.0` | ReDoS na normalização de proxy. | 1.20.0. |
| Axios [GHSA-x97p-jq2g-jp4f](https://github.com/axios/axios/security/advisories/GHSA-x97p-jq2g-jp4f) | `>=1.15.1 <1.20.0` | Propriedades herdadas ao converter FormData. | 1.20.0. |
| Axios [GHSA-3pq3-5fj3-cg6v](https://github.com/axios/axios/security/advisories/GHSA-3pq3-5fj3-cg6v) | `>=1.13.0 <1.20.0` | Bypass de DNS/proxy no adapter HTTP/2. | 1.20.0. |
| Axios [GHSA-542g-h47m-68v8](https://github.com/axios/axios/security/advisories/GHSA-542g-h47m-68v8) | `>=1.13.0 <1.20.0` | Erro não tratado no adapter HTTP/2. | 1.20.0. |
| Axios [GHSA-m8m8-qj5v-23w3](https://github.com/axios/axios/security/advisories/GHSA-m8m8-qj5v-23w3) | `>=1.15.2 <1.20.0` | `createConnection` herdado pode alterar a conexão de socket. | 1.20.0. |
| Axios [GHSA-r4gj-5m52-g5wh](https://github.com/axios/axios/security/advisories/GHSA-r4gj-5m52-g5wh) | `>=1.17.0 <1.20.0` | Bypass de `maxRedirects: 0` no adapter fetch com risco de SSRF. | 1.20.0. |
| Axios [GHSA-vh66-26gq-q6x8](https://github.com/axios/axios/security/advisories/GHSA-vh66-26gq-q6x8) | `>=1.7.0 <1.20.0` | Gadget de propriedades herdadas no adapter fetch. | 1.20.0. |
| Axios [GHSA-9fr6-4gfg-395g](https://github.com/axios/axios/security/advisories/GHSA-9fr6-4gfg-395g) | `>=1 <1.20.0` | Método herdado na instância padrão. | 1.20.0. |
| Axios [GHSA-j8rh-479h-cp32](https://github.com/axios/axios/security/advisories/GHSA-j8rh-479h-cp32) | `>=1 <1.20.0` | Headers herdados. | 1.20.0. |
| Axios [GHSA-4hqw-qxg8-jxx2](https://github.com/axios/axios/security/advisories/GHSA-4hqw-qxg8-jxx2) | `>=1.12.0 <1.20.0` | `getHeaders` herdado em FormData. | 1.20.0. |
| Axios [GHSA-44g4-m2mj-wpvx](https://github.com/axios/axios/security/advisories/GHSA-44g4-m2mj-wpvx) | `>=1.15.0 <1.20.0` | Tratamento de CIDR em `NO_PROXY`. | 1.20.0. |
| React Router DOM [GHSA-jjmj-jmhj-qwj2](https://github.com/remix-run/react-router/security/advisories/GHSA-jjmj-jmhj-qwj2) | `>=6.30.2 <=6.30.5` no audit | Redirecionamento aberto com possibilidade de XSS em aplicações que aceitam destinos não confiáveis. | Backport 6.30.6. |

A presença de um advisory no grafo não comprova exploração neste projeto. Por exemplo, parte das falhas Axios exige o adapter Node, enquanto a aplicação o usa no navegador. A atualização cobre o pacote integralmente e evita depender dessas condições de uso como substituto da correção.

## Moderadas restantes e migração futura

| Advisory | Versões afetadas / corrigidas | Avaliação do projeto |
| --- | --- | --- |
| [GHSA-wrjc-x8rr-h8h6](https://github.com/remix-run/react-router/security/advisories/GHSA-wrjc-x8rr-h8h6) | `>=6 <7.18.0`; corrigido `>=7.18.0` | Destinos com barra invertida podem redirecionar para origem externa. A aplicação usa HashRouter e destinos locais definidos pelo código; essa observação não remove o advisory do pacote. |
| [GHSA-337j-9hxr-rhxg](https://github.com/remix-run/react-router/security/advisories/GHSA-337j-9hxr-rhxg) | `>=6.4.0 <7.18.0`; corrigido `>=7.18.0` | Injeção de construtor na hidratação SSR. O mantenedor exclui Declarative Mode; este frontend monta HashRouter no cliente, sem SSR/hidratação manual. |

Não há backport oficial desses dois avisos na major 6 na data da revisão. Recomenda-se planejar uma migração separada para React Router **7.18.4 ou superior corrigida**, validando navegação, autenticação, lazy loading e HashRouter. A major 6 foi mantida nesta alteração para preservar o escopo e a compatibilidade solicitada.

## Instalação e reprodução

O ambiente avaliado usa Node 24.11.0 e npm 11.6.1. Durante instalações incrementais, esse npm ignorou overrides através de links de workspace. O problema e a correção são documentados no [PR oficial npm #9671](https://github.com/npm/cli/pull/9671), com backport para a linha 11. O lockfile foi resolvido com npm 11.21.0 temporário e o override final de Fastify foi simplificado para global na raiz. Nenhum npm global foi alterado.

`npm ci --dry-run --ignore-scripts --offline=false --prefer-online` e, em seguida, **`npm ci --offline=false --prefer-online` com o npm padrão 11.6.1** passaram com código de saída 0. A instalação limpa instalou 811 pacotes; a resolução efetiva a partir do adapter confirmou Nest 11.2.7 e Fastify 5.12.5, com Prisma e multipart disponíveis. O audit online após essa instalação manteve HIGH 0 / CRITICAL 0 / MODERATE 2, código 0. O lockfile não foi regravado por `ci`.

O `npm ls` do npm 11.6.1 ainda rotula Fastify como `invalid` por comparar com o pin upstream sem reconhecer o override através do workspace; o mesmo comando com npm 11.21.0 retorna código 0 e `fastify@5.12.5 overridden`. Isso não impediu a instalação limpa padrão nem alterou a versão carregada pela aplicação. Para futuras alterações incrementais de dependências, use um npm corrigido e confirme o resultado com `npm ls` e o audit online; uma instalação que silenciosamente omite pacotes não valida o gate. Não foi necessário alterar CI ou Docker para reproduzir a instalação limpa.

Comandos de validação da raiz:

```sh
npm ci --offline=false --prefer-online
npm run prisma:generate --workspace transportadora-api
npm run lint
npm test
npm run build
npm run audit:prod
npm run check
```

O `--offline=false` do script `audit:prod` prevalece sobre a configuração offline local. Falha de acesso ao registro deve ser tratada como falha de verificação, sem aceitar um relatório antigo como evidência de segurança atual.
