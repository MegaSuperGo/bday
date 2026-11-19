import { Check, Pencil, Plus, RotateCcw, Trash2, X } from 'lucide-react';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import type { AdminGuest } from '../../../shared/types';
import { adminApi, fmtDate, STATUS_LABEL } from './api';
import styles from './admin.module.css';

export function GuestsPanel({ onAuthError }: { onAuthError: (e: unknown) => void }) {
  const [guests, setGuests] = useState<AdminGuest[]>([]);
  const [name, setName] = useState('');
  const [editing, setEditing] = useState<{ id: number; name: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const run = useCallback(
    async (fn: () => Promise<unknown>, success?: string) => {
      setError(null);
      setInfo(null);
      try {
        await fn();
        const g = await adminApi.get<{ guests: AdminGuest[] }>('/guests');
        setGuests(g.guests);
        if (success) setInfo(success);
        return true;
      } catch (e) {
        onAuthError(e);
        setError((e as Error).message);
        return false;
      }
    },
    [onAuthError],
  );

  useEffect(() => {
    void run(async () => undefined);
  }, [run]);

  const add = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    if (await run(() => adminApi.post('/guests', { firstName: name }), `${name.trim()} wurde hinzugefügt.`)) setName('');
  };

  const save = async () => {
    if (!editing) return;
    if (await run(() => adminApi.patch(`/guests/${editing.id}`, { firstName: editing.name }), 'Name aktualisiert.')) setEditing(null);
  };

  return (
    <section>
      <header className={styles.panelHead}>
        <div>
          <p className={`mono ${styles.dim}`}>Gästeliste</p>
          <h1 className={styles.h1}>Gäste</h1>
        </div>
      </header>
      <p className={styles.note}>
        Gäste identifizieren sich mit ihrem Vornamen. Gross-/Kleinschreibung und Umlaute (ü / ue) werden automatisch abgeglichen. Jeder Name darf nur
        einmal vorkommen.
      </p>

      <form className={styles.addRow} onSubmit={add}>
        <label htmlFor="new-guest" className="visually-hidden">
          Vorname
        </label>
        <input id="new-guest" className={styles.input} placeholder="Vorname" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} />
        <button type="submit" className="btn btn--primary" disabled={!name.trim()}>
          <Plus /> Gast hinzufügen
        </button>
      </form>
      {error && <p className={styles.error}>{error}</p>}
      {info && <p className={styles.success}>{info}</p>}

      {guests.length === 0 ? (
        <p className={styles.empty}>Die Gästeliste ist leer.</p>
      ) : (
        <ul className={styles.guestList}>
          {guests.map((g) => (
            <li key={g.id} className={styles.guestRow}>
              <div className={styles.guestMain}>
                {editing?.id === g.id ? (
                  <input
                    className={styles.input}
                    value={editing.name}
                    maxLength={40}
                    autoFocus
                    aria-label="Neuer Vorname"
                    onChange={(e) => setEditing({ id: g.id, name: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void save();
                      if (e.key === 'Escape') setEditing(null);
                    }}
                  />
                ) : (
                  <span className={styles.guestName}>{g.firstName}</span>
                )}
                <span className={`${styles.badge} ${styles['b_' + g.status]}`}>{STATUS_LABEL[g.status]}</span>
              </div>
              <div className={`mono ${styles.guestMeta}`}>
                <span>Gestartet {fmtDate(g.startedAt)}</span>
                <span>Abgeschlossen {fmtDate(g.completedAt)}</span>
                <span>{g.progress}%</span>
              </div>
              <div className={styles.guestActions}>
                {editing?.id === g.id ? (
                  <>
                    <button type="button" className={styles.iconBtn} onClick={() => void save()} aria-label="Speichern">
                      <Check />
                    </button>
                    <button type="button" className={styles.iconBtn} onClick={() => setEditing(null)} aria-label="Abbrechen">
                      <X />
                    </button>
                  </>
                ) : (
                  <>
                    <button type="button" className={styles.iconBtn} onClick={() => setEditing({ id: g.id, name: g.firstName })} aria-label={`${g.firstName} umbenennen`} title="Umbenennen">
                      <Pencil />
                    </button>
                    <button
                      type="button"
                      className={styles.iconBtn}
                      title="Fortschritt zurücksetzen"
                      aria-label={`Fortschritt von ${g.firstName} zurücksetzen`}
                      onClick={() => {
                        if (confirm(`Fortschritt von ${g.firstName} zurücksetzen? Der Gast muss sich danach erneut identifizieren.`))
                          void run(() => adminApi.post(`/guests/${g.id}/reset`), 'Fortschritt zurückgesetzt.');
                      }}
                    >
                      <RotateCcw />
                    </button>
                    <button
                      type="button"
                      className={`${styles.iconBtn} ${styles.danger}`}
                      title="Entfernen"
                      aria-label={`${g.firstName} entfernen`}
                      onClick={() => {
                        if (confirm(`${g.firstName} endgültig von der Gästeliste entfernen? Fortschritt und Chat-Statistik werden gelöscht.`))
                          void run(() => adminApi.del(`/guests/${g.id}`), 'Gast entfernt.');
                      }}
                    >
                      <Trash2 />
                    </button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
