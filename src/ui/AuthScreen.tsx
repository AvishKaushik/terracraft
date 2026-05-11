import { useState } from 'react';
import { api } from '../lib/api';
import { useAuthStore } from '../stores/authStore';

export function AuthScreen() {
  const setAuth = useAuthStore(s => s.setAuth);
  const [tab, setTab]         = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  const submit = async () => {
    if (!username.trim() || !password) return;
    setLoading(true);
    setError('');
    try {
      const data = tab === 'login'
        ? await api.login(username.trim(), password)
        : await api.register(username.trim(), password);
      setAuth(data.token, data.user);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const onKey = (e: React.KeyboardEvent) => {
    e.stopPropagation();
    if (e.key === 'Enter') submit();
  };

  return (
    <div className="pre-screen">
      <h1>TERRA&nbsp;CRAFT</h1>
      <div className="pre-subtitle">build · mine · explore</div>

      <div className="mc-panel">
        <div className="pre-tabs">
          <button
            className={`pre-tab ${tab === 'login' ? 'active' : ''}`}
            onClick={() => { setTab('login'); setError(''); }}
          >Login</button>
          <button
            className={`pre-tab ${tab === 'register' ? 'active' : ''}`}
            onClick={() => { setTab('register'); setError(''); }}
          >Register</button>
        </div>

        <div className="pre-form">
          <input
            className="pre-input"
            type="text"
            placeholder="Username"
            value={username}
            maxLength={20}
            autoComplete="username"
            onChange={e => setUsername(e.target.value)}
            onKeyDown={onKey}
          />
          <input
            className="pre-input"
            type="password"
            placeholder="Password"
            value={password}
            maxLength={64}
            autoComplete={tab === 'register' ? 'new-password' : 'current-password'}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={onKey}
          />
          {error && <div className="pre-error">{error}</div>}
          <button
            className="pre-btn"
            onClick={submit}
            disabled={loading || !username.trim() || !password}
          >
            {loading ? 'Please wait…' : tab === 'login' ? 'Login' : 'Create Account'}
          </button>
        </div>
      </div>
    </div>
  );
}
