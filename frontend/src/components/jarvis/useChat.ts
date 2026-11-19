import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChatMessage, ChatResponse } from '../../../../shared/types';
import { useBriefing } from '../../app/BriefingContext';
import { apiFetch, ApiRequestError } from '../../services/api';
import { sound } from '../../services/sound';

export interface UiMessage {
  id: string;
  /** "system" = generated locally by the interface, never by the AI */
  role: 'user' | 'assistant' | 'system';
  content: string;
  at: number;
  tone?: 'error' | 'alert';
}

const STORE = 'nexus.chat';
const uid = () => Math.random().toString(36).slice(2, 10);

function load(): UiMessage[] {
  try {
    const raw = sessionStorage.getItem(STORE);
    return raw ? (JSON.parse(raw) as UiMessage[]).slice(-60) : [];
  } catch {
    return [];
  }
}

function errorText(e: unknown): string {
  if (e instanceof ApiRequestError) {
    if (e.code === 'CHAT_NOT_CONFIGURED') return 'Der KI-Kern ist noch nicht verbunden. Der Gastgeber muss JARVIS erst im Admin-Bereich aktivieren.';
    if (e.code === 'GUEST_UNAUTHENTICATED') return 'Deine Sitzung ist abgelaufen. Bitte lade die Seite neu und identifiziere dich erneut.';
    return e.message;
  }
  return 'Unbekannter Fehler bei der Übertragung.';
}

export function useChat(onMood: (m: 'idle' | 'thinking' | 'alert') => void) {
  const { token, guest, chatAvailable, notify } = useBriefing();
  const [messages, setMessages] = useState<UiMessage[]>(load);
  /** any request/command running – blocks sending */
  const [pending, setPending] = useState(false);
  /** waiting for the AI – shows the typing indicator */
  const [thinking, setThinking] = useState(false);
  const busy = useRef(false);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    try {
      sessionStorage.setItem(STORE, JSON.stringify(messages.slice(-60)));
    } catch {
      /* ignore */
    }
  }, [messages]);

  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  const push = useCallback((m: Omit<UiMessage, 'id' | 'at'>) => {
    setMessages((list) => [...list, { ...m, id: uid(), at: Date.now() }]);
  }, []);

  /** Local interface commands – answered by the system, clearly labelled as such. */
  const command = useCallback(
    async (raw: string): Promise<boolean> => {
      const cmd = raw.trim().toLowerCase().normalize('NFC');
      if (!cmd.startsWith('/')) return false;
      push({ role: 'user', content: raw.trim() });
      switch (cmd) {
        case '/hilfe':
        case '/help':
          push({ role: 'system', content: 'Verfügbare Befehle:\n/status – Systemdiagnose\n/neu – Verlauf löschen\n/hilfe – diese Übersicht' });
          return true;
        case '/neu':
        case '/clear':
          setMessages([]);
          return true;
        case '/status': {
          const t0 = performance.now();
          let latency = 'nicht erreichbar';
          try {
            await apiFetch('/api/health');
            latency = `${Math.round(performance.now() - t0)} ms`;
          } catch {
            /* keep default */
          }
          const time = new Intl.DateTimeFormat('de-CH', { timeZone: 'Europe/Zurich', timeStyle: 'medium' }).format(new Date());
          push({
            role: 'system',
            content: `Systemdiagnose\nGast: ${guest.firstName}\nBriefing-Fortschritt: ${guest.progress}%\nStatus: ${guest.status === 'COMPLETED' ? 'abgeschlossen' : guest.status === 'IN_PROGRESS' ? 'in Bearbeitung' : 'nicht gestartet'}\nKI-Kern: ${chatAvailable ? 'verbunden' : 'nicht konfiguriert'}\nServer-Latenz: ${latency}\nOrtszeit Luzern: ${time}`,
          });
          return true;
        }
        case '/mark2':
        case '/mark-ii': {
          const on = document.documentElement.classList.toggle('mark-ii');
          push({ role: 'system', content: on ? 'Protokoll MARK II aktiviert. Blaupausen-Modus.' : 'Protokoll MARK II deaktiviert.' });
          return true;
        }
        case '/selbstzerstörung':
        case '/selbstzerstoerung':
        case '/selfdestruct': {
          onMood('alert');
          sound.play('alert');
          const seq = ['Selbstzerstörung eingeleitet.', '3', '2', '1'];
          seq.forEach((line, i) => {
            timers.current.push(window.setTimeout(() => push({ role: 'system', content: line, tone: 'alert' }), i * 800));
          });
          timers.current.push(
            window.setTimeout(() => {
              push({ role: 'system', content: 'Abgebrochen. Der Gastgeber hat diese Funktion vorsorglich deaktiviert. Die Party findet statt.' });
              onMood('idle');
              sound.play('confirm');
            }, seq.length * 800 + 400),
          );
          await new Promise((r) => window.setTimeout(r, seq.length * 800 + 450));
          return true;
        }
        default:
          push({ role: 'system', content: `Unbekannter Befehl «${raw.trim()}». /hilfe zeigt verfügbare Befehle.`, tone: 'error' });
          return true;
      }
    },
    [push, guest, chatAvailable, onMood],
  );

  const send = useCallback(
    async (text: string) => {
      const content = text.trim().slice(0, 500);
      if (!content || busy.current) return;
      sound.play('send');
      if (content.startsWith('/')) {
        // lock while a command runs so outputs never interleave
        busy.current = true;
        setPending(true);
        try {
          await command(content);
        } finally {
          busy.current = false;
          setPending(false);
        }
        return;
      }

      const history: ChatMessage[] = [...messages, { role: 'user' as const, content, id: '', at: 0 }]
        .filter((m): m is UiMessage & { role: 'user' | 'assistant' } => (m.role === 'user' || m.role === 'assistant') && !m.content.startsWith('/'))
        .slice(-12)
        .map(({ role, content: c }) => ({ role, content: c }));

      push({ role: 'user', content });
      busy.current = true;
      setPending(true);
      setThinking(true);
      onMood('thinking');
      try {
        const res = await apiFetch<ChatResponse>('/api/chat', { method: 'POST', token, body: { messages: history } });
        push({ role: 'assistant', content: res.reply });
        sound.play('receive');
      } catch (e) {
        push({ role: 'system', content: errorText(e), tone: 'error' });
        if (e instanceof ApiRequestError && e.status === 401) notify('Sitzung abgelaufen.', 'warn');
      } finally {
        busy.current = false;
        setPending(false);
        setThinking(false);
        onMood('idle');
      }
    },
    [command, messages, push, token, onMood, notify],
  );

  return { messages, pending, thinking, send };
}
