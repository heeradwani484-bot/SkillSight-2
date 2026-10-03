"use client";
import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  RefreshCw, AlertTriangle, X, Info, Activity,
  ChevronDown, Layers, Map as MapIcon
} from "lucide-react";

const API = "http://127.0.0.1:8000/api";

const HORIZONS = [
  { key: "current", label: "Current" },
  { key: "12m",     label: "12 Months" },
  { key: "18m",     label: "18 Months" },
  { key: "24m",     label: "24 Months" },
  { key: "36m",     label: "36 Months" },
];

const STATUS_COLOR: Record<string, { fill: string; stroke: string; label: string }> = {
  Underflow: { fill: "#ef4444", stroke: "#b91c1c", label: "Skill Shortage" },
  Balanced:  { fill: "#eab308", stroke: "#a16207", label: "Balanced"       },
  Overflow:  { fill: "#10b981", stroke: "#047857", label: "Surplus Supply" },
};

interface Zone {
  id: string; district: string; state: string;
  lat: number; lng: number; sector: string; skill: string;
  nco_code: string; cluster_name: string;
  demand: number; supply: number; gap: number;
  gap_percentage: number; training_capacity: number;
  status: "Underflow" | "Balanced" | "Overflow";
  severity: string; growth_rate: number;
  warning: string; recommendation: string;
}

interface MapData {
  zones: Zone[]; underflow_zones: Zone[];
  overflow_zones: Zone[]; balanced_zones: Zone[];
  potential_flows: { source: string; target: string; potential_match: number; distance_km: number; vector_code: string }[];
}

interface Props { selectedSkill: string; selectedState: string; allSkills: string[]; }

// ── Hex-grid geometry ────────────────────────────────────────────────────────
const INDIA_BOUNDS = { minLat: 6.5, maxLat: 37.5, minLng: 68.0, maxLng: 97.5 };
const HEX_SIZE_DEG = 1.8; // ~200 km per cell

function hexCornersLatLng(cLat: number, cLng: number, sz: number): [number, number][] {
  return Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 180) * (60 * i);
    return [cLat + sz * Math.sin(a), cLng + sz * Math.cos(a)] as [number, number];
  });
}

function generateHexGrid(sz: number) {
  const w = sz * 2; const h = sz * Math.sqrt(3);
  const cells: { lat: number; lng: number }[] = [];
  let col = 0;
  for (let cLng = INDIA_BOUNDS.minLng - sz; cLng <= INDIA_BOUNDS.maxLng + sz; cLng += w * 0.75, col++) {
    const off = col % 2 === 0 ? 0 : h / 2;
    for (let cLat = INDIA_BOUNDS.minLat - sz + off; cLat <= INDIA_BOUNDS.maxLat + sz; cLat += h) {
      cells.push({ lat: cLat, lng: cLng });
    }
  }
  return cells;
}

function closestZone(lat: number, lng: number, zones: Zone[], thr: number) {
  return zones.reduce<{ z: Zone | null; d: number }>(
    (best, z) => {
      const d = Math.hypot(z.lat - lat, z.lng - lng);
      return d < best.d ? { z, d } : best;
    },
    { z: null, d: thr }
  ).z;
}

