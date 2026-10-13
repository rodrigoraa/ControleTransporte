import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { HistoricalFleetLinks } from './OperationalHistoryModal';

const antiga = {
  id: 'conjunto-antigo', nome: 'Bitrem anterior', status: 'INATIVO', quantidadeTotalEixos: 7,
  implementos: [
    { id: 'vinculo-1', ordem: 1, implementoId: 'carreta-1', dataInicio: '2026-10-09T00:00:00.000Z', dataFim: '2026-10-11T14:30:00.000Z', implemento: { placa: 'AAA1B23', tipo: 'CARRETA' } },
    { id: 'vinculo-2', ordem: 2, implementoId: 'carreta-2', dataInicio: '2026-10-09T02:15:00.000Z', dataFim: '2026-10-11T16:45:00.000Z', implemento: { placa: 'BBB2C34', tipo: 'SEMIRREBOQUE' } },
  ],
};

describe('carretas e datas registradas no histórico operacional', () => {
  it('mostra nome, status, eixos, placas e as datas individuais de cada vínculo em UTC', () => {
    const html = renderToStaticMarkup(<HistoricalFleetLinks conjuntos={[antiga]} />);

    expect(html).toContain('Bitrem anterior');
    expect(html).toContain('Status registrado: Inativo');
    expect(html).toContain('Total de eixos: 7');
    expect(html).toContain('AAA1B23');
    expect(html).toContain('BBB2C34');
    expect(html).toContain('Carreta');
    expect(html).toContain('Semirreboque');
    expect(html).toContain('09/10/2026 00:00:00 UTC');
    expect(html).toContain('09/10/2026 02:15:00 UTC');
    expect(html).toContain('11/10/2026 14:30:00 UTC');
    expect(html).toContain('11/10/2026 16:45:00 UTC');
    expect(html).toContain('Datas na mesma referência da conferência da planilha (UTC).');
    expect(html).not.toContain('<input');
    expect(html).not.toContain('<button');
  });

  it('identifica versões ativa e inativa sem concluir vigência a partir de vínculo sem encerramento', () => {
    const atual = {
      id: 'conjunto-atual', nome: 'Rodotrem registrado', status: 'ATIVO', quantidadeTotalEixos: 9,
      implementos: [{ id: 'vinculo-dolly', ordem: 2, dataInicio: '2026-10-11T14:30:00.000Z', dataFim: null, implemento: { placa: 'DDD4E56', tipo: 'DOLLY' } }],
    };
    const inativoAberto = { ...antiga, implementos: [{ ...antiga.implementos[0], dataFim: null }] };
    const html = renderToStaticMarkup(<HistoricalFleetLinks conjuntos={[inativoAberto, atual]} />);

    expect(html).toContain('Status registrado: Inativo');
    expect(html).toContain('Status registrado: Ativo');
    expect(html).toContain('Total de eixos: 9');
    expect(html).toContain('DDD4E56');
    expect(html).toContain('Dolly');
    expect(html.match(/Sem encerramento registrado/g)).toHaveLength(2);
    expect(html).not.toContain('Em vigor');
    expect(html).not.toContain('vigência confirmada');
  });

  it('preserva a data UTC à meia-noite e normaliza timestamps com offset para a mesma referência', () => {
    const html = renderToStaticMarkup(<HistoricalFleetLinks conjuntos={[{
      ...antiga,
      implementos: [{ ...antiga.implementos[0], dataInicio: '2026-10-08T21:00:00.000-03:00', dataFim: '2026-10-09T00:00:00.000Z' }],
    }]} />);

    expect(html.match(/09\/10\/2026 00:00:00 UTC/g)).toHaveLength(2);
    expect(html).not.toContain('08/10/2026');
  });

  it('identifica conjuntos sem vínculos e a ausência de conjuntos', () => {
    expect(renderToStaticMarkup(<HistoricalFleetLinks conjuntos={[{ ...antiga, implementos: [] }]} />)).toContain('Sem carretas registradas neste conjunto.');
    expect(renderToStaticMarkup(<HistoricalFleetLinks conjuntos={[]} />)).toContain('Nenhuma composição registrada para este cavalo.');
    expect(renderToStaticMarkup(<HistoricalFleetLinks />)).toContain('Nenhuma composição registrada para este cavalo.');
  });

  it('mantém a seção recolhida por padrão e permite abri-la na consulta da importação', () => {
    const closed = renderToStaticMarkup(<HistoricalFleetLinks conjuntos={[antiga]} />);
    const opened = renderToStaticMarkup(<HistoricalFleetLinks conjuntos={[antiga]} open />);
    expect(closed).toContain('<details><summary>Carretas e datas registradas</summary>');
    expect(opened).toContain('<details open=""><summary>Carretas e datas registradas</summary>');
  });

  it('mostra datas inválidas ou ausentes como não informadas sem inventar encerramento', () => {
    const html = renderToStaticMarkup(<HistoricalFleetLinks conjuntos={[{
      ...antiga,
      implementos: [{ id: 'incompleto', ordem: 1, dataInicio: 'data-inválida', dataFim: 'outra-data-inválida', implemento: { placa: 'EEE5F67', tipo: 'REBOQUE' } }],
    }]} />);
    expect(html).toContain('EEE5F67');
    expect(html).toContain('Reboque');
    expect(html.match(/Não informado/g)).toHaveLength(2);
    expect(html).not.toContain('Sem encerramento registrado');
    expect(html).not.toContain('Invalid Date');

    const ausente = renderToStaticMarkup(<HistoricalFleetLinks conjuntos={[{ id: 'sem-dados', implementos: [{}] }]} />);
    expect(ausente).toContain('Status registrado: Não informado');
    expect(ausente).not.toContain('Status registrado: Ativo');
    expect(ausente).not.toContain('Sem encerramento registrado');
  });
});
