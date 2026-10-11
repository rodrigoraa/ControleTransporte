import { describe, expect, it } from 'vitest';
import { buildImplementoOwnership, existingImplementoOptions, implementoTransferConfirmation, implementoTransferNotice, selectedImplementoTransfers } from './compositionTransfers';

const carreta = { id: 'carreta-1', placa: 'HRV-0415', tipo: 'CARRETA', quantidadeEixos: 2 };
const outraCarreta = { id: 'carreta-2', placa: 'HRV-0416', tipo: 'SEMIRREBOQUE', quantidadeEixos: 2 };
const dolly = { id: 'dolly-1', placa: 'DOL-0001', tipo: 'DOLLY', quantidadeEixos: 2 };
const reboque = { id: 'reboque-1', placa: 'REB-0001', tipo: 'REBOQUE', quantidadeEixos: 3 };
const conjunto = {
  id: 'conjunto-a',
  status: 'ATIVO',
  cavaloMecanicoId: 'cavalo-a',
  cavaloMecanico: { placa: 'EGJ-7G30' },
  implementos: [carreta, outraCarreta, dolly, reboque].map((implemento) => ({ implementoId: implemento.id, dataFim: null })),
};
const ownership = buildImplementoOwnership([conjunto]);

describe('seleção e confirmação da transferência de implementos', () => {
  it('permite selecionar todos os tipos vinculados a outro cavalo e informa a placa atual', () => {
    const options = existingImplementoOptions([carreta, outraCarreta, dolly, reboque], [{}], 0, 'cavalo-b', ownership);
    expect(options.map((option) => option.value)).toEqual(['carreta-1', 'carreta-2', 'dolly-1', 'reboque-1']);
    expect(options.every((option) => option.label.includes('atualmente em EGJ-7G30'))).toBe(true);
    expect(implementoTransferNotice(carreta, 'cavalo-b', ownership)).toContain('Será transferido ao salvar');
  });

  it('considera apenas conjuntos ativos e vínculos ainda abertos', () => {
    const result = buildImplementoOwnership([
      { ...conjunto, status: 'INATIVO' },
      { ...conjunto, status: 'MANUTENCAO' },
      { ...conjunto, implementos: [{ implementoId: carreta.id, dataFim: '2026-10-10T10:00:00Z' }, { implementoId: dolly.id, dataFim: null }] },
    ]);
    expect(result[carreta.id]).toBeUndefined();
    expect(result[dolly.id].cavaloId).toBe('cavalo-a');
  });

  it('mantém os implementos do próprio cavalo disponíveis sem aviso ou confirmação de transferência', () => {
    const options = existingImplementoOptions([carreta], [carreta], 0, 'cavalo-a', ownership);
    expect(options).toHaveLength(1);
    expect(options[0].label).not.toContain('atualmente em');
    expect(implementoTransferNotice(carreta, 'cavalo-a', ownership)).toBe('');
    expect(selectedImplementoTransfers([carreta], 'cavalo-a', ownership)).toEqual([]);
  });

  it('não solicita transferência de implementos novos ou sem vínculo ativo', () => {
    const novo = { placa: 'NOV-0001', tipo: 'CARRETA' };
    const livre = { ...carreta, id: 'carreta-livre' };
    expect(selectedImplementoTransfers([novo, livre], 'cavalo-b', ownership)).toEqual([]);
    expect(implementoTransferNotice(livre, 'cavalo-b', ownership)).toBe('');
    expect(implementoTransferConfirmation([])).toBe('');
  });

  it('exclui somente implementos já selecionados em outra posição e preserva a seleção atual', () => {
    const options = existingImplementoOptions([carreta, outraCarreta, dolly], [carreta, outraCarreta], 0, 'cavalo-b', ownership);
    expect(options.map((option) => option.value)).toEqual([carreta.id, dolly.id]);
  });

  it('confirma uma transferência identificando o implemento e o cavalo anterior', () => {
    const transfers = selectedImplementoTransfers([carreta], 'cavalo-b', ownership);
    expect(transfers).toEqual([{
      conjuntoId: 'conjunto-a', cavaloId: 'cavalo-a', cavaloPlaca: 'EGJ-7G30', implementoId: carreta.id, placa: carreta.placa,
    }]);
    const message = implementoTransferConfirmation(transfers);
    expect(message).toContain('HRV-0415 está atualmente vinculado ao cavalo EGJ-7G30');
    expect(message).toContain('Ao continuar, ele será transferido para este cavalo');
  });

  it('confirma vários implementos de cavalos diferentes sem duplicar a mesma transferência', () => {
    const multiOwnership = buildImplementoOwnership([conjunto, {
      ...conjunto,
      id: 'conjunto-c',
      cavaloMecanicoId: 'cavalo-c',
      cavaloMecanico: { placa: 'CCC-0001' },
      implementos: [{ implementoId: outraCarreta.id, dataFim: null }],
    }]);
    const transfers = selectedImplementoTransfers([carreta, outraCarreta, carreta], 'cavalo-b', multiOwnership);
    expect(transfers).toHaveLength(2);
    const message = implementoTransferConfirmation(transfers);
    expect(message).toContain('HRV-0415 (atualmente em EGJ-7G30)');
    expect(message).toContain('HRV-0416 (atualmente em CCC-0001)');
    expect(message.match(/HRV-0415/g)).toHaveLength(1);
  });

  it('também identifica transferências ao cadastrar um novo cavalo', () => {
    const options = existingImplementoOptions([dolly], [{}], 0, undefined, ownership);
    expect(options[0].label).toContain('atualmente em EGJ-7G30');
    expect(selectedImplementoTransfers([dolly], undefined, ownership)).toHaveLength(1);
  });
});