// ── Component ────────────────────────────────────────────────────────────────
export default function IndiaHexMap({ selectedSkill, selectedState, allSkills }: Props) {
  const mapElRef  = useRef<HTMLDivElement>(null);
  const mapRef    = useRef<any>(null);
  const layerRef  = useRef<any>(null);
  const tileRef   = useRef<any>(null);

  const [skill, setSkill]               = useState(selectedSkill || "EV Battery Management Specialist");
  const [state, setState]               = useState(selectedState || "");
  const [horizon, setHorizon]           = useState("current");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [showLayer, setShowLayer]       = useState(true);
  const [mapStyle, setMapStyle]         = useState<"satellite" | "standard" | "dark">("satellite");
  const [mapData, setMapData]           = useState<MapData | null>(null);
  const [metadata, setMetadata]         = useState<any>(null);
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState("");
  const [selectedZone, setSelectedZone] = useState<Zone | null>(null);
  const [mapReady, setMapReady]         = useState(false);
  const TILES: Record<string, { url: string; attr: string; labelsUrl?: string }> = {
    satellite: {
      url:  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      attr: "Tiles &copy; Esri",
      labelsUrl: "https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
    },
    standard: {
      url:  "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
      attr: "&copy; OpenStreetMap contributors",
    },
    dark: {
      url:  "https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png",
      attr: "&copy; Stadia Maps",
    },
  };

  // init Leaflet once
  useEffect(() => {
    if (!mapElRef.current || mapRef.current) return;
    import("leaflet").then(L => {
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      const map = L.map(mapElRef.current!, {
        center: [22.5, 82.5], zoom: 5, minZoom: 4, maxZoom: 10, zoomControl: false,
      });
      L.control.zoom({ position: "bottomright" }).addTo(map);
      const tile = L.tileLayer(TILES.satellite.url, { attribution: TILES.satellite.attr, maxZoom: 19 });
      tile.addTo(map);
      const labels = L.tileLayer(TILES.satellite.labelsUrl!, { maxZoom: 19 });
      labels.addTo(map);
      tileRef.current = { base: tile, labels };
      mapRef.current  = map;
      setMapReady(true);
    });
    return () => { if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; } };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // switch tile layer
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    import("leaflet").then(L => {
      if (tileRef.current?.base) mapRef.current.removeLayer(tileRef.current.base);
      if (tileRef.current?.labels) mapRef.current.removeLayer(tileRef.current.labels);
      
      const t = L.tileLayer(TILES[mapStyle].url, { attribution: TILES[mapStyle].attr, maxZoom: 19 });
      t.addTo(mapRef.current);
      
      let l: any = null;
      if (TILES[mapStyle].labelsUrl) {
        l = L.tileLayer(TILES[mapStyle].labelsUrl!, { maxZoom: 19 });
        l.addTo(mapRef.current);
      }
      
      tileRef.current = { base: t, labels: l };
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapStyle, mapReady]);

  // fetch data — when skill=="all" pass empty string so backend returns everything
  const fetchMap = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const apiSkill = skill === "__ALL__" ? "all" : skill;
      const p = new URLSearchParams({ skill: apiSkill, horizon });
      if (state) p.append("state", state);
      const res = await fetch(`${API}/workforce-map?${p}`);
      if (!res.ok) throw new Error("api error");
      const j = await res.json();
      setMapData(j.data); setMetadata(j.metadata);
    } catch {
      setError("Could not load data. Ensure the FastAPI backend is running on port 8000.");
      setMapData(null);
    }
    setLoading(false);
  }, [skill, state, horizon]);

  useEffect(() => { fetchMap(); }, [fetchMap]);
  useEffect(() => { if (selectedSkill) setSkill(selectedSkill); }, [selectedSkill]);
  useEffect(() => { if (selectedState !== undefined) setState(selectedState); }, [selectedState]);

  // draw hex layer
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    import("leaflet").then(L => {
      if (layerRef.current) { mapRef.current.removeLayer(layerRef.current); layerRef.current = null; }
      if (!showLayer || !mapData) return;

      const isAllSkills = skill === "__ALL__";
      const zones = mapData.zones.filter(z =>
        statusFilter === "ALL"       ? true :
        statusFilter === "UNDERFLOW" ? z.status === "Underflow" :
        statusFilter === "OVERFLOW"  ? z.status === "Overflow"  :
                                       z.status === "Balanced"
      );

      const group = L.layerGroup();
      const hexCells = generateHexGrid(HEX_SIZE_DEG);

      // ── Ghost grid: draw all cells as faint outlines ──
      hexCells.forEach(cell => {
        const corners = hexCornersLatLng(cell.lat, cell.lng, HEX_SIZE_DEG * 0.91);
        L.polygon(corners as any, {
          color: "#334155", weight: 0.6, opacity: 0.35,
          fillColor: "#0f172a", fillOpacity: 0.04,
          interactive: false,
        }).addTo(group);
      });

      // ── Coloured zone hexes ──
      // When All-Skills mode: aggregate multiple zones per hex cell by worst status
      hexCells.forEach(cell => {
        const THRESHOLD = HEX_SIZE_DEG * 1.5;
        let zone: Zone | null = null;

        if (isAllSkills) {
          // Find all zones within threshold, pick worst (Underflow > Overflow > Balanced)
          const nearby = zones.filter(z => Math.hypot(z.lat - cell.lat, z.lng - cell.lng) < THRESHOLD);
          if (!nearby.length) return;
          const order = { Underflow: 0, Overflow: 1, Balanced: 2 };
          zone = nearby.reduce((a, b) => order[a.status] <= order[b.status] ? a : b);
        } else {
          zone = closestZone(cell.lat, cell.lng, zones, THRESHOLD);
          if (!zone) return;
        }

        const cfg     = STATUS_COLOR[zone.status];
        const corners = hexCornersLatLng(cell.lat, cell.lng, HEX_SIZE_DEG * 0.89);
        const gap     = zone.status === "Underflow" ? `−${zone.gap}` : zone.status === "Overflow" ? `+${Math.abs(zone.gap)}` : "≈0 (Balanced)";
        const skillLine = isAllSkills ? `<div style="color:#94a3b8;font-size:9px;margin-top:2px;">${zone.skill}</div>` : "";

        const poly = L.polygon(corners as any, {
          color: cfg.stroke, weight: 1.5, opacity: 0.9,
          fillColor: cfg.fill, fillOpacity: 0.44,
        });

        poly.bindTooltip(
          `<div style="font-size:11px;font-weight:700;line-height:1.5;color:#fff;background:rgba(2,6,23,0.96);border-radius:8px;padding:8px 12px;border:1.5px solid ${cfg.stroke};min-width:160px">
            <div style="color:${cfg.fill};font-size:13px;font-weight:900;">${zone.district}</div>
            <div style="color:#94a3b8;font-size:10px;">${zone.state}</div>
            ${skillLine}
            <div style="margin-top:5px;display:grid;grid-template-columns:1fr 1fr;gap:4px;">
              <div><span style="color:#64748b;font-size:9px;">DEMAND</span><br><strong>${zone.demand.toLocaleString()}</strong></div>
              <div><span style="color:#64748b;font-size:9px;">SUPPLY</span><br><strong>${zone.supply.toLocaleString()}</strong></div>
            </div>
            <div style="margin-top:5px;color:${cfg.fill};font-weight:900;">${gap} &nbsp;|&nbsp; ${cfg.label}</div>
          </div>`,
          { sticky: true, direction: "top", opacity: 1 }
        );
        poly.on("click", () => setSelectedZone(zone!));
        poly.on("mouseover", () => poly.setStyle({ weight: 3, opacity: 1, fillOpacity: 0.68 }));
        poly.on("mouseout",  () => poly.setStyle({ weight: 1.5, opacity: 0.9, fillOpacity: 0.44 }));
        group.addLayer(poly);
      });

      group.addTo(mapRef.current);
      layerRef.current = group;
    });
  }, [mapData, showLayer, statusFilter, mapReady, skill]);

  // stats
  const zones = mapData?.zones || [];
  const uf = mapData?.underflow_zones.length || 0;
  const of = mapData?.overflow_zones.length  || 0;
  const bl = mapData?.balanced_zones.length  || 0;
  const deficit = mapData?.underflow_zones.reduce((a, z) => a + z.gap, 0) || 0;
  const surplus = mapData?.overflow_zones.reduce( (a, z) => a + Math.abs(z.gap), 0) || 0;

  return (
    <div className="flex flex-col bg-slate-900 rounded-xl overflow-hidden border border-slate-800 shadow-2xl" style={{ height: "calc(100vh - 180px)", minHeight: 600 }}>

      {/* HEADER */}
      <div className="flex-none bg-slate-950 border-b border-slate-800 px-4 py-2.5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <span className="bg-indigo-600 text-white text-[10px] font-black px-2 py-0.5 rounded tracking-widest uppercase">Zone Intelligence</span>
          <h2 className="text-sm font-black text-white flex items-center gap-1.5">
            <MapIcon size={14} className="text-indigo-400" /> India Skill Zone Map
          </h2>
          {metadata && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse inline-block" />
              {metadata.status} · {metadata.source}
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Skill selector — includes All Skills option */}
          <div className="relative">
            <select value={skill} onChange={e => setSkill(e.target.value)}
              className="appearance-none bg-slate-800 border border-slate-700 text-white rounded-lg pl-3 pr-7 py-1 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500">
              <option value="__ALL__">🗺 All Skills (Combined)</option>
              {allSkills.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <ChevronDown size={12} className="absolute right-2 top-2 text-slate-400 pointer-events-none" />
          </div>

          {/* Horizon */}
          <div className="flex rounded-lg border border-slate-700 bg-slate-800 p-0.5">
            {HORIZONS.map(h => (
              <button key={h.key} onClick={() => setHorizon(h.key)}
                className={`px-2 py-0.5 text-[11px] font-bold rounded transition-colors ${horizon === h.key ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-white"}`}>
                {h.label}
              </button>
            ))}
          </div>

          {/* Map style */}
          <div className="flex rounded-lg border border-slate-700 bg-slate-800 p-0.5">
            {(["satellite","standard","dark"] as const).map(s => (
              <button key={s} onClick={() => setMapStyle(s)}
                className={`px-2 py-0.5 text-[11px] font-bold rounded capitalize transition-colors ${mapStyle === s ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-white"}`}>
                {s}
              </button>
            ))}
          </div>

          {/* Hex layer toggle */}
          <button onClick={() => setShowLayer(v => !v)}
            className={`flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-lg border transition-all ${showLayer ? "bg-indigo-600 border-indigo-500 text-white" : "bg-slate-800 border-slate-700 text-slate-400"}`}>
            <Layers size={13} /> Hex Layer
          </button>

          <button onClick={fetchMap} className="p-1.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors">
            <RefreshCw size={13} className={loading ? "animate-spin text-indigo-400" : ""} />
          </button>
        </div>
      </div>

      {/* STATS RIBBON */}
      <div className="flex-none bg-slate-950/80 border-b border-slate-800 px-4 py-1.5 grid grid-cols-2 sm:grid-cols-5 gap-2">
        {[
          { label: "Zones",      value: zones.length,      sub: "Analysed",                    color: "text-slate-200", bg: "bg-slate-800/60" },
          { label: "🔴 Shortage", value: uf,               sub: `−${deficit.toLocaleString()}`, color: "text-red-400",     bg: "bg-red-950/40" },
          { label: "🟡 Balanced", value: bl,               sub: "Equilibrium",                 color: "text-amber-400",   bg: "bg-amber-950/40" },
          { label: "🟢 Surplus",  value: of,               sub: `+${surplus.toLocaleString()}`, color: "text-emerald-400", bg: "bg-emerald-950/40" },
          { label: "Vectors",    value: mapData?.potential_flows.length || 0, sub: "Mobility paths", color: "text-indigo-400", bg: "bg-indigo-950/40" },
        ].map(s => (
          <div key={s.label} className={`${s.bg} rounded-lg px-2 py-1 border border-slate-800 flex flex-col`}>
            <p className="text-[9px] font-extrabold text-slate-500 uppercase tracking-wider">{s.label}</p>
            <p className={`text-base font-black leading-tight ${s.color}`}>{s.value}</p>
            <p className="text-[9px] text-slate-600">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* MAP + SIDE PANEL */}
      <div className="flex-1 flex overflow-hidden">

        {/* Leaflet */}
        <div className="flex-1 relative">
          <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
          <div ref={mapElRef} className="w-full h-full" style={{ zIndex: 1 }} />

          {/* Loading */}
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center z-20 bg-slate-900/60 backdrop-blur-sm">
              <div className="flex flex-col items-center gap-3">
                <RefreshCw size={32} className="animate-spin text-indigo-400" />
                <p className="text-sm font-bold text-white">Loading zone data…</p>
              </div>
            </div>
          )}

          {/* Error */}
          {error && !loading && (
            <div className="absolute inset-0 flex items-center justify-center z-20 bg-slate-900/80">
              <div className="bg-rose-950 border border-rose-700 rounded-xl p-6 max-w-sm text-center">
                <AlertTriangle className="mx-auto mb-2 text-rose-400" size={28} />
                <p className="font-bold text-rose-200 text-sm">{error}</p>
              </div>
            </div>
          )}

          {/* Legend */}
          <div className="absolute bottom-8 left-3 z-10 bg-slate-950/92 border border-slate-700 rounded-xl p-3 backdrop-blur-md text-xs space-y-1.5 shadow-xl">
            <p className="text-slate-400 font-black uppercase text-[9px] tracking-wider mb-1">Skill Supply Status</p>
            {Object.entries(STATUS_COLOR).map(([k, v]) => (
              <div key={k} className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-sm inline-block border" style={{ background: v.fill, borderColor: v.stroke }} />
                <span className="text-slate-200 font-semibold">{v.label}</span>
              </div>
            ))}
            <div className="flex items-center gap-2 pt-1 border-t border-slate-800 mt-1">
              <span className="w-3 h-3 rounded-sm inline-block bg-slate-800 border border-slate-600" />
              <span className="text-slate-500">No data</span>
            </div>
          </div>

          {/* Filter chips */}
          <div className="absolute top-3 left-3 z-10 flex flex-col gap-1.5">
            {[
              { key: "ALL",       label: "All Zones" },
              { key: "UNDERFLOW", label: "🔴 Shortage" },
              { key: "BALANCED",  label: "🟡 Balanced" },
              { key: "OVERFLOW",  label: "🟢 Surplus" },
            ].map(f => (
              <button key={f.key} onClick={() => setStatusFilter(f.key)}
                className={`px-2.5 py-1 text-[11px] font-bold rounded-lg border transition-all shadow-lg ${statusFilter === f.key ? "bg-indigo-600 border-indigo-500 text-white" : "bg-slate-950/85 border-slate-700 text-slate-300 hover:bg-slate-800 backdrop-blur"}`}>
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Side panel */}
        <div className={`flex-none bg-slate-950/98 border-l border-slate-800 backdrop-blur overflow-y-auto transition-all duration-300 ${selectedZone ? "w-80" : "w-60"}`}>
          {selectedZone ? (
            <div className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="text-base font-black text-white">{selectedZone.district}</h3>
                  <p className="text-xs text-slate-400">{selectedZone.state}</p>
                </div>
                <button onClick={() => setSelectedZone(null)} className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"><X size={16} /></button>
              </div>

              <p className="text-[10px] text-slate-500 uppercase font-black tracking-wider mb-0.5">Cluster</p>
              <p className="text-xs text-slate-300 mb-3 leading-relaxed">{selectedZone.cluster_name}</p>

              <div className="space-y-4">
                {(skill === "__ALL__" ? zones.filter(z => z.district === selectedZone.district) : [selectedZone]).map((z, i) => (
                  <div key={i} className="bg-slate-900 border border-slate-800 rounded-lg p-3 shadow-md">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="text-sm font-bold text-slate-200">{z.skill}</h4>
                      <span className="text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider whitespace-nowrap ml-2"
                        style={{ background: STATUS_COLOR[z.status].fill + "30", color: STATUS_COLOR[z.status].fill, border: `1px solid ${STATUS_COLOR[z.status].stroke}` }}>
                        {STATUS_COLOR[z.status].label}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-1.5 mb-2">
                      {[
                        { l: "Demand",  v: z.demand, c: "#38bdf8" },
                        { l: "Supply",  v: z.supply, c: "#818cf8" },
                        { l: "Gap",     v: Math.abs(z.gap), c: z.status === "Underflow" ? "#ef4444" : "#10b981" },
                      ].map(x => (
                        <div key={x.l} className="bg-slate-950 border border-slate-800 rounded p-1.5 text-center">
                          <p className="text-[8px] text-slate-500 uppercase tracking-wider font-bold">{x.l}</p>
                          <p className="text-xs font-black" style={{ color: x.c }}>{x.v.toLocaleString()}</p>
                        </div>
                      ))}
                    </div>

                    {/* Bar chart */}
                    <div className="mt-2 mb-3">
                      <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden flex w-full">
                        <div className="h-full bg-sky-400" style={{ width: `${(z.demand / (z.demand + z.supply)) * 100}%` }} />
                        <div className="h-full bg-indigo-400" style={{ width: `${(z.supply / (z.demand + z.supply)) * 100}%` }} />
                      </div>
                    </div>
                    
                    {/* Stat rows */}
                    <div className="mb-3 space-y-1">
                      {[
                        { l: "NCO Code",          v: z.nco_code },
                        { l: "Training Capacity", v: z.training_capacity.toLocaleString() },
                        { l: "Severity",          v: z.severity },
                        { l: "Growth Rate",       v: `${(z.growth_rate * 100).toFixed(1)}%` },
                        { l: "Gap %",             v: `${z.gap_percentage.toFixed(1)}%` },
                        { l: "Coordinates",       v: `${z.lat.toFixed(2)}° N, ${z.lng.toFixed(2)}° E` },
                      ].map(r => (
                        <div key={r.l} className="flex justify-between items-start text-[10px] py-1 border-b border-slate-800/50 last:border-0">
                          <span className="text-slate-500">{r.l}</span>
                          <span className="text-slate-300 font-bold text-right max-w-[60%]">{r.v}</span>
                        </div>
                      ))}
                    </div>
                    
                    {z.warning && (
                      <div className="mt-2 bg-red-950/30 border border-red-900/40 rounded-lg p-2">
                        <p className="text-[9px] font-black text-red-400 uppercase tracking-wider mb-0.5">⚠ Warning</p>
                        <p className="text-[10px] text-red-300 leading-relaxed">{z.warning}</p>
                      </div>
                    )}
                    {z.recommendation && (
                      <div className="mt-2 bg-emerald-950/20 border border-emerald-900/40 rounded-lg p-2">
                        <p className="text-[9px] font-black text-emerald-400 uppercase tracking-wider mb-0.5">💡 Recommendation</p>
                        <p className="text-[10px] text-emerald-300 leading-relaxed">{z.recommendation}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="p-3">
              <h4 className="text-[9px] font-black text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Activity size={11} className="text-indigo-500" /> Zones
              </h4>
              <div className="space-y-1">
                {zones.map(z => {
                  const cfg = STATUS_COLOR[z.status];
                  return (
                    <button key={z.id} onClick={() => setSelectedZone(z)}
                      className="w-full text-left px-2.5 py-2 rounded-lg border border-slate-800 bg-slate-900/60 hover:border-slate-600 hover:bg-slate-800 transition-all flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-sm flex-none" style={{ background: cfg.fill }} />
                          <span className="text-xs font-bold text-slate-200 truncate">{z.district}</span>
                        </div>
                        <p className="text-[9px] text-slate-500 truncate">{z.state}</p>
                      </div>
                      <p className="text-xs font-black flex-none" style={{ color: cfg.fill }}>
                        {z.status === "Underflow" ? `−${z.gap}` : z.status === "Overflow" ? `+${Math.abs(z.gap)}` : "≈0"}
                      </p>
                    </button>
                  );
                })}
                {!zones.length && (
                  <div className="text-center py-8 text-slate-600">
                    <Info size={22} className="mx-auto mb-2 text-slate-700" />
                    <p className="text-xs">No data yet</p>
                  </div>
                )}
              </div>
              <div className="mt-4 p-2.5 bg-indigo-950/30 border border-indigo-900/30 rounded-lg">
                <p className="text-[9px] text-indigo-400 font-black uppercase tracking-wider mb-1">Tip</p>
                <p className="text-[11px] text-indigo-300 leading-relaxed">Click any coloured hex on the map to see zone details.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
