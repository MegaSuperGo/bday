import { Minus, Plus } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { formatCoord } from '../services/maps';
import styles from './MapView.module.css';

interface Props {
  lat: number;
  lng: number;
  label: string;
  sublabel?: string;
}

const TILE = 256;
const MIN_Z = 12;
const MAX_Z = 18;

function project(lat: number, lng: number, z: number) {
  const scale = TILE * 2 ** z;
  const s = Math.sin((lat * Math.PI) / 180);
  return {
    x: ((lng + 180) / 360) * scale,
    y: (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * scale,
  };
}

/**
 * Lightweight slippy map using the official swisstopo national map (grey
 * edition, Swiss open government data, no API key), inverted and tinted to
 * the NEXUS palette and centred on the exact coordinates. No map library.
 */
export function MapView({ lat, lng, label, sublabel }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [zoom, setZoom] = useState(16);
  // swisstopo serves 3857 tiles up to zoom 18
  const [failed, setFailed] = useState(0);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const tiles = useMemo(() => {
    if (!size.w || !size.h) return [];
    const c = project(lat, lng, zoom);
    const left = c.x - size.w / 2;
    const top = c.y - size.h / 2;
    const out: { key: string; src: string; x: number; y: number }[] = [];
    const max = 2 ** zoom;
    for (let tx = Math.floor(left / TILE); tx <= Math.floor((left + size.w) / TILE); tx++) {
      for (let ty = Math.floor(top / TILE); ty <= Math.floor((top + size.h) / TILE); ty++) {
        if (ty < 0 || ty >= max) continue;
        out.push({
          key: `${zoom}/${tx}/${ty}`,
          src: `https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.pixelkarte-grau/default/current/3857/${zoom}/${((tx % max) + max) % max}/${ty}.jpeg`,
          x: tx * TILE - left,
          y: ty * TILE - top,
        });
      }
    }
    return out;
  }, [lat, lng, zoom, size]);

  const offline = tiles.length > 0 && failed >= tiles.length;

  return (
    <figure className={styles.map}>
      <div ref={box} className={styles.viewport} role="img" aria-label={`Karte: ${label}, ${formatCoord(lat, lng)}`}>
        <div className={styles.tiles}>
          {tiles.map((t) => (
            <img
              key={t.key}
              src={t.src}
              alt=""
              width={TILE}
              height={TILE}
              loading="lazy"
              decoding="async"
              draggable={false}
              style={{ transform: `translate(${t.x}px, ${t.y}px)` }}
              onError={() => setFailed((f) => f + 1)}
            />
          ))}
        </div>
        {offline && <p className={`mono ${styles.offline}`}>Kartendaten nicht verfügbar</p>}
        <div className={styles.grid} aria-hidden />
        <div className={styles.marker} aria-hidden>
          <span className={styles.ring} />
          <span className={styles.ring} />
          <span className={styles.dot} />
        </div>
        <div className={styles.tag} aria-hidden>
          <span className="mono">{label}</span>
          {sublabel && <span className={`mono ${styles.sub}`}>{sublabel}</span>}
        </div>
        <div className={styles.zoom}>
          <button type="button" aria-label="Hineinzoomen" onClick={() => setZoom((z) => Math.min(MAX_Z, z + 1))} disabled={zoom >= MAX_Z}>
            <Plus />
          </button>
          <button type="button" aria-label="Herauszoomen" onClick={() => setZoom((z) => Math.max(MIN_Z, z - 1))} disabled={zoom <= MIN_Z}>
            <Minus />
          </button>
        </div>
      </div>
      <figcaption className={styles.caption}>
        <span className="mono">{formatCoord(lat, lng)}</span>
        <span className={styles.attrib}>
          Karte ©{' '}
          <a href="https://www.swisstopo.admin.ch" target="_blank" rel="noreferrer">
            swisstopo
          </a>
        </span>
      </figcaption>
    </figure>
  );
}
