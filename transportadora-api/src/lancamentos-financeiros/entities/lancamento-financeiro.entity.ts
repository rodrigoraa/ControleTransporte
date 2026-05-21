export class LancamentoFinanceiroEntity {
  id!: string;
  data!: Date;
  tipoLancamento!: string;
  categoria?: string;
  categoriaId?: string;
  valorTotal!: number;
}
