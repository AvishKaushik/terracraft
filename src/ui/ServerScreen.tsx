import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useAuthStore } from '../stores/authStore';
import { AvatarScreen } from './AvatarScreen';

interface ServerEntry { code: string; name: string; playerCount: number; }

export function ServerScreen() {
  const token     = useAuthStore(s => s.token);
  const user      = useAuthStore(s => s.user);
  const setServer = useAuthStore(s => s.setServer);
  const logout    = useAuthStore(s => s.logout);

  const [tab, setTab]         = useState<'create' | 'join' | 'browse'>('browse');
  const [serverName, setName]  = useState('');
  const [joinCode, setCode]    = useState('');
  const [createdCode, setCreatedCode] = useState('');
  const [loading, setLoading]  = useState(false);
  const [error, setError]      = useState('');
  const [showAvatar, setShowAvatar] = useState(false);
  const [serverList, setServerList] = useState<ServerEntry[]>([]);
  const [listLoading, setListLoading] = useState(false);

  const loadServers = async () => {
    if (!token) return;
    setListLoading(true);
    try {
      const data = await api.listServers(token);
      setServerList(data);
    } catch { setServerList([]); }
    finally { setListLoading(false); }
  };

  useEffect(() => {
    if (tab === 'browse') loadServers();
  }, [tab]);

  if (showAvatar) return <AvatarScreen onBack={() => setShowAvatar(false)} />;

  const handleCreate = async () => {
    if (!serverName.trim() || !token) return;
    setLoading(true); setError('');
    try {
      const data = await api.createServer(serverName.trim(), token);
      setCreatedCode(data.code);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to create server');
    } finally { setLoading(false); }
  };

  const handleJoin = async (code?: string) => {
    const c = (code ?? joinCode).trim().toUpperCase();
    if (c.length !== 6 || !token) return;
    setLoading(true); setError('');
    try {
      const data = await api.getServer(c, token);
      setServer(data.code, data.name);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Server not found');
    } finally { setLoading(false); }
  };

  const onKey = (e: React.KeyboardEvent, action: () => void) => {
    e.stopPropagation();
    if (e.key === 'Enter') action();
  };

  const switchTab = (t: typeof tab) => { setTab(t); setError(''); setCreatedCode(''); };

  return (
    <div className="pre-screen">
      <h1>TERRA&nbsp;CRAFT</h1>

      <div className="mc-panel">
        <div className="server-header">
          <span className="server-username">▶ {user?.username}</span>
          <button className="pre-btn-link" onClick={() => setShowAvatar(true)}>Edit Avatar</button>
          <button className="pre-btn-link pre-btn-logout" onClick={logout}>Logout</button>
        </div>

        <div className="pre-tabs">
          <button className={`pre-tab ${tab === 'browse' ? 'active' : ''}`} onClick={() => switchTab('browse')}>Browse</button>
          <button className={`pre-tab ${tab === 'create' ? 'active' : ''}`} onClick={() => switchTab('create')}>Create</button>
          <button className={`pre-tab ${tab === 'join'   ? 'active' : ''}`} onClick={() => switchTab('join')}>Join Code</button>
        </div>

        <div className="pre-form">
          {tab === 'browse' && (
            <>
              {listLoading ? (
                <div className="server-list-empty">Loading servers…</div>
              ) : serverList.length === 0 ? (
                <div className="server-list-empty">No servers yet. Create one!</div>
              ) : (
                <div className="server-list">
                  {serverList.map(s => (
                    <div key={s.code} className="server-list-row">
                      <div className="server-list-info">
                        <span className="server-list-name">{s.name}</span>
                        <span className="server-list-meta">{s.code} · {s.playerCount} online</span>
                      </div>
                      <button className="pre-btn server-list-join" onClick={() => handleJoin(s.code)} disabled={loading}>
                        Join
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {error && <div className="pre-error">{error}</div>}
              <button className="pre-btn-secondary" style={{ marginTop: 8, width: '100%', padding: '9px 0', cursor: 'pointer', border: '3px solid', borderColor: '#e8c898 #5a3412 #5a3412 #e8c898', fontFamily: "'Press Start 2P', monospace", fontSize: 9, color: '#3a1e00' }} onClick={loadServers}>↺ Refresh</button>
            </>
          )}

          {tab === 'create' && (
            createdCode ? (
              <>
                <div className="server-created">
                  <div className="server-created-label">Server created! Share this code:</div>
                  <div className="server-code-display">{createdCode}</div>
                  <div className="server-created-hint">Anyone with this code can join your world.</div>
                </div>
                <button className="pre-btn" onClick={() => setServer(createdCode, serverName.trim())}>Enter World</button>
              </>
            ) : (
              <>
                <input className="pre-input" type="text" placeholder="World name (e.g. My Survival World)"
                  value={serverName} maxLength={30}
                  onChange={e => setName(e.target.value)}
                  onKeyDown={e => onKey(e, handleCreate)} />
                {error && <div className="pre-error">{error}</div>}
                <button className="pre-btn" onClick={handleCreate} disabled={loading || !serverName.trim()}>
                  {loading ? 'Creating…' : 'Create World'}
                </button>
              </>
            )
          )}

          {tab === 'join' && (
            <>
              <input className="pre-input pre-input-code" type="text" placeholder="Enter 6-letter code"
                value={joinCode} maxLength={6}
                onChange={e => setCode(e.target.value.toUpperCase().replace(/[^A-Z]/g, ''))}
                onKeyDown={e => onKey(e, () => handleJoin())} />
              {error && <div className="pre-error">{error}</div>}
              <button className="pre-btn" onClick={() => handleJoin()} disabled={loading || joinCode.trim().length !== 6}>
                {loading ? 'Connecting…' : 'Join World'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
