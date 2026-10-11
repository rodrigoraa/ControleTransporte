import { createHash } from 'node:crypto';
import { BadRequestException } from '@nestjs/common';
import { TipoComissao } from '@prisma/client';

export type SelecaoImportacao = {
  linha: number;
  cavaloMecanicoId?: string;
  motoristaId?: string;
  clienteId?: string;
  tipoComissao?: TipoComissao;
  percentualComissao?: number;
  valorComissaoPorViagem?: number;
  descontoImpostos?: boolean;
};

export type OpcoesImportacao = {
  hashArquivo?: string;
  selecoes?: SelecaoImportacao[];
  linhasSelecionadas?: number[];
};

const ownObject = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

export function validarOpcoesImportacao(value: unknown, confirmar = false): OpcoesImportacao {
  if (value === undefined || value === null) value = {};
  if (!ownObject(value)) throw new BadRequestException('As opções da importação devem ser um objeto.');
  const allowed = new Set(['hashArquivo', 'selecoes', 'linhasSelecionadas']);
  if (Object.keys(value).some((key) => !allowed.has(key))) throw new BadRequestException('Opção de importação não permitida.');
  if ((confirmar || value.hashArquivo !== undefined) && (typeof value.hashArquivo !== 'string' || !/^[a-f0-9]{64}$/.test(value.hashArquivo))) {
    throw new BadRequestException('A confirmação deve informar o hash válido do arquivo da prévia.');
  }
  if (confirmar && (!Array.isArray(value.linhasSelecionadas) || !value.linhasSelecionadas.length)) {
    throw new BadRequestException('Selecione pelo menos uma linha para importar.');
  }
  const linhaValida = (linha: unknown) => Number.isInteger(linha) && Number(linha) > 0;
  if (value.linhasSelecionadas !== undefined) {
    if (!Array.isArray(value.linhasSelecionadas) || value.linhasSelecionadas.length > 1000 || !value.linhasSelecionadas.every(linhaValida)
      || new Set(value.linhasSelecionadas).size !== value.linhasSelecionadas.length) {
      throw new BadRequestException('A lista de linhas selecionadas é inválida ou contém repetições.');
    }
  }
  if (value.selecoes !== undefined) {
    if (!Array.isArray(value.selecoes) || value.selecoes.length > 1000) throw new BadRequestException('As associações da importação são inválidas.');
    const fields = new Set(['linha', 'cavaloMecanicoId', 'motoristaId', 'clienteId', 'tipoComissao', 'percentualComissao', 'valorComissaoPorViagem', 'descontoImpostos']);
    const used = new Set<number>();
    for (const selection of value.selecoes) {
      if (!ownObject(selection) || !linhaValida(selection.linha) || used.has(Number(selection.linha)) || Object.keys(selection).some((key) => !fields.has(key))) {
        throw new BadRequestException('Uma associação possui linha repetida ou campos inválidos.');
      }
      used.add(Number(selection.linha));
      for (const field of ['cavaloMecanicoId', 'motoristaId', 'clienteId']) {
        if (selection[field] !== undefined && (typeof selection[field] !== 'string' || !selection[field].trim() || selection[field].length > 128)) {
          throw new BadRequestException('Selecione um cadastro válido para a associação.');
        }
      }
      if (selection.tipoComissao !== undefined && !Object.values(TipoComissao).includes(selection.tipoComissao as TipoComissao)) {
        throw new BadRequestException('Selecione um tipo de comissão válido.');
      }
      for (const field of ['percentualComissao', 'valorComissaoPorViagem']) {
        const amount = selection[field];
        if (amount !== undefined && (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0 || amount > (field === 'percentualComissao' ? 100 : 999_999_999_999.99)
          || Math.abs(amount * 100 - Math.round(amount * 100)) > 0.001)) {
          throw new BadRequestException('Os valores da comissão devem ser positivos e ter até duas casas decimais.');
        }
      }
      if (selection.descontoImpostos !== undefined && typeof selection.descontoImpostos !== 'boolean') throw new BadRequestException('Desconto de impostos deve ser sim ou não.');
    }
  }
  return value as OpcoesImportacao;
}

export function normalizarNomeImportacao(nome: string) {
  return nome.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().replace(/\s+/g, ' ').toUpperCase();
}

export function identificadorPessoaExterna(pessoa: { codigo: string | null; nome: string }) {
  return pessoa.codigo || `nome:${normalizarNomeImportacao(pessoa.nome)}`;
}

function similaridadeNome(a: string, b: string) {
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) current[j] = Math.min(current[j - 1] + 1, previous[j] + 1, previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    previous = current;
  }
  return 1 - previous[b.length] / Math.max(a.length, b.length, 1);
}

export function candidatosNome<T extends { id: string; nome: string }>(nome: string, cadastros: T[]) {
  if (nome.length > 256) return { exato: null, sugestoes: [] as T[] };
  cadastros = cadastros.filter((item) => item.nome.length <= 256);
  const normalized = normalizarNomeImportacao(nome);
  const exatos = cadastros.filter((item) => normalizarNomeImportacao(item.nome) === normalized);
  if (exatos.length) return { exato: exatos.length === 1 ? exatos[0] : null, sugestoes: exatos.slice(0, 5) };
  const sugestoes = normalized ? cadastros.map((item) => ({ item, score: similaridadeNome(normalized, normalizarNomeImportacao(item.nome)) }))
    .filter(({ score }) => score >= 0.72).sort((a, b) => b.score - a.score || a.item.nome.localeCompare(b.item.nome)).slice(0, 5).map(({ item }) => item) : [];
  return { exato: null, sugestoes };
}

export function hashDadosImportacao(linha: {
  chaveExterna: string | null; data: string | null; placa: string | null; peso: string | null; valor: string | null;
  motoristaExterno: { codigo: string | null; nome: string }; clienteExterno: { codigo: string | null; nome: string };
}) {
  // Only source business fields determine a changed document, never the chosen internal IDs.
  return createHash('sha256').update(JSON.stringify({
    chaveExterna: linha.chaveExterna, data: linha.data, placa: linha.placa, peso: linha.peso, valor: linha.valor,
    motorista: [linha.motoristaExterno.codigo, normalizarNomeImportacao(linha.motoristaExterno.nome)],
    cliente: [linha.clienteExterno.codigo, normalizarNomeImportacao(linha.clienteExterno.nome)],
  })).digest('hex');
}
