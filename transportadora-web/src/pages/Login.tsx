import { FormEvent, useState } from 'react';
import { ArrowRight, KeyRound, Lock, Mail, Route, Truck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../services/api';

export function Login() {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

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
        <div className="login-showcase-content">
          <div className="login-mark">
            <Truck size={30} />
          </div>
          <div>
            <span>Controle Transporte</span>
            <h1>Operação, frota e financeiro em uma visão só.</h1>
          </div>
          <div className="route-card">
            <Route size={22} />
            <div>
              <strong>Fluxo operacional</strong>
              <span>Cadastros, lançamentos e relatórios conectados</span>
            </div>
          </div>
        </div>
      </section>
      <form className="login-card" onSubmit={handleSubmit}>
        <div className="login-brand">
          <Truck size={32} />
          <div>
            <h1>Controle Transporte</h1>
            <span>Acesso ao sistema</span>
          </div>
        </div>
        <label>
          E-mail
          <div className="input-shell">
            <Mail size={18} />
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required />
          </div>
        </label>
        <label>
          Senha
          <div className="input-shell">
            <Lock size={18} />
            <input value={senha} onChange={(e) => setSenha(e.target.value)} type="password" required />
          </div>
        </label>
        {error && <div className="form-error">{error}</div>}
        {info && <div className="form-success">{info}</div>}
        <button className="button primary" disabled={loading}>
          {loading ? 'Entrando...' : 'Entrar'}
          {!loading && <ArrowRight size={18} />}
        </button>
        <button className="button ghost" type="button" disabled={loading} onClick={recoverPassword}>
          <KeyRound size={17} />
          Recuperar senha
        </button>
      </form>
    </div>
  );
}



