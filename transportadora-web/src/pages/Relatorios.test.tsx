import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Relatorios, UltimasMediasReport } from './Relatorios';
import { defaultReportSelection, loadLastGeneratedReport } from './reportOptions';

vi.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'user-1' } }) }));
vi.mock('./reportOptions', async (importOriginal) => ({
  ...await importOriginal<typeof import('./reportOptions')>(),
  loadLastGeneratedReport: vi.fn(),
}));

const selection = defaultReportSelection('ULTIMAS_MEDIAS_FROTA');
const row = {
  id: 'ab-1',
  cavaloMecanicoId: 'cav-1',
  placa: 'QAV0D73',
  data: '2026-09-28T00:00:00.000Z',
  kmAnterior: '566357',
  kmAtual: '567101',
  distanciaPercorrida: '744',
  litros: '389.001',
  mediaKmLitro: '1.913',
};

afterEach(() => { vi.clearAllMocks(); });

describe('Últimas médias da frota', () => {
  it('mostra as sete colunas e os valores do último registro com sua precisão', () => {
    const html = renderToStaticMarkup(<UltimasMediasReport ultimasMedias={{ registros: [row] }} selection={selection} />);

    expect(html.match(/<th(?:\s|>)/g)).toHaveLength(7);
    expect(html.match(/<td(?:\s|>)/g)).toHaveLength(7);
    expect(html).toContain('QAV0D73');
    expect(html).toContain('28/09/2026');
    expect(html).toContain('566.357,0');
    expect(html).toContain('567.101,0');
    expect(html).toContain('744,0 km');
    expect(html).toContain('389,001 L');
    expect(html).toContain('1,913 km/l');
    expect(html).not.toContain('Ranking');
    expect(html).not.toContain('período');
  });

  it('inicia com todas as placas em ordem crescente, independentemente da ordem recebida', () => {
    const first = { ...row, id: 'ab-2', cavaloMecanicoId: 'cav-2', placa: 'AAA1B23' };
    const last = { ...row, placa: 'ZZZ9Z99' };
    const renderRows = (registros: Array<typeof row>) => renderToStaticMarkup(
      <UltimasMediasReport ultimasMedias={{ registros }} selection={selection} />,
    );
    const html = renderRows([last, first]);

    expect(html).toContain('aria-sort="ascending"');
    expect(html.indexOf('AAA1B23')).toBeLessThan(html.indexOf('ZZZ9Z99'));
    expect(renderRows([first, last])).toBe(html);
  });

  it('preserva zero e apresenta média ausente ou inválida sem fabricar um valor', () => {
    for (const mediaKmLitro of [null, '', ' ', 'inválida']) {
      const html = renderToStaticMarkup(<UltimasMediasReport
        ultimasMedias={{ registros: [{ ...row, kmAnterior: 0, mediaKmLitro }] }}
        selection={selection}
      />);

      expect(html).toContain('<td>0,0</td>');
      expect(html).toContain('<strong>-</strong>');
      expect(html).not.toContain('0,000 km/l');
    }
  });

  it('respeita as colunas escolhidas e a seleção da seção', () => {
    const columns = { sections: ['ultimas_medias'], columns: ['ultimas_medias:data', 'ultimas_medias:media'] };
    const html = renderToStaticMarkup(<UltimasMediasReport ultimasMedias={{ registros: [row] }} selection={columns} />);

    expect(html.match(/<th(?:\s|>)/g)).toHaveLength(2);
    expect(html.match(/<td(?:\s|>)/g)).toHaveLength(2);
    expect(html).toContain('28/09/2026');
    expect(html).toContain('1,913 km/l');
    expect(html).not.toContain('QAV0D73');
    expect(html).not.toContain('Km anterior');
    expect(renderToStaticMarkup(<UltimasMediasReport
      ultimasMedias={{ registros: [row] }}
      selection={{ ...selection, sections: [] }}
    />)).toBe('');
  });

  it('apresenta o estado vazio com a largura da seleção de colunas', () => {
    const html = renderToStaticMarkup(<UltimasMediasReport ultimasMedias={{ registros: [] }} selection={selection} />);

    expect(html).toContain('colSpan="7"');
    expect(html).toContain('Nenhum abastecimento encontrado');
  });

  it('restaura a nova opção sem mostrar datas ou filtros financeiros de uma preferência anterior', () => {
    vi.mocked(loadLastGeneratedReport).mockReturnValue({
      reportType: 'ULTIMAS_MEDIAS_FROTA',
      filters: { dataInicial: '2026-09-01', dataFinal: '2026-09-30', motoristaIds: 'mot-1', placa: 'QAV0D73' },
      selection,
    });
    const html = renderToStaticMarkup(<Relatorios />);

    expect(html).toContain('Últimas médias da frota');
    expect(html).toContain('Cavalo mecânico');
    expect(html).toContain('Pesquisar placa...');
    expect(html).not.toContain('type="date"');
    expect(html).not.toContain('Data inicial');
    expect(html).not.toContain('Data final');
    expect(html).not.toContain('Motoristas');
    expect(html).not.toContain('Ordenar por');
  });
});
