import { BarChart3, Building2, FileText, LogOut, Menu, Receipt, Truck, UserRound, Users, Wallet, Wrench } from 'lucide-react';
import { ReactNode, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const nav = [
  { to: '/', label: 'Dashboard', icon: BarChart3 },
  { to: '/clientes', label: 'Clientes', icon: Building2 },
  { to: '/funcionarios', label: 'Funcionarios', icon: Users },
  { to: '/motoristas', label: 'Motoristas', icon: UserRound },
  { to: '/caminhoes', label: 'Caminhoes', icon: Truck },
  { to: '/acompanhamentos', label: 'Acompanhamentos', icon: Wrench },
  { to: '/engates-carretas', label: 'Engates', icon: Truck },
  { to: '/fornecedores', label: 'Fornecedores', icon: Building2 },
  { to: '/categorias-financeiras', label: 'Categorias', icon: FileText },
  { to: '/despesas', label: 'Despesas', icon: Receipt },
  { to: '/faturamento', label: 'Faturamento', icon: Wallet },
  { to: '/users', label: 'Usuarios', icon: Users },
  { to: '/relatorios', label: 'Relatorios', icon: BarChart3 },
];

export function AppLayout({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="shell">
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="brand">
          <Truck size={24} />
          <div>
            <strong>Transporte</strong>
            <span>Controle operacional</span>
          </div>
        </div>
        <nav>
          {nav.map((item) => {
            const Icon = item.icon;
            if (item.to === '/users' && user?.perfil !== 'ADMIN') return null;
            return (
              <NavLink key={item.to} to={item.to} onClick={() => setOpen(false)}>
                <Icon size={18} />
                {item.label}
              </NavLink>
            );
          })}
        </nav>
      </aside>
      <div className="main">
        <header className="topbar">
          <button className="icon-button mobile-only" onClick={() => setOpen(true)} aria-label="Abrir menu">
            <Menu size={20} />
          </button>
          <div>
            <strong>{user?.nome}</strong>
            <span>{user?.perfil}</span>
          </div>
          <button
            className="button ghost"
            onClick={() => {
              logout();
              navigate('/login');
            }}
          >
            <LogOut size={18} />
            Sair
          </button>
        </header>
        <main>{children}</main>
      </div>
    </div>
  );
}
