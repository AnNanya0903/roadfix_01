import { LocateFixed, Search } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { getCurrentPosition, LocationError, searchPlace } from '@/lib/geo';
import { InlineNotice } from './States';

interface Props {
  value: { latitude: number; longitude: number } | null;
  onChange: (p: { latitude: number; longitude: number }) => void;
  center?: [number, number];
  nearby?: Array<{ latitude: number; longitude: number }>;
}

export default function LocationPicker({ value, onChange, center = [12.9716, 77.5946], nearby }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const pin = useRef<L.Marker | null>(null);
  const cb = useRef(onChange);
  cb.current = onChange;
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState<'gps' | 'search' | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!el.current || map.current) return;
    const m = L.map(el.current, { center, zoom: 14 });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap contributors', maxZoom: 19 }).addTo(m);
    m.on('click', (e: L.LeafletMouseEvent) => cb.current({ latitude: e.latlng.lat, longitude: e.latlng.lng }));
    map.current = m;
    return () => {
      m.stop();
      m.remove();
      map.current = null;
      pin.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const m = map.current;
    if (!m || !value) return;
    const icon = L.divIcon({ className: '', html: '<div class="rf-marker" style="width:22px;height:22px;background:#F5B700;border-color:#1C2732"></div>', iconSize: [22, 22], iconAnchor: [11, 11] });
    if (!pin.current) {
      pin.current = L.marker([value.latitude, value.longitude], { icon, draggable: true, keyboard: true, title: 'Issue location. Drag to adjust.' }).addTo(m);
      pin.current.on('dragend', () => {
        const p = pin.current!.getLatLng();
        cb.current({ latitude: p.lat, longitude: p.lng });
      });
    } else {
      pin.current.setLatLng([value.latitude, value.longitude]);
    }
    m.setView([value.latitude, value.longitude], Math.max(m.getZoom(), 16), { animate: false });
  }, [value]);

  useEffect(() => {
    const m = map.current;
    if (!m || !nearby?.length) return;
    const g = L.layerGroup().addTo(m);
    nearby.forEach((n) => L.circleMarker([n.latitude, n.longitude], { radius: 6, color: '#fff', weight: 2, fillColor: '#C8392F', fillOpacity: 0.9 }).addTo(g));
    return () => {
      g.remove();
    };
  }, [nearby]);

  const useGps = async () => {
    setBusy('gps');
    setError(null);
    try {
      const p = await getCurrentPosition();
      onChange({ latitude: p.latitude, longitude: p.longitude });
    } catch (e) {
      setError(e instanceof LocationError ? e.message : 'Could not get your location.');
    } finally {
      setBusy(null);
    }
  };

  const search = async () => {
    if (!q.trim()) return;
    setBusy('search');
    setError(null);
    try {
      const hits = await searchPlace(q.trim());
      if (!hits.length) setError('No places matched that search. Try a nearby landmark or tap the map.');
      else onChange({ latitude: hits[0].latitude, longitude: hits[0].longitude });
    } catch (e) {
      setError(e instanceof Error ? `${e.message} You can still tap the map.` : 'Search failed. Tap the map instead.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={useGps} disabled={busy !== null} className="btn-dark btn-sm">
          <LocateFixed className="h-4 w-4" aria-hidden /> {busy === 'gps' ? 'Finding you…' : 'Use current location'}
        </button>
        <form className="flex min-w-[14rem] flex-1 gap-2" onSubmit={(e) => { e.preventDefault(); void search(); }} role="search">
          <label htmlFor="place-search" className="sr-only">Search for a place</label>
          <input id="place-search" className="field" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search a road, landmark or area" />
          <button type="submit" disabled={busy !== null} className="btn-outline btn-sm"><Search className="h-4 w-4" aria-hidden /> Search</button>
        </form>
      </div>
      {error && <InlineNotice tone="warn">{error}</InlineNotice>}
      <div ref={el} className="h-72 w-full overflow-hidden rounded-lg border border-concrete-300 bg-concrete-200 sm:h-80" role="application" aria-label="Map. Tap to place the issue pin." />
      <p className="hint">{value ? `Pin at ${value.latitude.toFixed(5)}, ${value.longitude.toFixed(5)}. Drag the pin to fine-tune.` : 'Tap the map to drop a pin, search, or use your current location.'}</p>
    </div>
  );
}
