import {
  BarChart3,
  Building2,
  ChevronDown,
  FileText,
  Link2,
  LogOut,
  Menu,
  Receipt,
  Settings,
  Truck,
  UserRound,
  Users,
  Wallet,
} from 'lucide-react';
import { ReactNode, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const navGroups = [
  {
    id: 'cadastros',
    label: 'Cadastros',
    icon: Building2,
    items: [
      { to: '/clientes', label: 'Clientes', icon: Building2 },
      { to: '/fornecedores', label: 'Fornecedores', icon: Building2 },
      { to: '/motoristas', label: 'Motoristas', icon: UserRound },
      { to: '/caminhoes', label: 'Cavalos mecanicos', icon: Truck },
      { to: '/implementos', label: 'Implementos', icon: Link2 },
      { to: '/conjuntos', label: 'Conjuntos operacionais', icon: Truck },
      { to: '/categorias-financeiras', label: 'Categorias financeiras', icon: FileText },
    ],
  },
  {
    id: 'financeiro',
    label: 'Financeiro',
    icon: Wallet,
    items: [
      { to: '/despesas', label: 'Despesas', icon: Receipt },
      { to: '/faturamento', label: 'Faturamento', icon: Wallet },
    ],
  },
  {
    id: 'analises',
    label: 'Analises',
    icon: BarChart3,
    items: [
      { to: '/relatorios', label: 'Relatorios', icon: BarChart3 },
    ],
  },
  {
    id: 'administracao',
    label: 'Administracao',
    icon: Settings,
    adminOnly: true,
    items: [
      { to: '/users', label: 'Usuarios', icon: Users },
      { to: '/auditorias', label: 'Auditoria', icon: FileText },
    ],
  },
];

export function AppLayout({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  function isGroupOpen(group: (typeof navGroups)[number]) {
    if (openGroups[group.id] !== undefined) return openGroups[group.id];
    return group.items.some((item) => item.to === location.pathname);
  }

  function toggleGroup(groupId: string) {
    setOpenGroups((current) => ({ ...current, [groupId]: !current[groupId] }));
  }

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
          <NavLink to="/" end onClick={() => setOpen(false)}>
            <BarChart3 size={18} />
            Dashboard
          </NavLink>
          {navGroups.map((group) => {
            if (group.adminOnly && user?.perfil !== 'ADMIN') return null;
            const Icon = group.icon;
            const expanded = isGroupOpen(group);
            return (
              <div className="nav-group" key={group.id}>
                <button
                  type="button"
                  className={`nav-group-button ${expanded ? 'open' : ''}`}
                  onClick={() => toggleGroup(group.id)}
                >
                  <span>
                    <Icon size={18} />
                    {group.label}
                  </span>
                  <ChevronDown size={16} />
                </button>
                {expanded && (
                  <div className="nav-submenu">
                    {group.items.map((item) => {
                      const ItemIcon = item.icon;
                      return (
                        <NavLink key={item.to} to={item.to} onClick={() => setOpen(false)}>
                          <ItemIcon size={16} />
                          {item.label}
                        </NavLink>
                      );
                    })}
                  </div>
                )}
              </div>
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
