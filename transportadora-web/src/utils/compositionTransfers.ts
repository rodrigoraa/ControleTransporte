type Implemento = {
  id?: string;
  placa?: string | null;
  tipo?: string;
  quantidadeEixos?: number | string;
};

type Conjunto = {
  id: string;
  status: string;
  cavaloMecanicoId: string;
  cavaloMecanico?: { placa?: string | null };
  implementos?: { implementoId: string; dataFim?: string | null }[];
};

export type ImplementoOwnership = {
  conjuntoId: string;
  cavaloId: string;
  cavaloPlaca: string;
};

export type ImplementoTransfer = ImplementoOwnership & {
  implementoId: string;
  placa: string;
};

export function buildImplementoOwnership(conjuntos: Conjunto[]): Record<string, ImplementoOwnership> {
  const ownership: Record<string, ImplementoOwnership> = {};
  for (const conjunto of conjuntos) {
    if (conjunto.status !== 'ATIVO') continue;
    for (const vinculo of conjunto.implementos || []) {
      if (vinculo.dataFim != null) continue;
      ownership[vinculo.implementoId] = {
        conjuntoId: conjunto.id,
        cavaloId: conjunto.cavaloMecanicoId,
        cavaloPlaca: conjunto.cavaloMecanico?.placa || conjunto.cavaloMecanicoId,
      };
    }
  }
  return ownership;
}

export function implementoTransferNotice(implemento: Implemento, cavaloId: string | undefined, ownership: Record<string, ImplementoOwnership>) {
  const owner = implemento.id ? ownership[implemento.id] : undefined;
  return owner && owner.cavaloId !== cavaloId ? `Atualmente em ${owner.cavaloPlaca}. Será transferido ao salvar.` : '';
}

export function existingImplementoOptions(catalog: Implemento[], selected: Implemento[], index: number, cavaloId: string | undefined, ownership: Record<string, ImplementoOwnership>) {
  const otherIds = new Set(selected.filter((_, itemIndex) => itemIndex !== index).map((item) => item.id).filter(Boolean));
  return catalog.filter((item) => item.id && !otherIds.has(item.id)).map((item) => {
    const owner = item.id ? ownership[item.id] : undefined;
    const label = [item.placa || 'Sem placa', item.tipo, item.quantidadeEixos != null ? `${item.quantidadeEixos} eixos` : ''].filter(Boolean).join(' — ');
    return {
      value: item.id!,
      label: owner && owner.cavaloId !== cavaloId ? `${label} — atualmente em ${owner.cavaloPlaca}` : label,
    };
  });
}

export function selectedImplementoTransfers(selected: Implemento[], cavaloId: string | undefined, ownership: Record<string, ImplementoOwnership>): ImplementoTransfer[] {
  const transfers = new Map<string, ImplementoTransfer>();
  for (const implemento of selected) {
    if (!implemento.id) continue;
    const owner = ownership[implemento.id];
    if (owner && owner.cavaloId !== cavaloId) {
      transfers.set(implemento.id, { ...owner, implementoId: implemento.id, placa: implemento.placa || 'Sem placa' });
    }
  }
  return [...transfers.values()];
}

export function implementoTransferConfirmation(transfers: ImplementoTransfer[]) {
  if (!transfers.length) return '';
  if (transfers.length === 1) {
    const transfer = transfers[0];
    return `O implemento ${transfer.placa} está atualmente vinculado ao cavalo ${transfer.cavaloPlaca}. Ao continuar, ele será transferido para este cavalo.`;
  }
  return `Os seguintes implementos serão transferidos de outros cavalos: ${transfers.map((transfer) => `${transfer.placa} (atualmente em ${transfer.cavaloPlaca})`).join(', ')}. Deseja continuar?`;
}
