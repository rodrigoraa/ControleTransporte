import { FormEvent, useEffect, useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  LockKeyhole,
  Mail,
  Route,
  ShieldCheck,
  Truck,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../services/api';

export function Login() {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const authMessage = sessionStorage.getItem('authMessage');
    if (!authMessage) return;
    setInfo(authMessage);
    sessionStorage.removeItem('authMessage');
  }, []);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError('');
    setInfo('');
    try {
      await login(email, senha);
      navigate('/');
    } catch {
      setError('E-mail ou senha inválidos.');
    } finally {
      setLoading(false);
    }
  }

  async function recoverPassword() {
    setLoading(true);
    setError('');
    setInfo('');
    try {
      const { data } = await api.post('/auth/forgot-password', { email });
      setInfo(data.temporaryPassword ? `${data.message} Senha temporária: ${data.temporaryPassword}` : data.message);
    } catch (requestError: any) {
      setError(requestError.response?.data?.message || 'Não foi possível iniciar a recuperação de senha.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <section className="login-showcase">
        <div className="login-showcase-top">
          <div className="login-mark">
            <Truck size={30} strokeWidth={1.8} />
          </div>
          <div>
            <strong>Controle Transporte</strong>
            <span>Gestão operacional integrada</span>
          </div>
        </div>

        <div className="login-showcase-content">
          <div className="login-copy">
            <span className="login-eyebrow">Sua operação em movimento</span>
            <h1>Mais controle na estrada. Mais clareza na gestão.</h1>
            <p>
              Frota, motoristas, despesas e faturamento conectados para você tomar decisões com confiança.
            </p>
          </div>

          <div className="login-benefits">
            <div className="login-benefit">
              <CheckCircle2 size={19} />
              <span>Visão financeira centralizada</span>
            </div>
            <div className="login-benefit">
              <CheckCircle2 size={19} />
              <span>Histórico operacional confiável</span>
            </div>
            <div className="login-benefit">
              <CheckCircle2 size={19} />
              <span>Relatórios para decisões rápidas</span>
            </div>
          </div>

          <div className="route-card">
            <div className="route-card-icon">
              <Route size={23} />
            </div>
            <div>
              <strong>Do cadastro ao resultado</strong>
              <span>Todos os dados da transportadora em um só fluxo.</span>
            </div>
          </div>
        </div>
      </section>

      <section className="login-form-area">
        <form className="login-card" onSubmit={handleSubmit}>
          <div className="login-brand">
            <div className="login-brand-icon">
              <Truck size={27} />
            </div>
            <div>
              <strong>Controle Transporte</strong>
              <span>Portal de gestão</span>
            </div>
          </div>

          <div className="login-form-heading">
            <span className="login-eyebrow">Área restrita</span>
            <h1>Bem-vindo de volta</h1>
            <p>Entre com seus dados para acessar o painel.</p>
          </div>

          <label className="login-field">
            <span className="field-label">E-mail</span>
            <div className="input-shell">
              <Mail size={18} />
              <input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                type="email"
                placeholder="seuemail@empresa.com"
                autoComplete="email"
                required
              />
            </div>
          </label>

          <label className="login-field">
            <span className="field-label">Senha</span>
            <div className="input-shell">
              <LockKeyhole size={18} />
              <input
                value={senha}
                onChange={(event) => setSenha(event.target.value)}
                type={showPassword ? 'text' : 'password'}
                placeholder="Digite sua senha"
                autoComplete="current-password"
                required
              />
              <button
                className="password-toggle"
                type="button"
                aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                title={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                onClick={() => setShowPassword((visible) => !visible)}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </label>

          {error && <div className="form-error login-message">{error}</div>}
          {info && <div className="form-success login-message">{info}</div>}

          <div className="login-actions">
            <button className="button primary login-submit" disabled={loading}>
              <span>{loading ? 'Acessando...' : 'Entrar no sistema'}</span>
              {!loading && <ArrowRight size={18} />}
            </button>
            <button className="login-recovery" type="button" disabled={loading} onClick={recoverPassword}>
              <KeyRound size={16} />
              Esqueci minha senha
            </button>
          </div>

          <div className="login-security-note">
            <ShieldCheck size={17} />
            <span>Acesso protegido e monitorado</span>
          </div>
        </form>
      </section>
    </div>
  );
}
