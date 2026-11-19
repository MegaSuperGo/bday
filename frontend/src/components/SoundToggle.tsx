import { Volume2, VolumeX } from 'lucide-react';
import { useEffect, useState } from 'react';
import { sound } from '../services/sound';

export function SoundToggle({ className }: { className?: string }) {
  const [on, setOn] = useState(sound.enabled);
  useEffect(() => {
    const off = sound.subscribe(setOn);
    return () => {
      off();
    };
  }, []);
  return (
    <button
      type="button"
      className={className}
      aria-pressed={on}
      aria-label={on ? 'Interface-Sounds ausschalten' : 'Interface-Sounds einschalten'}
      title={on ? 'Ton aus' : 'Ton an'}
      onClick={() => void sound.setEnabled(!on)}
    >
      {on ? <Volume2 /> : <VolumeX />}
      <span className="mono">{on ? 'TON AN' : 'TON AUS'}</span>
    </button>
  );
}
