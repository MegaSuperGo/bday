import { useEffect, useState } from 'react';

const fmt = new Intl.DateTimeFormat('de-CH', {
  timeZone: 'Europe/Zurich',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

export function useZurichClock(): string {
  const [now, setNow] = useState(() => fmt.format(new Date()));
  useEffect(() => {
    const id = window.setInterval(() => setNow(fmt.format(new Date())), 1000);
    return () => window.clearInterval(id);
  }, []);
  return now;
}
