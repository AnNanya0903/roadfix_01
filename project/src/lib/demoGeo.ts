import type { Facility } from './domain';
import { distanceMeters } from './geo';

// Demo Data: fictional road and facility names on real map coordinates so tiles render.
export interface DemoRoad {
  name: string;
  area: string;
  from: [number, number];
  to: [number, number];
}

export const DEMO_ROADS: DemoRoad[] = [
  { name: 'Demo Northgate Main St', area: 'Northgate Ward', from: [13.004, 77.58], to: [13.011, 77.593] },
  { name: 'Demo Orchard Link Rd', area: 'Northgate Ward', from: [13.001, 77.59], to: [13.009, 77.599] },
  { name: 'Demo Lakeshore Road', area: 'Lakeside Ward', from: [12.993, 77.606], to: [13.0, 77.62] },
  { name: 'Demo Boat Club Road', area: 'Lakeside Ward', from: [12.997, 77.612], to: [12.991, 77.618] },
  { name: 'Demo Ring Road (Central)', area: 'Central Market', from: [12.97, 77.586], to: [12.979, 77.596] },
  { name: 'Demo Market Street', area: 'Central Market', from: [12.97, 77.596], to: [12.976, 77.601] },
  { name: 'Demo Tech Corridor', area: 'Tech Park Corridor', from: [12.93, 77.618], to: [12.94, 77.633] },
  { name: 'Demo Service Road 7', area: 'Tech Park Corridor', from: [12.933, 77.625], to: [12.937, 77.621] },
  { name: 'Demo Old Town Road', area: 'Old Town', from: [12.957, 77.565], to: [12.964, 77.575] },
  { name: 'Demo Temple Lane', area: 'Old Town', from: [12.96, 77.572], to: [12.955, 77.57] },
  { name: 'Demo Southfield Ave', area: 'Southfield Ward', from: [12.904, 77.587], to: [12.912, 77.598] },
  { name: 'Demo Reservoir Road', area: 'Southfield Ward', from: [12.907, 77.592], to: [12.902, 77.599] },
];

export const AREAS = Array.from(new Set(DEMO_ROADS.map((r) => r.area)));

export function pointOnRoad(road: DemoRoad, t: number, offsetLat = 0, offsetLng = 0): [number, number] {
  return [road.from[0] + (road.to[0] - road.from[0]) * t + offsetLat, road.from[1] + (road.to[1] - road.from[1]) * t + offsetLng];
}

const road = (name: string) => DEMO_ROADS.find((r) => r.name === name) as DemoRoad;

export interface DemoFacility {
  kind: Facility['kind'];
  name: string;
  at: [number, number];
}

export const DEMO_FACILITIES: DemoFacility[] = [
  { kind: 'school', name: 'Demo Public School', at: [12.97626, 77.5905] },
  { kind: 'hospital', name: 'Demo Central Hospital', at: pointOnRoad(road('Demo Market Street'), 0.4, 0.0006) },
  { kind: 'bus_stop', name: 'Demo Market Bus Stop', at: pointOnRoad(road('Demo Ring Road (Central)'), 0.9, 0.0003) },
  { kind: 'school', name: 'Demo Northgate Primary School', at: pointOnRoad(road('Demo Northgate Main St'), 0.35, 0.0005) },
  { kind: 'bus_stop', name: 'Demo Northgate Bus Stop', at: pointOnRoad(road('Demo Northgate Main St'), 0.8, -0.0003) },
  { kind: 'hospital', name: 'Demo Lakeside Hospital', at: pointOnRoad(road('Demo Lakeshore Road'), 0.5, 0.0005) },
  { kind: 'bus_stop', name: 'Demo Lakeside Bus Stop', at: pointOnRoad(road('Demo Boat Club Road'), 0.5, 0.0002) },
  { kind: 'bus_stop', name: 'Demo Tech Park Bus Stop', at: pointOnRoad(road('Demo Tech Corridor'), 0.3, 0.0003) },
  { kind: 'junction', name: 'Demo Tech Junction', at: pointOnRoad(road('Demo Tech Corridor'), 0.7) },
  { kind: 'school', name: 'Demo Old Town School', at: pointOnRoad(road('Demo Old Town Road'), 0.55, 0.0006) },
  { kind: 'railway_station', name: 'Demo Old Town Railway Station', at: pointOnRoad(road('Demo Old Town Road'), 0.1, 0.0003) },
  { kind: 'bus_stop', name: 'Demo Southfield Bus Stop', at: pointOnRoad(road('Demo Southfield Ave'), 0.5, 0.0003) },
  { kind: 'hospital', name: 'Demo Southfield Clinic', at: pointOnRoad(road('Demo Reservoir Road'), 0.6, 0.0004) },
];

export function demoFacilitiesNear(lat: number, lng: number, radiusM = 300): Facility[] {
  return DEMO_FACILITIES.map((f) => ({ kind: f.kind, name: f.name, distanceM: distanceMeters(lat, lng, f.at[0], f.at[1]), source: 'demo' as const }))
    .filter((f) => f.distanceM <= radiusM)
    .sort((a, b) => a.distanceM - b.distanceM);
}

export function nearestDemoRoad(lat: number, lng: number): { road: string; area: string } | null {
  let best: { road: string; area: string; d: number } | null = null;
  for (const r of DEMO_ROADS) {
    for (let t = 0; t <= 1; t += 0.1) {
      const [pl, pg] = pointOnRoad(r, t);
      const d = distanceMeters(lat, lng, pl, pg);
      if (!best || d < best.d) best = { road: r.name, area: r.area, d };
    }
  }
  return best && best.d < 900 ? { road: best.road, area: best.area } : null;
}
