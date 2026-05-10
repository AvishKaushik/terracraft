import { useEffect, useRef, useState } from 'react';
import { socket } from '../lib/socket';
import { useGameStore } from '../stores/gameStore';
import { useAuthStore } from '../stores/authStore';

interface Message { id: number; name: string; text: string; }
let msgId = 0;

export function ChatOverlay() {
  const chatOpen    = useGameStore(s => s.chatOpen);
  const setChatOpen = useGameStore(s => s.setChatOpen);
  const playerName  = useAuthStore(s => s.user?.username ?? 'Player');

  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft]       = useState('');
  const inputRef  = useRef<HTMLInputElement>(null);
  const listRef   = useRef<HTMLDivElement>(null);

  // Receive messages from server
  useEffect(() => {
    const handler = ({ name, text }: { name: string; text: string }) => {
      setMessages(prev => [...prev.slice(-49), { id: msgId++, name, text }]);
    };
    socket.on('chat:message', handler);
    return () => { socket.off('chat:message', handler); };
  }, []);

  // Auto-scroll on new message
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages]);

  // Focus input when chat opens
  useEffect(() => {
    if (chatOpen) inputRef.current?.focus();
  }, [chatOpen]);

  const send = () => {
    const text = draft.trim();
    if (text) {
      socket.emit('chat:message', { name: playerName, text });
    }
    setDraft('');
    setChatOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    e.stopPropagation();
    if (e.key === 'Enter') send();
    if (e.key === 'Escape') { setDraft(''); setChatOpen(false); }
  };

  return (
    <div id="chat-overlay">
      <div id="chat-messages" ref={listRef}>
        {messages.map(m => (
          <div key={m.id} className="chat-msg">
            <span className="chat-name">{m.name}: </span>{m.text}
          </div>
        ))}
      </div>
      {chatOpen && (
        <input
          ref={inputRef}
          id="chat-input"
          type="text"
          placeholder="Press Enter to send, Esc to cancel"
          value={draft}
          maxLength={200}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
        />
      )}
    </div>
  );
}
