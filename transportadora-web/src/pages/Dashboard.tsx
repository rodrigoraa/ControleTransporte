import { ReactElement, useEffect, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from '../services/api';
import { money } from '../utils/formatters';

export function Dashboard() {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    api.get('/dashboard').then((response) => setData(response.data));
  }, []);

  if (!data) return <div className="loading">Carregando dashboard...</div>;

  const cards = [
    ['Total faturado no mes', data.cards.totalFaturadoMes],
    ['Total de despesas no mes', data.cards.totalDespesasMes],
    ['Saldo do mes', data.cards.saldoMes],
    ['Caminhoes ativos', data.cards.caminhoesAtivos],
    ['Motoristas ativos', data.cards.motoristasAtivos],
  ];

  return (
    <section className="page">
      <div className="page-header">
        <div>
          <h1>Dashboard</h1>
          <p>Resumo financeiro e operacional da transportadora.</p>
        </div>
      </div>
      <div className="stats-grid">
        {cards.map(([label, value]) => (
          <article className="stat-card" key={label as string}>
            <span>{label}</span>
            <strong>{typeof value === 'number' && ((label as string).includes('Total') || (label as string).includes('Saldo')) ? money(value as number) : value}</strong>
          </article>
        ))}
      </div>
      <div className="chart-grid">
        <Chart title="Despesas por categoria">
          <BarChart data={data.graficos.despesasPorCategoria}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="categoria" />
            <YAxis />
            <Tooltip formatter={(value) => money(Number(value))} />
            <Bar dataKey="total" fill="#1f7a8c" radius={[4, 4, 0, 0]} />
          </BarChart>
        </Chart>
        <Chart title="Comparativo faturamento x despesas">
          <LineChart data={data.graficos.comparativo}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="mes" />
            <YAxis />
            <Tooltip formatter={(value) => money(Number(value))} />
            <Legend />
            <Line type="monotone" dataKey="faturamento" stroke="#16803c" strokeWidth={2} />
            <Line type="monotone" dataKey="despesas" stroke="#b42318" strokeWidth={2} />
          </LineChart>
        </Chart>
      </div>
      <div className="panel">
        <h2>Ultimos lancamentos</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Data</th><th>Tipo</th><th>Descricao</th><th>Valor</th></tr>
            </thead>
            <tbody>
              {data.ultimosLancamentos.map((item: any) => (
                <tr key={item.id}>
                  <td>{new Date(item.data).toLocaleDateString('pt-BR')}</td>
                  <td>{item.tipoLancamento}</td>
                  <td>{item.descricao || '-'}</td>
                  <td>{money(item.valorTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function Chart({ title, children }: { title: string; children: ReactElement }) {
  return (
    <div className="panel chart-panel">
      <h2>{title}</h2>
      <ResponsiveContainer width="100%" height={280}>{children}</ResponsiveContainer>
    </div>
  );
}
