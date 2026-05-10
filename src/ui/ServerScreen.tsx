import { useState } from 'react';
import { api } from '../lib/api';
import { useAuthStore } from '../stores/authStore';
import { AvatarScreen } from './AvatarScreen';

export function ServerScreen() {
  const token     = useAuthStore(s => s.token);
  const user      = useAuthStore(s => s.user);
  const setServer = useAuthStore(s => s.setServer);
  const logout    = useAuthStore(s => s.logout);

  const [tab, setTab]         = useState<'create' | 'join'>('create');
  const [serverName, setName]  = useState('');
  const [joinCode, setCode]    = useState('');
  const [createdCode, setCreatedCode] = useState('');
  const [loading, setLoading]  = useState(false);
  const [error, setError]      = useState('');
  const [showAvatar, setShowAvatar] = useState(false);

  if (showAvatar) return <AvatarScreen onBack={() => setShowAvatar(false)} />;

  const handleCreate = async () => {
    if (!serverName.trim() || !token) return;
    setLoading(true);
    setError('');
    try {
      const data = await api.createServer(serverName.trim(), token);
      setCreatedCode(data.code);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to create server');
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    const code = joinCode.trim().toUpperCase();
    if (code.length !== 6 || !token) return;
    setLoading(true);
    setError('');
    try {
      const data = await api.getServer(code, token);
      setServer(data.code, data.name);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Server not found');
    } finally {
      setLoading(false);
    }
  };

  const handleEnterCreated = () => {
    setServer(createdCode, serverName.trim());
  };

  const onKey = (e: React.KeyboardEvent, action: () => void) => {
    e.stopPropagation();
    if (e.key === 'Enter') action();
  };

  return (
    <div className="pre-screen">
      <h1>TERRA&nbsp;CRAFT</h1>

      <div className="server-header">
        <span className="server-username">👤 {user?.username}</span>
        <button className="pre-btn-link" onClick={() => setShowAvatar(true)}>Edit Avatar</button>
        <button className="pre-btn-link pre-btn-logout" onClick={logout}>Logout</button>
      </div>

      <div className="pre-tabs">
        <button
          className={`pre-tab ${tab === 'create' ? 'active' : ''}`}
          onClick={() => { setTab('create'); setError(''); setCreatedCode(''); }}
        >Create Server</button>
        <button
          className={`pre-tab ${tab === 'join' ? 'active' : ''}`}
          onClick={() => { setTab('join'); setError(''); }}
        >Join Server</button>
      </div>

      <div className="pre-form">
        {tab === 'create' ? (
          createdCode ? (
            <>
              <div className="server-created">
                <div className="server-created-label">Server created! Share this code:</div>
                <div className="server-code-display">{createdCode}</div>
                <div className="server-created-hint">Anyone with this code can join your world.</div>
              </div>
              <button className="pre-btn" onClick={handleEnterCreated}>
                Enter World
              </button>
            </>
          ) : (
            <>
              <input
                className="pre-input"
                type="text"
                placeholder="World name (e.g. My Survival World)"
                value={serverName}
                maxLength={30}
                onChange={e => setName(e.target.value)}
                onKeyDown={e => onKey(e, handleCreate)}
              />
              {error && <div className="pre-error">{error}</div>}
              <button
                className="pre-btn"
                onClick={handleCreate}
                disabled={loading || !serverName.trim()}
              >
                {loading ? 'Creating…' : 'Create World'}
              </button>
            </>
          )
        ) : (
          <>
            <input
              className="pre-input pre-input-code"
              type="text"
              placeholder="Enter 6-letter code"
              value={joinCode}
              maxLength={6}
              onChange={e => setCode(e.target.value.toUpperCase().replace(/[^A-Z]/g, ''))}
              onKeyDown={e => onKey(e, handleJoin)}
            />
            {error && <div className="pre-error">{error}</div>}
            <button
              className="pre-btn"
              onClick={handleJoin}
              disabled={loading || joinCode.trim().length !== 6}
            >
              {loading ? 'Connecting…' : 'Join World'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
