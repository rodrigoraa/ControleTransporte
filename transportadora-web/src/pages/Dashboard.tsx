import { ReactElement, useEffect, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from '../services/api';
import { money } from '../utils/formatters';

export function Dashboard() {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/dashboard')
      .then((response) => setData(response.data))
      .catch(() => setError('Não foi possível carregar o dashboard.'));
  }, []);

  if (error) return <div className="form-error">{error}</div>;
  if (!data) return <div className="loading">Carregando dashboard...</div>;

  const cards = [
    ['Total faturado no mes', data.cards.totalFaturadoMes, 'money'],
    ['Total de despesas no mes', data.cards.totalDespesasMes, 'money'],
    ['Saldo do mes', data.cards.saldoMes, 'money'],
    ['Cavalos mecânicos ativos', data.cards.cavalosMecanicosAtivos, 'number'],
    ['Implementos ativos', data.cards.implementosAtivos, 'number'],
    ['Conjuntos ativos', data.cards.conjuntosAtivos, 'number'],
    ['Itens inativos/manutenção', data.cards.itensInativosOuManutenção, 'number'],
    ['Motoristas ativos', data.cards.motoristasAtivos, 'number'],
  ];

  return (
    <section className="page">
      <div className="page-header">
        <div>
          <h1>Dashboard</h1>
          <p>Resumo financeiro, frota e composicoes operacionais.</p>
        </div>
      </div>
      <div className="stats-grid">
        {cards.map(([label, value, kind]) => (
          <article className="stat-card" key={label as string}>
            <span>{label}</span>
            <strong>{kind === 'money' ? money(value as number) : value}</strong>
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
        <Chart title="Conjuntos por tipo">
          <BarChart data={data.graficos.conjuntosPorTipo}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="tipo" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="total" fill="#6b7a35" radius={[4, 4, 0, 0]} />
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
        <h2>Últimos lançamentos</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Data</th><th>Tipo</th><th>Placa</th><th>Conjunto</th><th>Descrição</th><th>Valor</th></tr>
            </thead>
            <tbody>
              {data.ultimosLancamentos.map((item: any) => (
                <tr key={item.id}>
                  <td>{new Date(item.data).toLocaleDateString('pt-BR')}</td>
                  <td>{item.tipoLancamento}</td>
                  <td>{item.cavaloMecanico?.placa || item.placa}</td>
                  <td>{item.conjunto?.nome || '-'}</td>
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


