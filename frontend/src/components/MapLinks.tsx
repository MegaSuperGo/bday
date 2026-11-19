import { MapPin, Navigation } from 'lucide-react';
import type { Place } from '../../../shared/types';
import { appleMapsUrl, googleMapsUrl } from '../services/maps';

export function MapLinks({ place }: { place: Place }) {
  return (
    <div className="map-links" style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
      <a className="btn btn--primary" href={googleMapsUrl(place)} target="_blank" rel="noreferrer">
        <Navigation /> Google Maps
      </a>
      <a className="btn" href={appleMapsUrl(place)} target="_blank" rel="noreferrer">
        <MapPin /> Apple Karten
      </a>
    </div>
  );
}
