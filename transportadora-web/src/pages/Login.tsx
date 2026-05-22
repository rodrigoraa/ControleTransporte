import { FormEvent, useState } from 'react';
import { Truck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../services/api';

export function Login() {
  const [email, setEmail] = useState('admin@transportadora.com');
  const [senha, setSenha] = useState('admin123');
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
      setError('Email ou senha invalidos.');
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
    } catch {
      setError('Não foi possível iniciar a recuperação de senha.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={handleSubmit}>
        <div className="login-brand">
          <Truck size={34} />
          <div>
            <h1>Controle Transporte</h1>
            <span>Gestao financeira e operacional</span>
          </div>
        </div>
        <label>
          Email
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required />
        </label>
        <label>
          Senha
          <input value={senha} onChange={(e) => setSenha(e.target.value)} type="password" required />
        </label>
        {error && <div className="form-error">{error}</div>}
        {info && <div className="form-success">{info}</div>}
        <button className="button primary" disabled={loading}>
          {loading ? 'Entrando...' : 'Entrar'}
        </button>
        <button className="button ghost" type="button" disabled={loading} onClick={recoverPassword}>
          Recuperar senha
        </button>
      </form>
    </div>
  );
}
