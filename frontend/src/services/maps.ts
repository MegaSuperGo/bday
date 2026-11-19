import type { Place } from '../../../shared/types';

export function placeQuery(p: Place): string {
  return [p.name, p.address, p.city].filter(Boolean).join(', ');
}

export function googleMapsUrl(p: Place): string {
  const q = p.lat !== null && p.lng !== null ? `${p.lat},${p.lng}` : placeQuery(p);
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

export function appleMapsUrl(p: Place): string {
  const params = new URLSearchParams({ q: placeQuery(p) });
  if (p.lat !== null && p.lng !== null) params.set('ll', `${p.lat},${p.lng}`);
  return `https://maps.apple.com/?${params.toString()}`;
}

export function formatCoord(lat: number, lng: number): string {
  const f = (v: number, pos: string, neg: string) => `${Math.abs(v).toFixed(5)}° ${v >= 0 ? pos : neg}`;
  return `${f(lat, 'N', 'S')}  ${f(lng, 'E', 'W')}`;
}
