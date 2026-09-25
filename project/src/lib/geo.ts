export function distanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const rad = (v: number) => (v * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLon = rad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function formatDistance(m: number): string {
  if (m < 1000) return `${Math.round(m / 10) * 10 || Math.round(m)} m`;
  return `${(m / 1000).toFixed(1)} km`;
}

export class LocationError extends Error {
  constructor(public reason: 'denied' | 'unavailable' | 'timeout' | 'unsupported', message: string) {
    super(message);
  }
}

export function getCurrentPosition(): Promise<{ latitude: number; longitude: number; accuracy: number }> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new LocationError('unsupported', 'This browser does not support location access.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude, accuracy: pos.coords.accuracy }),
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          reject(new LocationError('denied', 'Location permission was denied. Search for the place or tap the map instead.'));
        } else if (err.code === err.TIMEOUT) {
          reject(new LocationError('timeout', 'Finding your location took too long. Try again, or pick the spot on the map.'));
        } else {
          reject(new LocationError('unavailable', 'Your location is not available right now. Pick the spot on the map instead.'));
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
    );
  });
}

export interface GeocodeHit {
  latitude: number;
  longitude: number;
  label: string;
}

export async function searchPlace(query: string): Promise<GeocodeHit[]> {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent(query)}`,
    { headers: { Accept: 'application/json' } }
  );
  if (!res.ok) throw new Error('Place search is unavailable right now.');
  const data = (await res.json()) as Array<{ lat: string; lon: string; display_name: string }>;
  return data.map((d) => ({ latitude: parseFloat(d.lat), longitude: parseFloat(d.lon), label: d.display_name }));
}

export interface ReverseHit {
  address: string;
  roadName: string;
  area: string;
}

export async function reverseGeocode(latitude: number, longitude: number): Promise<ReverseHit> {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`,
    { headers: { Accept: 'application/json' } }
  );
  if (!res.ok) throw new Error('Address lookup failed.');
  const d = await res.json();
  const a = d.address ?? {};
  const road = a.road || a.pedestrian || '';
  const area = a.suburb || a.neighbourhood || a.city_district || a.village || a.town || a.city || '';
  const city = a.city || a.town || a.village || a.municipality || '';
  const address = [road, area, city, a.state].filter(Boolean).join(', ') || d.display_name || '';
  return { address, roadName: road || area || 'Unnamed road', area: area || city || 'Unknown area' };
}
