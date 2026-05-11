import { useEffect, useState } from 'react';
import { Game } from './components/Game';
import { AuthScreen } from './ui/AuthScreen';
import { ServerScreen } from './ui/ServerScreen';
import { StartScreen } from './ui/StartScreen';
import { Hotbar } from './ui/Hotbar';
import { HUD } from './ui/HUD';
import { Crosshair } from './ui/Crosshair';
import { ChatOverlay } from './ui/ChatOverlay';
import { Inventory } from './ui/Inventory';
import { SettingsScreen } from './ui/SettingsScreen';
import { PlayerList } from './ui/PlayerList';
import { HotbarToast } from './ui/HotbarToast';
import { ChestUI } from './ui/ChestUI';
import { useGameStore } from './stores/gameStore';
import { useAuthStore } from './stores/authStore';

export default function App() {
  const started      = useGameStore(s => s.started);
  const mouseLocked  = useGameStore(s => s.mouseLocked);
  const chatOpen     = useGameStore(s => s.chatOpen);
  const setSettingsOpen = useGameStore(s => s.setSettingsOpen);

  const token      = useAuthStore(s => s.token);
  const serverCode = useAuthStore(s => s.serverCode);

  const [canvasEl, setCanvasEl] = useState<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const el = document.querySelector('canvas');
    if (el) setCanvasEl(el as HTMLCanvasElement);
  }, [serverCode]); // re-find canvas when entering a server

  useEffect(() => {
    if (!started || !canvasEl) return;
    const onClick = () => { if (!mouseLocked && !chatOpen) canvasEl.requestPointerLock(); };
    canvasEl.addEventListener('click', onClick);
    return () => canvasEl.removeEventListener('click', onClick);
  }, [started, mouseLocked, chatOpen, canvasEl]);

  // Not logged in
  if (!token) return <AuthScreen />;

  // Logged in but no server selected
  if (!serverCode) return <ServerScreen />;

  // In a server — show the game
  return (
    <>
      <Game />
      <div id="night-overlay" />
      <div id="water-overlay" />
      <StartScreen canvasEl={canvasEl} />
      <Inventory />
      <ChestUI />
      <SettingsScreen />
      {started && (
        <>
          <Crosshair />
          <Hotbar />
          <HUD />
          <ChatOverlay />
          <PlayerList />
          <HotbarToast />
          <div id="pause-hint" className={!mouseLocked && !chatOpen ? 'show' : ''}>
            Press ESC to pause · T to chat · E for inventory · click to resume
          </div>
          {!mouseLocked && !chatOpen && (
            <button id="settings-btn" onClick={() => setSettingsOpen(true)}>⚙ Settings</button>
          )}
          <div id="damage-flash" />
        </>
      )}
    </>
  );
}
