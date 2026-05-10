import { useState } from 'react';
import { api } from '../lib/api';
import { useAuthStore } from '../stores/authStore';

interface Props { onBack: () => void; }

export function AvatarScreen({ onBack }: Props) {
  const token     = useAuthStore(s => s.token);
  const user      = useAuthStore(s => s.user);
  const setAvatar = useAuthStore(s => s.setAvatar);

  const [skinColor,  setSkin]  = useState(user?.skinColor  ?? '#f4c07a');
  const [shirtColor, setShirt] = useState(user?.shirtColor ?? '#3a5fa0');
  const [pantsColor, setPants] = useState(user?.pantsColor ?? '#1e3a5f');
  const [saving, setSaving]    = useState(false);
  const [error, setError]      = useState('');

  const save = async () => {
    if (!token) return;
    setSaving(true);
    setError('');
    try {
      await api.updateAvatar({ skinColor, shirtColor, pantsColor }, token);
      setAvatar({ skinColor, shirtColor, pantsColor });
      onBack();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="pre-screen">
      <h1>TERRA&nbsp;CRAFT</h1>
      <div className="pre-subtitle">customize avatar</div>

      <div className="avatar-preview">
        <div className="av-head" style={{ background: skinColor }} />
        <div className="av-body" style={{ background: shirtColor }} />
        <div className="av-limbs">
          <div className="av-arm" style={{ background: shirtColor }} />
          <div className="av-gap" />
          <div className="av-arm" style={{ background: shirtColor }} />
        </div>
        <div className="av-limbs">
          <div className="av-leg" style={{ background: pantsColor }} />
          <div className="av-gap-sm" />
          <div className="av-leg" style={{ background: pantsColor }} />
        </div>
      </div>

      <div className="pre-form">
        <label className="color-row">
          <span>Skin</span>
          <input type="color" value={skinColor}  onChange={e => setSkin(e.target.value)}  />
        </label>
        <label className="color-row">
          <span>Shirt</span>
          <input type="color" value={shirtColor} onChange={e => setShirt(e.target.value)} />
        </label>
        <label className="color-row">
          <span>Pants</span>
          <input type="color" value={pantsColor} onChange={e => setPants(e.target.value)} />
        </label>

        {error && <div className="pre-error">{error}</div>}

        <div className="pre-row">
          <button className="pre-btn-secondary" onClick={onBack}>Back</button>
          <button className="pre-btn" onClick={save} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
