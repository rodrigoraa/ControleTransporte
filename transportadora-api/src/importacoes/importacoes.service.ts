import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { Prisma, TipoEntidadeImportacao, TipoLancamento, UnidadeQuantidade } from '@prisma/client';
import { composicaoHistoricaSelect, ContextoFrotaHistorica, resolverComposicaoHistorica } from '../caminhoes/composicao-historica';
import { AuditActor, auditUserId } from '../common/audit/audit-context';
import { PrismaService } from '../common/prisma/prisma.service';
import { normalizePlate } from '../common/validation/normalize-plate';
import { CreateLancamentoFinanceiroDto } from '../lancamentos-financeiros/dto/create-lancamento-financeiro.dto';
import { LancamentosFinanceirosService } from '../lancamentos-financeiros/lancamentos-financeiros.service';
import { ORIGEM_IMPORTACAO_CTRC } from './importacao.constants';
import { candidatosNome, hashDadosImportacao, identificadorPessoaExterna, OpcoesImportacao, SelecaoImportacao, validarOpcoesImportacao } from './importacao-lancamentos.helpers';
import { ArquivoImportacao, LinhaPlanilhaLancamento, PlanilhaLancamentos, PlanilhaLancamentosParser } from './planilha-lancamentos.parser';

type Cadastro = { id: string; nome: string };
type StatusLinha = 'PRONTO' | 'DUPLICADO' | 'DUPLICADO_ARQUIVO' | 'PENDENTE_MOTORISTA' | 'PENDENTE_CLIENTE' | 'PLACA_NAO_ENCONTRADA' | 'PENDENTE_COMPOSICAO' | 'PENDENTE_COMISSAO' | 'DADOS_INVALIDOS' | 'CONFLITO';
type LinhaPreview = Omit<LinhaPlanilhaLancamento, 'dadosOriginais' | 'erros'> & {
  cavalo: { id: string; placa: string } | null;
  conjunto: { id: string; nome: string } | null;
  motorista: Cadastro | null;
  cliente: Cadastro | null;
  sugestoesMotorista: Cadastro[];
  sugestoesCliente: Cadastro[];
  quantidadeEixos: number | null;
  comissaoNecessaria: boolean;
  comissao: Pick<SelecaoImportacao, 'tipoComissao' | 'percentualComissao' | 'valorComissaoPorViagem' | 'descontoImpostos'>;
  status: StatusLinha;
  pendencias: string[];
};

