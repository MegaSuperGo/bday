import { KeyRound, PlugZap, Save, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { AiSettingsView } from '../../../shared/types';
import { adminApi, fmtDate } from './api';
import styles from './admin.module.css';

export function AiPanel({ onAuthError }: { onAuthError: (e: unknown) => void }) {
  const [ai, setAi] = useState<AiSettingsView | null>(null);
  const [encryption, setEncryption] = useState(true);
  const [model, setModel] = useState('');
  const [prompt, setPrompt] = useState('');
  const [key, setKey] = useState('');
  const [models, setModels] = useState<string[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const apply = (v: AiSettingsView) => {
    setAi(v);
    setModel(v.model);
    setPrompt(v.systemPrompt);
  };

  useEffect(() => {
    adminApi
      .get<{ ai: AiSettingsView; encryptionConfigured: boolean }>('/ai')
      .then((r) => {
        apply(r.ai);
        setEncryption(r.encryptionConfigured);
      })
      .catch((e) => {
        onAuthError(e);
        setError((e as Error).message);
      });
  }, [onAuthError]);

  const act = async (name: string, fn: () => Promise<void>) => {
    setBusy(name);
    setError(null);
    setInfo(null);
    try {
      await fn();
    } catch (e) {
      onAuthError(e);
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  if (!ai) return <section>{error ? <p className={styles.error}>{error}</p> : <div className={styles.loading} />}</section>;

  const settingsDirty = model !== ai.model || prompt !== ai.systemPrompt;

  return (
    <section>
      <header className={styles.panelHead}>
        <div>
          <p className={`mono ${styles.dim}`}>KI-Kern</p>
          <h1 className={styles.h1}>JARVIS / Groq</h1>
        </div>
      </header>
      {!encryption && (
        <p className={styles.error}>
          ENCRYPTION_KEY ist im Worker nicht gesetzt. Ohne diesen Secret kann kein API-Schlüssel gespeichert werden (siehe README).
        </p>
      )}
      {error && <p className={styles.error}>{error}</p>}
      {info && <p className={styles.success}>{info}</p>}

      <div className={styles.statusCard}>
        <div>
          <span className={`mono ${styles.dim}`}>API-Schlüssel</span>
          <p className={ai.hasApiKey ? styles.ok : styles.warn}>{ai.hasApiKey ? 'Hinterlegt (verschlüsselt)' : 'Nicht hinterlegt'}</p>
          {ai.keyUpdatedAt && <p className={`mono ${styles.dim}`}>Aktualisiert {fmtDate(ai.keyUpdatedAt)}</p>}
        </div>
        <div>
          <span className={`mono ${styles.dim}`}>Letzter Verbindungstest</span>
          {ai.lastTest ? (
            <>
              <p className={ai.lastTest.ok ? styles.ok : styles.warn}>{ai.lastTest.ok ? 'Erfolgreich' : 'Fehlgeschlagen'}</p>
              <p className={styles.hint}>
                {ai.lastTest.message} · {fmtDate(ai.lastTest.at)}
              </p>
            </>
          ) : (
            <p className={styles.dim}>Noch nicht getestet</p>
          )}
        </div>
        <button
          type="button"
          className="btn"
          disabled={!ai.hasApiKey || !!busy}
          onClick={() =>
            act('test', async () => {
              const r = await adminApi.post<{ ok: boolean; message: string; models: string[]; ai: AiSettingsView }>('/ai/test');
              setAi(r.ai);
              setModels(r.models);
              if (r.ok) setInfo(r.message);
              else setError(r.message);
            })
          }
        >
          <PlugZap /> {busy === 'test' ? 'Teste …' : 'Verbindung testen'}
        </button>
      </div>

      <fieldset className={styles.group}>
        <legend className="mono">{ai.hasApiKey ? 'Schlüssel ersetzen' : 'Schlüssel hinterlegen'}</legend>
        <p className={styles.note}>
          Der Schlüssel wird über HTTPS an den Worker gesendet, dort mit AES-256-GCM verschlüsselt und in D1 gespeichert. Er wird nie wieder an den
          Browser zurückgegeben. Einen Schlüssel erhältst du unter console.groq.com/keys.
        </p>
        <form
          className={styles.addRow}
          onSubmit={(e) => {
            e.preventDefault();
            void act('key', async () => {
              const r = await adminApi.put<{ ai: AiSettingsView }>('/ai/key', { apiKey: key });
              apply(r.ai);
              setKey('');
              setInfo('Schlüssel gespeichert. Teste jetzt die Verbindung.');
            });
          }}
        >
          <label htmlFor="groq-key" className="visually-hidden">
            Groq API-Schlüssel
          </label>
          <input
            id="groq-key"
            className={styles.input}
            type="password"
            autoComplete="off"
            spellCheck={false}
            placeholder="gsk_…"
            value={key}
            onChange={(e) => setKey(e.target.value)}
          />
          <button type="submit" className="btn btn--primary" disabled={!key.trim() || !!busy || !encryption}>
            <KeyRound /> Speichern
          </button>
          {ai.hasApiKey && (
            <button
              type="button"
              className={`btn ${styles.dangerBtn}`}
              disabled={!!busy}
              onClick={() => {
                if (confirm('API-Schlüssel löschen? JARVIS ist danach für Gäste nicht mehr verfügbar.'))
                  void act('delete', async () => {
                    const r = await adminApi.del<{ ai: AiSettingsView }>('/ai/key');
                    apply(r.ai);
                    setInfo('Schlüssel gelöscht.');
                  });
              }}
            >
              <Trash2 /> Löschen
            </button>
          )}
        </form>
      </fieldset>

      <fieldset className={styles.group}>
        <legend className="mono">Modell &amp; Persönlichkeit</legend>
        <div className={styles.formGrid}>
          <label className={styles.field}>
            <span className={`mono ${styles.label}`}>Modell</span>
            <input className={styles.input} list="groq-models" value={model} onChange={(e) => setModel(e.target.value)} spellCheck={false} />
            <datalist id="groq-models">
              {models.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
            <span className={styles.hint}>
              {models.length ? `${models.length} Modelle verfügbar (aus dem Verbindungstest).` : 'Nach einem Verbindungstest werden verfügbare Modelle vorgeschlagen.'}
            </span>
          </label>
          <label className={`${styles.field} ${styles.wide}`}>
            <span className={`mono ${styles.label}`}>Systemprompt (Persönlichkeit)</span>
            <textarea className={`${styles.textarea} ${styles.code}`} rows={10} value={prompt} maxLength={6000} onChange={(e) => setPrompt(e.target.value)} />
            <span className={styles.hint}>
              Verbindliche Regeln (keine erfundenen Informationen, keine Geheimnisse preisgeben) und die aktuellen Eventdaten werden automatisch angehängt.
            </span>
          </label>
        </div>
        <button
          type="button"
          className="btn btn--primary"
          disabled={!settingsDirty || !!busy}
          onClick={() =>
            void act('settings', async () => {
              const r = await adminApi.put<{ ai: AiSettingsView }>('/ai', { model, systemPrompt: prompt });
              apply(r.ai);
              setInfo('Einstellungen gespeichert.');
            })
          }
        >
          <Save /> Einstellungen speichern
        </button>
      </fieldset>
    </section>
  );
}
