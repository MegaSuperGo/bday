import { ArrowUp, X } from 'lucide-react';
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { gsap } from '../../animations/gsap';
import { useBriefing } from '../../app/BriefingContext';
import { prefersReducedMotion } from '../../hooks/useReducedMotion';
import { useVisualViewportVars } from '../../hooks/useVisualViewport';
import { sound } from '../../services/sound';
import type { OrbMood } from '../../three/orbScene';
import { OrbCanvas } from './OrbCanvas';
import { useChat, type UiMessage } from './useChat';
import styles from './Jarvis.module.css';

const SUGGESTIONS = ['Wann treffen wir uns?', 'Wo ist der Treffpunkt?', 'Was machen wir nach dem Escape Room?', 'Wo essen wir Sushi?', 'Was muss ich wissen?'];

const time = (t: number) => new Intl.DateTimeFormat('de-CH', { hour: '2-digit', minute: '2-digit' }).format(t);

export default function JarvisAssistant() {
  const { chatAvailable, guest } = useBriefing();
  const [open, setOpen] = useState(false);
  const [hover, setHover] = useState(false);
  const [mood, setMood] = useState<'idle' | 'thinking' | 'alert'>('idle');
  const [draft, setDraft] = useState('');
  const { messages, pending, thinking, send } = useChat(setMood);

  const panel = useRef<HTMLDivElement>(null);
  const orbBtn = useRef<HTMLButtonElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const list = useRef<HTMLOListElement>(null);
  const mobile = useRef(false);

  useVisualViewportVars(open);

  const orbMood: OrbMood = mood !== 'idle' ? mood : hover ? 'hover' : 'idle';

  // Expand from / collapse into the orb
  useLayoutEffect(() => {
    const el = panel.current;
    if (!el) return;
    mobile.current = window.matchMedia('(max-width: 640px)').matches;
    const reduced = prefersReducedMotion();
    if (open) {
      el.hidden = false;
      if (!reduced) {
        gsap.fromTo(
          el,
          { clipPath: 'circle(0px at calc(100% - 44px) calc(100% - 44px))' },
          { clipPath: 'circle(150% at calc(100% - 44px) calc(100% - 44px))', duration: 0.7, ease: 'power3.inOut', clearProps: 'clipPath' },
        );
        gsap.from(el.querySelectorAll('[data-chat-anim]'), { autoAlpha: 0, y: 12, stagger: 0.05, delay: 0.25, duration: 0.5, clearProps: 'all' });
      }
      window.setTimeout(() => input.current?.focus({ preventScroll: true }), reduced ? 0 : 320);
      if (mobile.current) document.documentElement.style.overflow = 'hidden';
    } else if (!el.hidden) {
      const done = () => {
        el.hidden = true;
      };
      if (reduced) done();
      else
        gsap.to(el, {
          clipPath: 'circle(0px at calc(100% - 44px) calc(100% - 44px))',
          duration: 0.45,
          ease: 'power3.in',
          onComplete: () => {
            done();
            gsap.set(el, { clearProps: 'clipPath' });
          },
        });
      document.documentElement.style.overflow = '';
    }
  }, [open]);

  useEffect(() => () => void (document.documentElement.style.overflow = ''), []);

  // Keep the newest message in view
  useEffect(() => {
    const el = list.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
  }, [messages, thinking, open]);

  const toggle = useCallback((v: boolean) => {
    setOpen(v);
    sound.play(v ? 'open' : 'close');
    if (!v) window.setTimeout(() => orbBtn.current?.focus({ preventScroll: true }), 50);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: globalThis.KeyboardEvent) => e.key === 'Escape' && toggle(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, toggle]);

  const submit = () => {
    if (!draft.trim() || pending) return;
    void send(draft);
    setDraft('');
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  };

  const hasUserMessage = messages.some((m) => m.role === 'user');

  return (
    <>
      <button
        ref={orbBtn}
        type="button"
        className={`${styles.orb} ${open ? styles.orbHidden : ''}`}
        onClick={() => toggle(true)}
        onPointerEnter={() => setHover(true)}
        onPointerLeave={() => setHover(false)}
        onFocus={() => setHover(true)}
        onBlur={() => setHover(false)}
        aria-label="JARVIS öffnen – Fragen zur Mission stellen"
        aria-expanded={open}
        aria-controls="jarvis-panel"
      >
        <OrbCanvas mood={orbMood} running={!open} />
        <span className={`mono ${styles.orbLabel}`}>JARVIS</span>
      </button>

      <div
        ref={panel}
        id="jarvis-panel"
        className={styles.panel}
        role="dialog"
        aria-modal="false"
        aria-label="JARVIS Assistent"
        hidden
      >
        <div className={styles.sheet}>
          <header className={styles.header} data-chat-anim>
            <div className={`${styles.miniOrb} ${mood === 'alert' ? styles.miniAlert : mood === 'thinking' ? styles.miniThinking : ''}`} aria-hidden />
            <div className={styles.headText}>
              <span className={styles.name}>JARVIS</span>
              <span className={`mono ${styles.state}`}>
                <i className={chatAvailable ? styles.dotOk : styles.dotOff} />
                {chatAvailable ? (thinking ? 'Analysiert …' : 'KI-Kern verbunden') : 'KI-Kern nicht verbunden'}
              </span>
            </div>
            <button type="button" className={styles.close} onClick={() => toggle(false)} aria-label="JARVIS schliessen">
              <X />
            </button>
          </header>

          <ol ref={list} className={styles.messages} aria-live="polite" aria-relevant="additions">
            <li className={`${styles.msg} ${styles.system}`} data-chat-anim>
              <span className={`mono ${styles.meta}`}>SYSTEM</span>
              <p>
                {chatAvailable
                  ? `Verbindung hergestellt, ${guest.firstName}. Stell JARVIS eine Frage zur Mission.`
                  : 'JARVIS ist noch nicht mit dem KI-Kern verbunden. Sobald der Gastgeber die Verbindung aktiviert, kannst du hier Fragen stellen.'}
              </p>
            </li>
            {messages.map((m) => (
              <Message key={m.id} m={m} />
            ))}
            {thinking && (
              <li className={`${styles.msg} ${styles.assistant}`}>
                <span className={`mono ${styles.meta}`}>JARVIS</span>
                <span className={styles.typing} aria-label="JARVIS schreibt">
                  <i />
                  <i />
                  <i />
                </span>
              </li>
            )}
          </ol>

          {!hasUserMessage && chatAvailable && (
            <div className={styles.suggestions} data-chat-anim>
              {SUGGESTIONS.map((q) => (
                <button key={q} type="button" onClick={() => void send(q)} disabled={pending}>
                  {q}
                </button>
              ))}
            </div>
          )}

          <form
            className={styles.composer}
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
            data-chat-anim
          >
            <label htmlFor="jarvis-input" className="visually-hidden">
              Nachricht an JARVIS
            </label>
            <textarea
              ref={input}
              id="jarvis-input"
              rows={1}
              value={draft}
              maxLength={500}
              placeholder={chatAvailable ? 'Frage an JARVIS …' : 'Befehle wie /status funktionieren lokal'}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={onKeyDown}
              enterKeyHint="send"
            />
            <button type="submit" className={styles.send} disabled={!draft.trim() || pending} aria-label="Senden">
              <ArrowUp />
            </button>
          </form>
          {draft.length > 400 && <span className={`mono ${styles.count}`}>{draft.length}/500</span>}
        </div>
      </div>
    </>
  );
}

function Message({ m }: { m: UiMessage }) {
  const who = m.role === 'user' ? 'DU' : m.role === 'assistant' ? 'JARVIS' : 'SYSTEM';
  return (
    <li className={`${styles.msg} ${styles[m.role]} ${m.tone ? styles[m.tone] : ''}`}>
      <span className={`mono ${styles.meta}`}>
        {who} · <time dateTime={new Date(m.at).toISOString()}>{time(m.at)}</time>
      </span>
      <p>{m.content}</p>
    </li>
  );
}
