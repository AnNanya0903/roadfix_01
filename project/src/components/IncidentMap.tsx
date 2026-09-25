import { useEffect, useRef } from 'react';
import L from 'leaflet';
import { MARKER_COLOR, MARKER_LABEL, type EnrichedIssue } from '@/lib/enrich';

interface Props {
  issues: EnrichedIssue[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  center?: [number, number];
  zoom?: number;
  height?: string;
  fitToIssues?: boolean;
  extra?: Array<{ lat: number; lng: number; label: string }>;
}

export default function IncidentMap({ issues, selectedId, onSelect, center = [12.9716, 77.5946], zoom = 12, height = '100%', fitToIssues = true, extra }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  useEffect(() => {
    if (!el.current || map.current) return;
    const m = L.map(el.current, { center, zoom, preferCanvas: true, zoomControl: true });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap contributors', maxZoom: 19 }).addTo(m);
    layer.current = L.layerGroup().addTo(m);
    map.current = m;
    return () => {
      m.stop();
      m.remove();
      map.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const m = map.current;
    const g = layer.current;
    if (!m || !g) return;
    g.clearLayers();
    const pts: L.LatLngExpression[] = [];
    issues.forEach((i) => {
      const selected = i.id === selectedId;
      const marker = L.circleMarker([i.latitude, i.longitude], {
        radius: selected ? 11 : i.marker === 'high' ? 8 : 6.5,
        color: selected ? '#1C2732' : '#ffffff',
        weight: selected ? 3 : 2,
        fillColor: MARKER_COLOR[i.marker],
        fillOpacity: 0.95,
      });
      marker.bindTooltip(`${i.id} · ${MARKER_LABEL[i.marker]}`, { direction: 'top' });
      marker.on('click', () => onSelectRef.current?.(i.id));
      marker.addTo(g);
      if (i.marker === 'unverified') L.circleMarker([i.latitude, i.longitude], { radius: 6.5, color: '#5B6771', weight: 1.5, fill: false }).addTo(g);
      pts.push([i.latitude, i.longitude]);
    });
    extra?.forEach((e) => L.circleMarker([e.lat, e.lng], { radius: 9, color: '#2563A8', weight: 3, fillColor: '#fff', fillOpacity: 1 }).bindTooltip(e.label).addTo(g));
    if (fitToIssues && pts.length && !selectedId) m.fitBounds(L.latLngBounds(pts), { padding: [30, 30], maxZoom: 15, animate: false });
  }, [issues, selectedId, fitToIssues, extra]);

  useEffect(() => {
    const m = map.current;
    const sel = issues.find((i) => i.id === selectedId);
    if (m && sel) m.panTo([sel.latitude, sel.longitude], { animate: false });
  }, [selectedId, issues]);

  return <div ref={el} style={{ height }} className="w-full bg-concrete-200" role="application" aria-label="Interactive road safety map" />;
}
