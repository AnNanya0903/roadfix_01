import type { Facility } from './domain';
import { distanceMeters } from './geo';
import { demoFacilitiesNear } from './demoGeo';
import { MODE } from './mode';

/**
 * Nearby sensitive locations. Demo mode uses the fictional demo facilities. Live mode asks
 * OpenStreetMap (Overpass). Returns null when no reliable answer is available so callers can
 * say "Nearby facility information unavailable" rather than inventing places.
 */
export async function findNearbyFacilities(lat: number, lng: number): Promise<Facility[] | null> {
  if (MODE === 'demo') return demoFacilitiesNear(lat, lng);
  try {
    const q = `[out:json][timeout:10];(nwr(around:250,${lat},${lng})[amenity~"^(school|hospital|clinic)$"];nwr(around:200,${lat},${lng})[highway=bus_stop];nwr(around:400,${lat},${lng})[railway=station];);out center 25;`;
    const res = await fetch('https://overpass-api.de/api/interpreter', { method: 'POST', body: `data=${encodeURIComponent(q)}` });
    if (!res.ok) return null;
    const data = (await res.json()) as { elements: Array<{ lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> }> };
    const out: Facility[] = [];
    for (const el of data.elements) {
      const elat = el.lat ?? el.center?.lat;
      const elon = el.lon ?? el.center?.lon;
      if (elat === undefined || elon === undefined) continue;
      const tags = el.tags ?? {};
      const kind: Facility['kind'] | null =
        tags.amenity === 'school' ? 'school' : tags.amenity === 'hospital' || tags.amenity === 'clinic' ? 'hospital' : tags.highway === 'bus_stop' ? 'bus_stop' : tags.railway === 'station' ? 'railway_station' : null;
      if (!kind) continue;
      out.push({ kind, name: tags.name || kind.replace(/_/g, ' '), distanceM: distanceMeters(lat, lng, elat, elon), source: 'openstreetmap' });
    }
    return out.sort((a, b) => a.distanceM - b.distanceM);
  } catch {
    return null;
  }
}