@Injectable()
export class ImportacoesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly parser: PlanilhaLancamentosParser,
    private readonly financeiros: LancamentosFinanceirosService,
  ) {}

  async preview(arquivo: ArquivoImportacao, input?: unknown, _actor?: AuditActor) {
    const opcoes = validarOpcoesImportacao(input);
    const planilha = await this.parser.parse(arquivo);
    this.validarArquivoESelecoes(planilha, opcoes);
    const result = await this.prisma.$transaction((tx) => this.prepararPreview(tx, planilha, opcoes), {
      isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 20_000,
    });
    return result.preview;
  }

  async confirmar(arquivo: ArquivoImportacao, input: unknown, actor?: AuditActor) {
    const opcoes = validarOpcoesImportacao(input, true);
    // Parse and hash the uploaded bytes again; preview data and IDs from the browser are never authoritative.
    const planilha = await this.parser.parse(arquivo);
    this.validarArquivoESelecoes(planilha, opcoes);
    for (let tentativa = 0; ; tentativa++) {
      try {
        return await this.prisma.$transaction(async (tx) => {
          const { preview, dados, hashes, frotaHistorica } = await this.prepararPreview(tx, planilha, opcoes);
          const selecionadas = new Set(opcoes.linhasSelecionadas!);
          const linhas = preview.linhas.filter((linha) => selecionadas.has(linha.linha));
          const bloqueadas = linhas.filter((linha) => !['PRONTO', 'DUPLICADO', 'DUPLICADO_ARQUIVO'].includes(linha.status));
          if (bloqueadas.length) throw new BadRequestException(bloqueadas.map((linha) => `Linha ${linha.linha}: ${linha.pendencias.join(' ')}`));
          let importados = 0;
          let duplicadosIgnorados = 0;
          for (const linha of linhas) {
            if (linha.status !== 'PRONTO') {
              duplicadosIgnorados++;
              continue;
            }
            const dto = dados.get(linha.linha)!;
            await this.persistirMapeamentos(tx, linha, dto, actor);
            const lancamento = await this.financeiros.createInTransaction(tx, dto, actor, true, frotaHistorica);
            const original = planilha.linhas.find((item) => item.linha === linha.linha)!;
            const registro = await tx.lancamentoImportado.create({
              data: {
                origem: ORIGEM_IMPORTACAO_CTRC,
                chaveExterna: linha.chaveExterna!,
                lancamentoFinanceiroId: lancamento.id,
                dadosOriginais: original.dadosOriginais as Prisma.InputJsonValue,
                hashDados: hashes.get(linha.linha)!,
                hashArquivo: planilha.hashArquivo,
                nomeArquivo: planilha.arquivo,
                usuarioId: auditUserId(actor),
              },
            });
            await tx.auditoria.create({
              data: {
                entidade: 'lancamentoImportado', entidadeId: registro.id, acao: 'IMPORTACAO', usuarioId: auditUserId(actor),
                dadosDepois: { origem: ORIGEM_IMPORTACAO_CTRC, chaveExterna: linha.chaveExterna, lancamentoFinanceiroId: lancamento.id, hashArquivo: planilha.hashArquivo },
              },
            });
            importados++;
          }
          return { importados, duplicadosIgnorados, erros: 0 };
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 10_000, timeout: 30_000 });
      } catch (error: any) {
        // Unique constraints arbitrate simultaneous confirmation of the same CTRC/mapping.
        // Re-read the whole batch after a race so committed rows become explicit duplicates.
        if (['P2034', 'P2002'].includes(error?.code)) {
          if (tentativa < 3) continue;
          throw new ConflictException('Outra importação alterou estes registros. Atualize a prévia e tente novamente.');
        }
        if (['P2003', 'P2025'].includes(error?.code)) throw new BadRequestException('Um cadastro associado foi alterado. Atualize a prévia antes de confirmar.');
        throw error;
      }
    }
  }

  private validarArquivoESelecoes(planilha: PlanilhaLancamentos, opcoes: OpcoesImportacao) {
    if (opcoes.hashArquivo && opcoes.hashArquivo !== planilha.hashArquivo) throw new BadRequestException('O arquivo é diferente do utilizado na prévia. Selecione o mesmo arquivo novamente.');
    const linhas = new Set(planilha.linhas.map((linha) => linha.linha));
    if ([...(opcoes.linhasSelecionadas || []), ...(opcoes.selecoes || []).map((item) => item.linha)].some((linha) => !linhas.has(linha))) {
      throw new BadRequestException('Uma linha selecionada não existe nesta planilha. Atualize a prévia.');
    }
  }

  private async prepararPreview(tx: Prisma.TransactionClient, planilha: PlanilhaLancamentos, opcoes: OpcoesImportacao) {
    const chaves = planilha.linhas.flatMap((item) => item.chaveExterna ? [item.chaveExterna] : []);
    const [cavalos, conjuntos, motoristas, clientes, mapeamentos, importados] = await Promise.all([
      tx.cavaloMecanico.findMany({ select: { id: true, placa: true } }),
      // Read preserved links and snapshots together in the transaction, including inactive versions.
      tx.conjunto.findMany({ select: composicaoHistoricaSelect }),
      tx.motorista.findMany({ select: { id: true, nome: true } }),
      tx.cliente.findMany({ select: { id: true, nome: true } }),
      tx.mapeamentoImportacao.findMany({ where: { origem: ORIGEM_IMPORTACAO_CTRC } }),
      tx.lancamentoImportado.findMany({ where: { origem: ORIGEM_IMPORTACAO_CTRC, chaveExterna: { in: chaves } }, select: { chaveExterna: true, hashDados: true } }),
    ]);
    const porCavalo = new Map(cavalos.map((item) => [item.id, item]));
    const porConjunto = new Map(conjuntos.map((item) => [item.id, item]));
    const frotaHistorica: ContextoFrotaHistorica = { conjuntos, cavalos: porCavalo };
    const porMotorista = new Map(motoristas.map((item) => [item.id, item]));
    const porCliente = new Map(clientes.map((item) => [item.id, item]));
    const porMapeamento = new Map(mapeamentos.map((item) => [`${item.tipoEntidade}:${item.codigoExterno}`, item]));
    const porImportacao = new Map(importados.map((item) => [item.chaveExterna, item]));
    const selecoes = new Map((opcoes.selecoes || []).map((item) => [item.linha, item]));
    const hashes = new Map(planilha.linhas.map((linha) => [linha.linha, hashDadosImportacao(linha)]));
    const porChave = new Map<string, LinhaPlanilhaLancamento[]>();
    for (const linha of planilha.linhas) {
      if (linha.chaveExterna) porChave.set(linha.chaveExterna, [...(porChave.get(linha.chaveExterna) || []), linha]);
    }
    // A confirmed code/name choice applies throughout this preview, without writing mappings yet.
    const associacoes = new Map<string, string>();
    const associacoesConflitantes = new Set<string>();
    const chavePessoa = (tipo: TipoEntidadeImportacao, pessoa: { codigo: string | null; nome: string }) => `${tipo}:${identificadorPessoaExterna(pessoa)}`;
    for (const linha of planilha.linhas) {
      const selected = selecoes.get(linha.linha);
      for (const [tipo, pessoa, id] of [
        [TipoEntidadeImportacao.MOTORISTA, linha.motoristaExterno, selected?.motoristaId],
        [TipoEntidadeImportacao.CLIENTE, linha.clienteExterno, selected?.clienteId],
      ] as const) {
        if (!id) continue;
        const key = chavePessoa(tipo, pessoa);
        if (associacoes.has(key) && associacoes.get(key) !== id) associacoesConflitantes.add(key);
        associacoes.set(key, id);
      }
    }
    const dados = new Map<number, CreateLancamentoFinanceiroDto>();
    const linhas: LinhaPreview[] = [];
    for (const original of planilha.linhas) {
      const { dadosOriginais: _dadosOriginais, erros, ...source } = original;
      const selected = selecoes.get(original.linha) || { linha: original.linha };
      const pendencias = [...erros];
      let status: StatusLinha = erros.length ? 'DADOS_INVALIDOS' : 'PRONTO';
      const bloquear = (novoStatus: StatusLinha, mensagem: string) => {
        pendencias.push(mensagem);
        if (status === 'PRONTO' || novoStatus === 'CONFLITO') status = novoStatus;
      };
      const placas = cavalos.filter((item) => normalizePlate(item.placa) === original.placa);
      const cavalo = selected.cavaloMecanicoId ? porCavalo.get(selected.cavaloMecanicoId) || null : placas.length === 1 ? placas[0] : null;
      if (!cavalo) bloquear('PLACA_NAO_ENCONTRADA', selected.cavaloMecanicoId ? 'Cavalo selecionado não encontrado.' : placas.length > 1 ? `Placa ${original.placa} corresponde a mais de um cavalo. Selecione o cadastro correto.` : `Cavalo ${original.placa || '(sem placa)'} não encontrado.`);
      const resolverPessoa = (tipo: TipoEntidadeImportacao, pessoa: { codigo: string | null; nome: string }, catalogo: Cadastro[], porId: Map<string, Cadastro>) => {
        const key = chavePessoa(tipo, pessoa);
        const label = tipo === TipoEntidadeImportacao.MOTORISTA ? 'Motorista' : 'Cliente/pagador';
        const mapeamento = porMapeamento.get(`${tipo}:${identificadorPessoaExterna(pessoa)}`);
        const mapeadoId = mapeamento ? (tipo === TipoEntidadeImportacao.MOTORISTA ? mapeamento.motoristaId : mapeamento.clienteId) : null;
        const escolhidoId = associacoes.get(key);
        const candidatos = candidatosNome(pessoa.nome, catalogo);
        if (associacoesConflitantes.has(key)) bloquear('CONFLITO', `${label}: existem associações diferentes para o mesmo código/nome externo.`);
        if (mapeadoId && escolhidoId && mapeadoId !== escolhidoId) bloquear('CONFLITO', `${label}: a identificação externa ${pessoa.codigo || pessoa.nome} já possui outro mapeamento confirmado. Sua alteração exige revisão específica.`);
        const cadastro = escolhidoId ? porId.get(escolhidoId) || null : mapeadoId ? porId.get(mapeadoId) || null : candidatos.exato;
        if (!cadastro) bloquear(tipo === TipoEntidadeImportacao.MOTORISTA ? 'PENDENTE_MOTORISTA' : 'PENDENTE_CLIENTE', `${label} da planilha: ${pessoa.nome || '(não informado)'}. ${escolhidoId ? 'Cadastro selecionado não encontrado.' : 'Selecione uma associação existente.'}`);
        return { cadastro, sugestoes: candidatos.sugestoes };
      };
      const motorista = resolverPessoa(TipoEntidadeImportacao.MOTORISTA, original.motoristaExterno, motoristas, porMotorista);
      const cliente = resolverPessoa(TipoEntidadeImportacao.CLIENTE, original.clienteExterno, clientes, porCliente);
      const composicao = cavalo && original.data
        ? resolverComposicaoHistorica(conjuntos, original.data, cavalo.id)
        : null;
      if (composicao && composicao.status !== 'RESOLVIDA') {
        bloquear('PENDENTE_COMPOSICAO', composicao.motivo);
      }
      const conjunto = composicao?.status === 'RESOLVIDA' && composicao.conjuntoId
        ? porConjunto.get(composicao.conjuntoId) || null
        : null;
      const quantidadeEixos = composicao?.status === 'RESOLVIDA' ? composicao.quantidadeTotalEixos : null;
      const comissaoNecessaria = [4, 7, 9].includes(Number(quantidadeEixos));
      const comissao = {
        tipoComissao: selected.tipoComissao, percentualComissao: selected.percentualComissao,
        valorComissaoPorViagem: selected.valorComissaoPorViagem, descontoImpostos: selected.descontoImpostos,
      };
      if (comissaoNecessaria && !comissao.tipoComissao) bloquear('PENDENTE_COMISSAO', 'Selecione o tipo de comissão: percentual ou por viagem.');
      const repetidas = original.chaveExterna ? porChave.get(original.chaveExterna)! : [];
      const salvo = original.chaveExterna ? porImportacao.get(original.chaveExterna) : undefined;
      const hash = hashes.get(original.linha)!;
      const chaveConflitante = repetidas.some((linha) => hashes.get(linha.linha) !== hash);
      if (chaveConflitante || (salvo && salvo.hashDados !== hash)) {
        bloquear('CONFLITO', 'Este CTRC já foi importado ou está repetido no arquivo, mas os dados da planilha estão diferentes.');
      } else if (salvo && !erros.length && !(['CONFLITO'] as StatusLinha[]).includes(status)) {
        status = 'DUPLICADO';
        pendencias.splice(0, pendencias.length, 'Já importado. O lançamento existente será preservado.');
      } else if (repetidas[0]?.linha !== original.linha && repetidas.length && !erros.length && !(['CONFLITO'] as StatusLinha[]).includes(status)) {
        status = 'DUPLICADO_ARQUIVO';
        pendencias.splice(0, pendencias.length, `CTRC repetido neste arquivo; a primeira ocorrência está na linha ${repetidas[0].linha}.`);
      }
      if (status === 'PRONTO' && cavalo && motorista.cadastro && cliente.cadastro) {
        const dto: CreateLancamentoFinanceiroDto = {
          data: new Date(`${original.data}T00:00:00.000Z`), placa: cavalo.placa, cavaloMecanicoId: cavalo.id,
          conjuntoId: conjunto?.id,
          motoristaId: motorista.cadastro.id, clienteId: cliente.cadastro.id,
          tipoLancamento: TipoLancamento.FATURAMENTO, quantidade: Number(original.peso), unidadeQuantidade: UnidadeQuantidade.KG,
          valorUnitario: Number(original.valor), multiplicarQuantidade: false,
          descricao: `Frete importado - CTRC ${original.dadosOriginais.nr_ctrc || original.dadosOriginais.cd_ctrc || original.chaveExterna?.replace(/^ctrc:/, '')}`,
          observacoes: 'Importado do sistema externo.', ...comissao,
        };
        try {
          await this.financeiros.validateInTransaction(tx, dto, frotaHistorica);
          dados.set(original.linha, dto);
        } catch (error) {
          if (!(error instanceof BadRequestException)) throw error;
          bloquear(/comiss|percentual|viagem/i.test(error.message) ? 'PENDENTE_COMISSAO' : 'DADOS_INVALIDOS', error.message);
        }
      }
      linhas.push({
        ...source, cavalo: cavalo ? { id: cavalo.id, placa: cavalo.placa } : null,
        conjunto: conjunto ? { id: conjunto.id, nome: conjunto.nome } : null,
        motorista: motorista.cadastro, cliente: cliente.cadastro,
        sugestoesMotorista: motorista.sugestoes, sugestoesCliente: cliente.sugestoes,
        quantidadeEixos, comissaoNecessaria, comissao, status, pendencias,
      });
    }
    return {
      preview: {
        hashArquivo: planilha.hashArquivo, arquivo: planilha.arquivo, origem: ORIGEM_IMPORTACAO_CTRC, linhas,
        resumo: {
          total: linhas.length, prontas: linhas.filter((item) => item.status === 'PRONTO').length,
          duplicadas: linhas.filter((item) => ['DUPLICADO', 'DUPLICADO_ARQUIVO'].includes(item.status)).length,
          pendentes: linhas.filter((item) => item.status.startsWith('PENDENTE_') || item.status === 'PLACA_NAO_ENCONTRADA').length,
          invalidas: linhas.filter((item) => item.status === 'DADOS_INVALIDOS').length,
          conflitos: linhas.filter((item) => item.status === 'CONFLITO').length,
        },
      }, dados, hashes, frotaHistorica,
    };
  }

  private async persistirMapeamentos(tx: Prisma.TransactionClient, linha: LinhaPreview, dto: CreateLancamentoFinanceiroDto, actor?: AuditActor) {
    for (const [tipoEntidade, pessoa, entidadeId] of [
      [TipoEntidadeImportacao.MOTORISTA, linha.motoristaExterno, dto.motoristaId],
      [TipoEntidadeImportacao.CLIENTE, linha.clienteExterno, dto.clienteId],
    ] as const) {
      if (!entidadeId || !pessoa.nome) continue;
      const codigoExterno = identificadorPessoaExterna(pessoa);
      const existente = await tx.mapeamentoImportacao.findUnique({ where: { origem_tipoEntidade_codigoExterno: { origem: ORIGEM_IMPORTACAO_CTRC, tipoEntidade, codigoExterno } } });
      if (existente) {
        const id = tipoEntidade === TipoEntidadeImportacao.MOTORISTA ? existente.motoristaId : existente.clienteId;
        if (id !== entidadeId) throw new ConflictException('O código externo já está associado a outro cadastro. Atualize a prévia.');
        continue;
      }
      const mapping = await tx.mapeamentoImportacao.create({
        data: {
          origem: ORIGEM_IMPORTACAO_CTRC, tipoEntidade, codigoExterno, nomeExterno: pessoa.nome,
          motoristaId: tipoEntidade === TipoEntidadeImportacao.MOTORISTA ? entidadeId : null,
          clienteId: tipoEntidade === TipoEntidadeImportacao.CLIENTE ? entidadeId : null,
          criadoPorId: auditUserId(actor),
        },
      });
      await tx.auditoria.create({
        data: { entidade: 'mapeamentoImportacao', entidadeId: mapping.id, acao: 'ASSOCIACAO_IMPORTACAO', usuarioId: auditUserId(actor), dadosDepois: { origem: ORIGEM_IMPORTACAO_CTRC, tipoEntidade, codigoExterno, nomeExterno: pessoa.nome, entidadeId } },
      });
    }
  }
}
