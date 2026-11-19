import { Save } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import type { EventSettings, Place } from '../../../shared/types';
import { formatGermanDate, isValidDate } from '../../../shared/time';
import { adminApi } from './api';
import styles from './admin.module.css';

type PlaceKey = 'meeting' | 'escapeRoom' | 'restaurant';

export function EventPanel({ onAuthError }: { onAuthError: (e: unknown) => void }) {
  const [ev, setEv] = useState<EventSettings | null>(null);
  const [saved, setSaved] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    adminApi
      .get<{ event: EventSettings }>('/event')
      .then((r) => {
        setEv(r.event);
        setSaved(JSON.stringify(r.event));
      })
      .catch((e) => {
        onAuthError(e);
        setError((e as Error).message);
      });
  }, [onAuthError]);

  if (!ev) return <section>{error ? <p className={styles.error}>{error}</p> : <div className={styles.loading} />}</section>;

  const dirty = JSON.stringify(ev) !== saved;
  const set = <K extends keyof EventSettings>(k: K, v: EventSettings[K]) => setEv({ ...ev, [k]: v });
  const setPlace = (k: PlaceKey, field: keyof Place | 'time', v: string) => {
    const place = { ...ev[k] } as Record<string, unknown>;
    if (field === 'lat' || field === 'lng') place[field] = v === '' ? null : Number(v.replace(',', '.'));
    else place[field] = v;
    setEv({ ...ev, [k]: place });
  };

  const save = async () => {
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      const r = await adminApi.put<{ event: EventSettings }>('/event', ev);
      setEv(r.event);
      setSaved(JSON.stringify(r.event));
      setInfo('Gespeichert. Gäste sehen die Änderungen beim nächsten Laden der Seite.');
    } catch (e) {
      onAuthError(e);
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const placeFields = (k: PlaceKey, withTime: boolean) => {
    const p = ev[k] as Place & { time?: string };
    return (
      <div className={styles.formGrid}>
        <Field label="Name">
          <input className={styles.input} value={p.name} onChange={(e) => setPlace(k, 'name', e.target.value)} maxLength={120} />
        </Field>
        <Field label="Adresse">
          <input className={styles.input} value={p.address} onChange={(e) => setPlace(k, 'address', e.target.value)} maxLength={200} placeholder="Strasse Nr., PLZ" />
        </Field>
        <Field label="Ort">
          <input className={styles.input} value={p.city} onChange={(e) => setPlace(k, 'city', e.target.value)} maxLength={80} />
        </Field>
        {withTime && (
          <Field label="Uhrzeit (optional)">
            <input className={styles.input} type="time" value={p.time ?? ''} onChange={(e) => setPlace(k, 'time', e.target.value)} />
          </Field>
        )}
        <Field label="Breitengrad (optional)">
          <input className={styles.input} inputMode="decimal" value={p.lat ?? ''} onChange={(e) => setPlace(k, 'lat', e.target.value)} placeholder="47.0489" />
        </Field>
        <Field label="Längengrad (optional)">
          <input className={styles.input} inputMode="decimal" value={p.lng ?? ''} onChange={(e) => setPlace(k, 'lng', e.target.value)} placeholder="8.3062" />
        </Field>
        <Field label="Hinweis für Gäste" wide>
          <textarea className={styles.textarea} rows={2} value={p.detail} onChange={(e) => setPlace(k, 'detail', e.target.value)} maxLength={600} />
        </Field>
      </div>
    );
  };

  return (
    <section>
      <header className={styles.panelHead}>
        <div>
          <p className={`mono ${styles.dim}`}>Konfiguration</p>
          <h1 className={styles.h1}>Event</h1>
        </div>
        <button type="button" className="btn btn--primary" onClick={() => void save()} disabled={!dirty || busy}>
          <Save /> {busy ? 'Speichert …' : 'Speichern'}
        </button>
      </header>
      {error && <p className={styles.error}>{error}</p>}
      {info && <p className={styles.success}>{info}</p>}

      <Group title="Allgemein" note="Alle Zeiten gelten in der Zeitzone Europe/Zurich (Sommer-/Winterzeit wird automatisch berücksichtigt).">
        <div className={styles.formGrid}>
          <Field label="Titel">
            <input className={styles.input} value={ev.title} onChange={(e) => set('title', e.target.value)} maxLength={80} />
          </Field>
          <Field label="Datum" hint={isValidDate(ev.date) ? formatGermanDate(ev.date) : undefined}>
            <input className={styles.input} type="date" value={ev.date} onChange={(e) => set('date', e.target.value)} />
          </Field>
          <Field label="Startzeit">
            <input className={styles.input} type="time" value={ev.startTime} onChange={(e) => set('startTime', e.target.value)} />
          </Field>
          <Field label="Endzeit (optional)" hint="Leer lassen, solange unbekannt. Kalender-Einträge markieren dann nur den Treffpunkt.">
            <input className={styles.input} type="time" value={ev.endTime ?? ''} onChange={(e) => set('endTime', e.target.value || null)} />
          </Field>
        </div>
      </Group>

      <Group title="Mission 01 · Treffpunkt">{placeFields('meeting', false)}</Group>
      <Group title="Mission 02 · Escape Room" note="Solange kein Name eingetragen ist, zeigt das Briefing «Standort wird noch übermittelt».">
        {placeFields('escapeRoom', true)}
      </Group>
      <Group title="Mission 03 · Restaurant">{placeFields('restaurant', true)}</Group>

      <Group title="Missionstexte">
        <div className={styles.formGrid}>
          {(['meetup', 'escape', 'sushi'] as const).map((k, i) => (
            <Field key={k} label={`Mission 0${i + 1}`} wide>
              <textarea className={styles.textarea} rows={2} value={ev.missions[k]} maxLength={800} onChange={(e) => set('missions', { ...ev.missions, [k]: e.target.value })} />
            </Field>
          ))}
        </div>
      </Group>

      <Group title="Weitere Angaben">
        <div className={styles.formGrid}>
          <Field label="Zusätzliche Hinweise (im Dossier und für JARVIS)" wide>
            <textarea className={styles.textarea} rows={3} value={ev.additionalInstructions} maxLength={1500} onChange={(e) => set('additionalInstructions', e.target.value)} />
          </Field>
          <Field label="Kalenderbeschreibung" wide>
            <textarea className={styles.textarea} rows={4} value={ev.calendarDescription} maxLength={1500} onChange={(e) => set('calendarDescription', e.target.value)} />
          </Field>
        </div>
      </Group>
    </section>
  );
}

function Group({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <fieldset className={styles.group}>
      <legend className="mono">{title}</legend>
      {note && <p className={styles.note}>{note}</p>}
      {children}
    </fieldset>
  );
}

function Field({ label, hint, wide, children }: { label: string; hint?: string; wide?: boolean; children: ReactNode }) {
  return (
    <label className={`${styles.field} ${wide ? styles.wide : ''}`}>
      <span className={`mono ${styles.label}`}>{label}</span>
      {children}
      {hint && <span className={styles.hint}>{hint}</span>}
    </label>
  );
}
