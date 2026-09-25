import { nearestDemoRoad } from './demoGeo';
import { reverseGeocode } from './geo';
import { MODE } from './mode';

export interface PlaceInfo {
  address: string;
  roadName: string;
  area: string;
  source: 'demo' | 'openstreetmap' | 'coordinates';
}

/** Best-effort place name for a pin. Never throws: falls back to coordinates. */
export async function describePlace(lat: number, lng: number): Promise<PlaceInfo> {
  if (MODE === 'demo') {
    const hit = nearestDemoRoad(lat, lng);
    if (hit) return { address: `${hit.road}, ${hit.area}`, roadName: hit.road, area: hit.area, source: 'demo' };
  }
  try {
    const r = await reverseGeocode(lat, lng);
    return { ...r, source: 'openstreetmap' };
  } catch {
    return { address: `Pinned location (${lat.toFixed(4)}, ${lng.toFixed(4)})`, roadName: 'Unnamed road', area: 'Unknown area', source: 'coordinates' };
  }
}
