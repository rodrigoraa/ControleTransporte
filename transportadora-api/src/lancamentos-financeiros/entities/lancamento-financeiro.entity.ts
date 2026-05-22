export class LancamentoFinanceiroEntity {
  id!: string;
  data!: Date;
  tipoLancamento!: string;
  placa!: string;
  categoriaId?: string;
  valorTotal!: number;
}
