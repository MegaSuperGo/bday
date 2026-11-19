import { ArrowRight, Lock } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { adminApi } from './api';
import styles from './admin.module.css';

export function Login({ onSuccess }: { onSuccess: () => void }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!password || busy) return;
    setBusy(true);
    setError(null);
    try {
      await adminApi.post('/login', { password });
      setPassword('');
      onSuccess();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className={styles.loginWrap}>
      <form className={`${styles.loginCard} brackets`} onSubmit={submit}>
        <p className={`mono ${styles.dim}`}>NEXUS · Mission Control</p>
        <Lock className={styles.lockIcon} />
        <h1 className={styles.loginTitle}>Gastgeber-Zugang</h1>
        <label htmlFor="pw" className={`mono ${styles.label}`}>
          Passwort
        </label>
        <input
          id="pw"
          type="password"
          className={styles.input}
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
        />
        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="btn btn--primary" disabled={!password || busy}>
          {busy ? 'Prüfe …' : 'Anmelden'} <ArrowRight />
        </button>
      </form>
    </main>
  );
}
