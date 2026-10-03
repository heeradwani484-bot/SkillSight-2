"use client";
import React, { useState, useEffect, useCallback } from "react";
import {
  ArrowRight, AlertTriangle, TrendingUp, Users,
  RefreshCw, ChevronDown, MapPin, Zap, ShieldCheck,
  Layers, Compass, ArrowUpRight, Activity, Cpu, CheckCircle2,
  X, Filter, Radio, Map as MapIcon, Grid, Info
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from "recharts";

const API = "http://127.0.0.1:8000/api";

const HORIZONS = [
  { key: "current", label: "Current" },
  { key: "12m", label: "12 Months" },
  { key: "18m", label: "18 Months" },
  { key: "24m", label: "24 Months" },
  { key: "36m", label: "36 Months" },
];

// Color configuration requested by user: RED = Shortage, YELLOW = Balanced, GREEN = Surplus Supply
const STATUS_CONFIG: Record<string, { bg: string; border: string; text: string; badgeBg: string; dot: string; hex: string; label: string }> = {
  Underflow: {
    bg: "bg-red-50/80",
    border: "border-red-200 hover:border-red-400",
    text: "text-red-700",
    badgeBg: "bg-red-100 text-red-800 border-red-200",
    dot: "bg-red-500",
    hex: "#ef4444", // RED for Skill Shortage
    label: "Underflow (Skill Shortage)",
  },
  Balanced: {
    bg: "bg-amber-50/80",
    border: "border-amber-200 hover:border-amber-400",
    text: "text-amber-800",
    badgeBg: "bg-amber-100 text-amber-900 border-amber-200",
    dot: "bg-amber-500",
    hex: "#eab308", // YELLOW for Balanced
    label: "Balanced Supply & Demand",
  },
  Overflow: {
    bg: "bg-emerald-50/80",
    border: "border-emerald-200 hover:border-emerald-400",
    text: "text-emerald-700",
    badgeBg: "bg-emerald-100 text-emerald-800 border-emerald-200",
    dot: "bg-emerald-500",
    hex: "#10b981", // GREEN for Surplus Skill Supply
    label: "Overflow (Surplus Skill Supply)",
  },
};

interface TrajectoryPoint {
  demand: number;
  supply: number;
  gap: number;
}

interface Zone {
  id: string;
  district: string;
  state: string;
  lat: number;
  lng: number;
  sector: string;
  skill: string;
  nco_code: string;
  cluster_name: string;
  demand: number;
  supply: number;
  gap: number;
  gap_percentage: number;
  training_capacity: number;
  status: "Underflow" | "Balanced" | "Overflow";
  severity: string;
  growth_rate: number;
  trajectories: Record<string, TrajectoryPoint>;
  warning: string;
  recommendation: string;
}

interface Flow {
  source: string;
  source_name: string;
  source_state: string;
  target: string;
  target_name: string;
  target_state: string;
  potential_match: number;
  distance_km: number;
  source_lat: number;
  source_lng: number;
  target_lat: number;
  target_lng: number;
  vector_code: string;
}

interface MapData {
  zones: Zone[];
  underflow_zones: Zone[];
  overflow_zones: Zone[];
  balanced_zones: Zone[];
  potential_flows: Flow[];
}

interface Props {
  selectedSkill: string;
  selectedState: string;
  allSkills: string[];
}

// Projection helper to convert Lat/Lng -> Map SVG Coordinates
function projectToMap(lat: number, lng: number, w: number, h: number) {
  const minLat = 7.5, maxLat = 36.5;
  const minLng = 68.0, maxLng = 96.5;
  const padX = 40, padY = 40;
  const x = padX + ((lng - minLng) / (maxLng - minLng)) * (w - 2 * padX);
  const y = padY + ((maxLat - lat) / (maxLat - minLat)) * (h - 2 * padY);
  return { x, y };
}

// Helper to generate hexagon points for SVG
function hexPoints(cx: number, cy: number, r: number): string {
  const points = [];
  for (let i = 0; i < 6; i++) {
    const angle = Math.PI / 3 * i - Math.PI / 6; // rotate to flat top
    const x = cx + r * Math.cos(angle);
    const y = cy + r * Math.sin(angle);
    points.push(`${x},${y}`);
  }
  return points.join(' ');
}

export default function WorkforceFlowMap({ selectedSkill, selectedState, allSkills }: Props) {
  const [skill, setSkill] = useState(selectedSkill || "EV Battery Management Specialist");
  const [state, setState] = useState(selectedState || "");
  const [horizon, setHorizon] = useState("current");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [viewMode, setViewMode] = useState<"map" | "grid" | "vector">("map");
  const [mapData, setMapData] = useState<MapData | null>(null);
  const [metadata, setMetadata] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedZone, setSelectedZone] = useState<Zone | null>(null);
  const [hoveredZone, setHoveredZone] = useState<Zone | null>(null);
  const [hoveredFlow, setHoveredFlow] = useState<Flow | null>(null);

  const fetchMap = useCallback(async () => {
    if (!skill) return;
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ skill, horizon });
      if (state) params.append("state", state);
      const res = await fetch(`${API}/workforce-map?${params}`);
      if (!res.ok) throw new Error("Failed to load map data");
      const json = await res.json();
      setMapData(json.data);
      setMetadata(json.metadata);
      if (selectedZone) {
        const updated = json.data.zones?.find((z: Zone) => z.id === selectedZone.id);
        if (updated) setSelectedZone(updated);
      }
    } catch {
      setError("Could not load workforce flow data. Ensure FastAPI backend is running on port 8000.");
      setMapData(null);
    }
    setLoading(false);
  }, [skill, state, horizon, selectedZone]);

  useEffect(() => { fetchMap(); }, [fetchMap]);
  useEffect(() => { if (selectedSkill) setSkill(selectedSkill); }, [selectedSkill]);
  useEffect(() => { if (selectedState !== undefined) setState(selectedState); }, [selectedState]);

  const zones = mapData?.zones || [];
  const flows = mapData?.potential_flows || [];

  const filteredZones = zones.filter(z => {
    if (statusFilter === "UNDERFLOW") return z.status === "Underflow";
    if (statusFilter === "OVERFLOW") return z.status === "Overflow";
    if (statusFilter === "BALANCED") return z.status === "Balanced";
    return true;
  });

  const underflowCount = mapData?.underflow_zones.length || 0;
  const overflowCount = mapData?.overflow_zones.length || 0;
  const balancedCount = mapData?.balanced_zones.length || 0;
  const totalDeficit = mapData?.underflow_zones.reduce((acc, z) => acc + z.gap, 0) || 0;
  const totalSurplus = mapData?.overflow_zones.reduce((acc, z) => acc + Math.abs(z.gap), 0) || 0;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden space-y-0">
      {/* HEADER & CONTROLS */}
      <div className="p-5 border-b border-slate-200 bg-slate-900 text-white">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="bg-indigo-600 text-white text-[10px] font-extrabold px-2 py-0.5 rounded tracking-wider uppercase">
                Zone Intelligence
              </span>
              {metadata && (
                <span className="inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  {metadata.status} · {metadata.source} · {metadata.data_age_minutes}m ago
                </span>
              )}
            </div>
            <h2 className="text-xl font-extrabold tracking-tight text-white mt-1 flex items-center gap-2">
              <Compass className="text-indigo-400" size={22} /> Interactive Regional Skill Supply & Flow Map
            </h2>
            <p className="text-xs text-slate-300 mt-0.5">
              Color-coded regional zones displaying skill supply surplus (Green 🟢), balanced equilibrium (Yellow 🟡), and shortage deficits (Red 🔴).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Skill Selector */}
            <div className="relative">
              <select
                value={skill}
                onChange={e => setSkill(e.target.value)}
                className="appearance-none bg-slate-800 border border-slate-700 text-white rounded-lg pl-3 pr-8 py-1.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {allSkills.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <ChevronDown size={14} className="absolute right-2 top-2.5 text-slate-400 pointer-events-none" />
            </div>

            {/* Horizon Selector */}
            <div className="flex rounded-lg border border-slate-700 bg-slate-800 p-0.5">
              {HORIZONS.map(h => (
                <button
                  key={h.key}
                  onClick={() => setHorizon(h.key)}
                  className={`px-2 py-1 text-[11px] font-bold rounded transition-colors ${
                    horizon === h.key
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "text-slate-300 hover:text-white"
                  }`}
                >
                  {h.label}
                </button>
              ))}
            </div>

            {/* View Mode Buttons */}
            <div className="flex rounded-lg border border-slate-700 bg-slate-800 p-0.5">
              <button
                onClick={() => setViewMode("map")}
                className={`px-2.5 py-1 text-[11px] font-bold rounded transition-colors flex items-center gap-1 ${
                  viewMode === "map" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-white"
                }`}
              >
                <MapIcon size={13} /> Interactive Map
              </button>
              <button
                onClick={() => setViewMode("grid")}
                className={`px-2.5 py-1 text-[11px] font-bold rounded transition-colors flex items-center gap-1 ${
                  viewMode === "grid" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-white"
                }`}
              >
                <Grid size={13} /> Cards
              </button>
              <button
                onClick={() => setViewMode("vector")}
                className={`px-2.5 py-1 text-[11px] font-bold rounded transition-colors flex items-center gap-1 ${
                  viewMode === "vector" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-white"
                }`}
              >
                <Radio size={13} /> Vectors ({flows.length})
              </button>
            </div>

            <button
              onClick={fetchMap}
              className="p-1.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
              title="Refresh Ingestion Stream"
            >
              <RefreshCw size={14} className={loading ? "animate-spin text-indigo-400" : ""} />
            </button>
          </div>
        </div>
      </div>

      {/* METRICS SUMMARY RIBBON */}
      <div className="bg-slate-50 border-b border-slate-200 px-5 py-3 grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-2xs">
          <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Zones Analyzed</p>
          <p className="text-lg font-black text-slate-900 mt-0.5">{zones.length} Regional Hubs</p>
        </div>

        <div className="bg-red-50/70 p-3 rounded-lg border border-red-200 shadow-2xs">
          <p className="text-[10px] font-extrabold text-red-600 uppercase tracking-wider flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-red-500" /> Shortage (Underflow)
          </p>
          <div className="flex items-baseline justify-between mt-0.5">
            <span className="text-lg font-black text-red-700">{underflowCount}</span>
            <span className="text-xs font-bold text-red-600">−{totalDeficit.toLocaleString()} deficit</span>
          </div>
        </div>

        <div className="bg-amber-50/70 p-3 rounded-lg border border-amber-200 shadow-2xs">
          <p className="text-[10px] font-extrabold text-amber-700 uppercase tracking-wider flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-amber-500" /> Balanced Supply
          </p>
          <p className="text-lg font-black text-amber-800 mt-0.5">{balancedCount} Hubs</p>
        </div>

        <div className="bg-emerald-50/70 p-3 rounded-lg border border-emerald-200 shadow-2xs">
          <p className="text-[10px] font-extrabold text-emerald-600 uppercase tracking-wider flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500" /> Surplus (Overflow)
          </p>
          <div className="flex items-baseline justify-between mt-0.5">
            <span className="text-lg font-black text-emerald-700">{overflowCount}</span>
            <span className="text-xs font-bold text-emerald-600">+{totalSurplus.toLocaleString()} surplus</span>
          </div>
        </div>

        <div className="bg-indigo-50/70 p-3 rounded-lg border border-indigo-200 shadow-2xs col-span-2 sm:col-span-1">
          <p className="text-[10px] font-extrabold text-indigo-600 uppercase tracking-wider">Mobility Vectors</p>
          <p className="text-lg font-black text-indigo-800 mt-0.5">{flows.length} Active Routes</p>
        </div>
      </div>

      {/* COLOR-CODED LEGEND & FILTER BAR */}
      <div className="px-5 py-2.5 bg-white border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-4 text-xs font-bold">
          <span className="text-slate-400 uppercase text-[10px] tracking-wider font-extrabold">Skill Supply Status:</span>
          <div className="flex items-center gap-1.5 text-red-700">
            <span className="w-3 h-3 rounded-full bg-red-500 border border-red-600 shadow-xs" />
            <span>🔴 RED = Skill Shortage (Underflow)</span>
          </div>
          <div className="flex items-center gap-1.5 text-amber-800">
            <span className="w-3 h-3 rounded-full bg-amber-500 border border-amber-600 shadow-xs" />
            <span>🟡 YELLOW = Balanced Supply</span>
          </div>
          <div className="flex items-center gap-1.5 text-emerald-700">
            <span className="w-3 h-3 rounded-full bg-emerald-500 border border-emerald-600 shadow-xs" />
            <span>🟢 GREEN = Surplus Supply (Overflow)</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Filter size={13} className="text-slate-400" />
          {[
            { key: "ALL", label: "All Hubs" },
            { key: "UNDERFLOW", label: "Red (Shortages)", dot: "bg-red-500" },
            { key: "BALANCED", label: "Yellow (Balanced)", dot: "bg-amber-500" },
            { key: "OVERFLOW", label: "Green (Surplus)", dot: "bg-emerald-500" },
          ].map(f => (
            <button
              key={f.key}
              onClick={() => setStatusFilter(f.key)}
              className={`px-2.5 py-0.5 text-xs font-bold rounded-full transition-colors flex items-center gap-1 ${
                statusFilter === f.key
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {f.dot && <span className={`w-1.5 h-1.5 rounded-full ${f.dot}`} />}
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* MAIN VIEW AREA */}
      <div className="p-5 bg-slate-50/40 min-h-[460px] relative">
        {loading && (
          <div className="flex flex-col items-center justify-center py-20">
            <RefreshCw size={28} className="animate-spin text-indigo-600 mb-3" />
            <p className="text-sm font-bold text-slate-700">Loading Pan-India Regional Skill Map...</p>
            <p className="text-xs text-slate-400 mt-1">Color coding green surplus, yellow balance, and red shortage zones</p>
          </div>
        )}

        {error && (
          <div className="p-6 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-sm text-center">
            <AlertTriangle className="mx-auto mb-2 text-rose-600" size={24} />
            <p className="font-bold">{error}</p>
          </div>
        )}

        {!loading && !error && viewMode === "map" && (
          <IndiaMapVisualView
            zones={filteredZones}
            flows={flows}
            selectedZone={selectedZone}
            hoveredZone={hoveredZone}
            onSelectZone={setSelectedZone}
            onHoverZone={setHoveredZone}
            hoveredFlow={hoveredFlow}
            onHoverFlow={setHoveredFlow}
            horizon={horizon}
            skill={skill}
          />
        )}

        {!loading && !error && viewMode === "grid" && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredZones.map(zone => (
              <ZoneCard
                key={zone.id}
                zone={zone}
                isSelected={selectedZone?.id === zone.id}
                onSelect={() => setSelectedZone(zone)}
                flows={flows.filter(f => f.source === zone.id || f.target === zone.id)}
              />
            ))}
          </div>
        )}

        {!loading && !error && viewMode === "vector" && (
          <VectorMapView
            flows={flows}
            zones={zones}
            onSelectZone={setSelectedZone}
          />
        )}
      </div>

      {/* ZONE DEEP-DIVE MODAL / DRILL-DOWN PANEL */}
      {selectedZone && (
        <ZoneDeepDiveModal
          zone={selectedZone}
          allZones={zones}
          flows={flows}
          horizon={horizon}
          onClose={() => setSelectedZone(null)}
          onSelectZone={setSelectedZone}
        />
      )}
    </div>
  );
}

// ── VISUAL INDIA MAP COMPONENT ────────────────────────────────────────────────
function IndiaMapVisualView({ zones, flows, selectedZone, hoveredZone, onSelectZone, onHoverZone, hoveredFlow, onHoverFlow, horizon, skill }: {
  zones: Zone[];
  flows: Flow[];
  selectedZone: Zone | null;
  hoveredZone: Zone | null;
  onSelectZone: (z: Zone) => void;
  onHoverZone: (z: Zone | null) => void;
  hoveredFlow: Flow | null;
  onHoverFlow: (f: Flow | null) => void;
  horizon: string;
  skill: string;
}) {
  const width = 600;
  const height = 520;

  return (
    <div className="flex flex-col lg:flex-row gap-5 items-stretch">
      {/* SVG Interactive India Map */}
      <div className="flex-1 bg-slate-900 rounded-2xl border border-slate-800 p-4 relative shadow-xl min-h-[480px] flex items-center justify-center overflow-hidden">
        <div className="absolute top-4 left-4 z-10">
          <span className="text-[10px] font-black uppercase text-indigo-400 bg-slate-800/90 border border-slate-700 px-2 py-1 rounded tracking-wider">
            Pan-India Skill Distribution
          </span>
          <h4 className="text-sm font-extrabold text-white mt-1">{skill}</h4>
        </div>

        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto max-h-[460px]"
          style={{ filter: "drop-shadow(0 4px 12px rgba(0,0,0,0.5))" }}
        >
          {/* Background Map Canvas Grid & Boundary */}
          <rect x="15" y="15" width={width - 30} height={height - 30} rx="12" fill="#0f172a" stroke="#1e293b" strokeWidth="1.5" />

          {/* Decorative Latitude / Longitude Grid lines */}
          <line x1="40" y1="130" x2={width - 40} y2="130" stroke="#1e293b" strokeWidth="0.8" strokeDasharray="3 3" />
          <line x1="40" y1="260" x2={width - 40} y2="260" stroke="#1e293b" strokeWidth="0.8" strokeDasharray="3 3" />
          <line x1="40" y1="390" x2={width - 40} y2="390" stroke="#1e293b" strokeWidth="0.8" strokeDasharray="3 3" />
          <line x1="180" y1="40" x2="180" y2={height - 40} stroke="#1e293b" strokeWidth="0.8" strokeDasharray="3 3" />
          <line x1="340" y1="40" x2="340" y2={height - 40} stroke="#1e293b" strokeWidth="0.8" strokeDasharray="3 3" />

          {/* Regions Labels */}
          <text x="120" y="70" fill="#334155" fontSize="10" fontWeight="800">NORTH ZONE</text>
          <text x="120" y="270" fill="#334155" fontSize="10" fontWeight="800">WEST ZONE</text>
          <text x="220" y="440" fill="#334155" fontSize="10" fontWeight="800">SOUTH ZONE</text>
          <text x="440" y="240" fill="#334155" fontSize="10" fontWeight="800">EAST ZONE</text>

          {/* DRAW FLOW VECTORS (Inter-district green surplus -> red deficit lines) */}
          {flows.map((flow, idx) => {
            const pSrc = projectToMap(flow.source_lat, flow.source_lng, width, height);
            const pTgt = projectToMap(flow.target_lat, flow.target_lng, width, height);

            const isSelectedFlow =
              hoveredFlow?.vector_code === flow.vector_code ||
              (selectedZone && (flow.source === selectedZone.id || flow.target === selectedZone.id));

            const dx = pTgt.x - pSrc.x;
            const dy = pTgt.y - pSrc.y;
            const cx = (pSrc.x + pTgt.x) / 2 - dy * 0.15;
            const cy = (pSrc.y + pTgt.y) / 2 + dx * 0.15;

            return (
              <g key={`flow-${idx}`}
                onMouseEnter={() => onHoverFlow(flow)}
                onMouseLeave={() => onHoverFlow(null)}
                className="cursor-pointer"
              >
                <path
                  d={`M ${pSrc.x} ${pSrc.y} Q ${cx} ${cy} ${pTgt.x} ${pTgt.y}`}
                  fill="none"
                  stroke={isSelectedFlow ? "#6366f1" : "#475569"}
                  strokeWidth={isSelectedFlow ? 2.5 : 1.2}
                  strokeDasharray={isSelectedFlow ? "none" : "4 3"}
                  opacity={isSelectedFlow ? 0.95 : 0.4}
                />
                {isSelectedFlow && (
                  <circle cx={cx} cy={cy} r="12" fill="#4f46e5" stroke="#ffffff" strokeWidth="1.5">
                    <title>{`${flow.vector_code}: ${flow.source_name} ➔ ${flow.target_name} (${flow.potential_match} match)`}</title>
                  </circle>
                )}
                {isSelectedFlow && (
                  <text x={cx} y={cy + 3} textAnchor="middle" fill="#ffffff" fontSize="8" fontWeight="800">
                    +{flow.potential_match}
                  </text>
                )}
              </g>
            );
          })}

          {/* DRAW COLOR-CODED REGIONAL ZONE BUBBLES */}
          {zones.map(zone => {
            const pt = projectToMap(zone.lat, zone.lng, width, height);
            const cfg = STATUS_CONFIG[zone.status] || STATUS_CONFIG.Balanced;
            const isSelected = selectedZone?.id === zone.id;
            const isHovered = hoveredZone?.id === zone.id;

            const radius = isSelected ? 22 : isHovered ? 19 : 15;

            return (
              <g
                key={zone.id}
                onClick={() => onSelectZone(zone)}
                onMouseEnter={() => onHoverZone(zone)}
                onMouseLeave={() => onHoverZone(null)}
                className="cursor-pointer transition-all duration-200"
              >
                {/* Glowing Outer Ring for Shortage (Red) or Selected */}
                <circle
                  cx={pt.x} cy={pt.y}
                  r={radius + 8}
                  fill={cfg.hex}
                  fillOpacity={isSelected ? 0.35 : isHovered ? 0.25 : zone.status === "Underflow" ? 0.18 : 0.08}
                  className={zone.status === "Underflow" ? "animate-pulse" : ""}
                />

                {/* Main Color-Coded Solid Bubble */}
                <circle
                  cx={pt.x} cy={pt.y}
                  r={radius}
                  fill={cfg.hex}
                  stroke="#ffffff"
                  strokeWidth={isSelected ? 3 : 1.8}
                  style={{ filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.4))" }}
                />

                {/* Status Indicator Center Icon/Dot */}
                <circle
                  cx={pt.x} cy={pt.y}
                  r={radius / 3.5}
                  fill="#ffffff"
                />

                {/* Zone Name Label */}
                <text
                  x={pt.x}
                  y={pt.y + radius + 10}
                  textAnchor="middle"
                  fill="#f8fafc"
                  fontSize="9"
                  fontWeight="800"
                  style={{ textShadow: "0 1px 3px rgba(0,0,0,0.9)" }}
                >
                  {zone.district}
                </text>

                {/* Net Gap Label */}
                <text
                  x={pt.x}
                  y={pt.y + radius + 19}
                  textAnchor="middle"
                  fill={cfg.hex}
                  fontSize="8"
                  fontWeight="900"
                >
                  {zone.status === "Underflow" ? `−${zone.gap}` : zone.status === "Overflow" ? `+${Math.abs(zone.gap)}` : "Balanced"}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Hover Floating Tooltip */}
        {hoveredZone && (
          <div className="absolute bottom-4 right-4 bg-slate-900/95 border border-slate-700 text-white p-3 rounded-xl shadow-2xl backdrop-blur-md max-w-xs z-20">
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${STATUS_CONFIG[hoveredZone.status].dot}`} />
              <span className="font-extrabold text-sm">{hoveredZone.district}, {hoveredZone.state}</span>
            </div>
            <p className="text-[10px] text-slate-400 font-semibold mt-0.5">{hoveredZone.cluster_name}</p>
            <div className="mt-2 pt-2 border-t border-slate-800 grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-[10px] text-slate-400 block uppercase">Demand</span>
                <span className="font-bold text-white">{hoveredZone.demand.toLocaleString()}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block uppercase">Supply</span>
                <span className="font-bold text-white">{hoveredZone.supply.toLocaleString()}</span>
              </div>
            </div>
            <div className="mt-1.5 flex items-center justify-between text-xs">
              <span className="text-slate-400">Net Status:</span>
              <span className={`font-black ${STATUS_CONFIG[hoveredZone.status].text}`}>
                {hoveredZone.status === "Underflow" ? `−${hoveredZone.gap} Deficit` : hoveredZone.status === "Overflow" ? `+${Math.abs(hoveredZone.gap)} Surplus` : "Balanced"}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Side Quick Action & Regional List Panel */}
      <div className="w-full lg:w-80 bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex flex-col justify-between space-y-4">
        {selectedZone ? (
          <div>
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
              <Info size={13} className="text-indigo-600" /> Zone Details
            </h4>
            <div className="p-3 space-y-2">
              <p className="text-sm font-bold">{selectedZone.district}, {selectedZone.state}</p>
              <p className="text-xs text-slate-600">Cluster: {selectedZone.cluster_name}</p>
              <p className="text-xs text-slate-600">Demand: {selectedZone.demand.toLocaleString()}</p>
              <p className="text-xs text-slate-600">Supply: {selectedZone.supply.toLocaleString()}</p>
              <p className="text-xs text-slate-600">Gap: {selectedZone.gap} ({selectedZone.status})</p>
              <p className="text-xs text-slate-600">Training Capacity: {selectedZone.training_capacity}</p>
              <p className="text-xs text-slate-600">Warning: {selectedZone.warning}</p>
              <p className="text-xs text-slate-600">Recommendation: {selectedZone.recommendation}</p>
            </div>
            <button
              onClick={() => setSelectedZone(null)}
              className="mt-3 w-full bg-indigo-600 text-white py-1 rounded hover:bg-indigo-700 transition"
            >Close</button>
          </div>
        ) : (
          <div>
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
              <Activity size={14} className="text-indigo-600" /> Regional Skill Breakdown
            </h4>
            <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
              {zones.map(z => {
                const cfg = STATUS_CONFIG[z.status] || STATUS_CONFIG.Balanced;
                return (
                  <div
                    key={z.id}
                    onClick={() => onSelectZone(z)}
                    onMouseEnter={() => onHoverZone(z)}
                    onMouseLeave={() => onHoverZone(null)}
                    className={`p-3 rounded-xl border ${cfg.border} ${cfg.bg} cursor-pointer hover:shadow-md transition-all flex items-center justify-between gap-2`}
                  >
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                        <span className="text-xs font-black text-slate-900">{z.district}</span>
                        <span className="text-[10px] text-slate-500">({z.state})</span>
                      </div>
                      <p className="text-[10px] text-slate-500 font-semibold mt-0.5 truncate max-w-[170px]">{z.cluster_name}</p>
                    </div>
                    <div className="text-right">
                      <span className={`text-xs font-black block ${cfg.text}`}>
                        {z.status === "Underflow" ? `−${z.gap}` : z.status === "Overflow" ? `+${Math.abs(z.gap)}` : "Balanced"}
                      </span>
                      <span className="text-[9px] text-slate-400 block uppercase font-bold">{z.status}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-xl text-[11px] text-indigo-900 leading-relaxed">
          <p className="font-bold flex items-center gap-1 text-indigo-950 mb-1">
            <Info size={13} className="text-indigo-600" /> Map Interaction Hint
          </p>
          Click any hex tile to view detailed statistics in this panel.
        </div>
      </div>
    </div>
  );
}

// ── ZONE CARD COMPONENT (GRID VIEW) ──────────────────────────────────────────
function ZoneCard({ zone, isSelected, onSelect, flows }: {
  zone: Zone;
  isSelected: boolean;
  onSelect: () => void;
  flows: Flow[];
}) {
  const cfg = STATUS_CONFIG[zone.status] || STATUS_CONFIG.Balanced;
  const isUnderflow = zone.status === "Underflow";
  const isOverflow = zone.status === "Overflow";

  const sourcingVectors = flows.filter(f => f.target === zone.id);

  return (
    <div
      onClick={onSelect}
      className={`bg-white rounded-xl border ${cfg.border} shadow-2xs hover:shadow-md transition-all cursor-pointer overflow-hidden flex flex-col justify-between ${
        isSelected ? "ring-2 ring-indigo-600 border-indigo-500" : ""
      }`}
    >
      <div>
        <div className={`p-4 ${cfg.bg} border-b ${cfg.border} flex items-start justify-between gap-2`}>
          <div>
            <div className="flex items-center gap-1.5">
              <span className={`w-2.5 h-2.5 rounded-full ${cfg.dot}`} />
              <span className="text-xs font-black uppercase text-slate-900">{zone.district}</span>
              <span className="text-xs font-normal text-slate-500">({zone.state})</span>
            </div>
            <p className="text-[11px] font-bold text-slate-500 mt-0.5 truncate max-w-[220px]" title={zone.cluster_name}>
              {zone.cluster_name}
            </p>
          </div>

          <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${cfg.badgeBg}`}>
            {zone.status === "Underflow" ? "Critical Shortage" : zone.status === "Overflow" ? "Surplus Supply" : "Balanced"}
          </span>
        </div>

        <div className="p-4 space-y-3">
          <div className="flex items-baseline justify-between">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Demand vs Supply</p>
              <p className="text-sm font-extrabold text-slate-800 mt-0.5">
                D: <span className="text-slate-900">{zone.demand.toLocaleString()}</span> / S: <span className="text-slate-900">{zone.supply.toLocaleString()}</span>
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Net Supply Gap</p>
              <p className={`text-base font-black ${isUnderflow ? "text-red-600" : isOverflow ? "text-emerald-600" : "text-amber-700"}`}>
                {isUnderflow ? `−${zone.gap.toLocaleString()}` : isOverflow ? `+${Math.abs(zone.gap).toLocaleString()}` : "0 (Equilibrium)"}
              </p>
            </div>
          </div>

          <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100 space-y-1">
            <div className="flex justify-between items-center text-[11px]">
              <span className="text-slate-500">NCO Trade:</span>
              <span className="font-bold text-slate-800">{zone.nco_code}</span>
            </div>
            <div className="flex justify-between items-center text-[11px]">
              <span className="text-slate-500">Coordinates:</span>
              <span className="font-mono text-slate-600 text-[10px]">{zone.lat.toFixed(2)}°N, {zone.lng.toFixed(2)}°E</span>
            </div>
          </div>

          {isUnderflow && (
            <div className="bg-red-50/80 border border-red-100 rounded-lg p-2 flex items-start gap-1.5 text-[11px] text-red-800">
              <AlertTriangle size={13} className="text-red-600 flex-shrink-0 mt-0.5" />
              <p className="line-clamp-2 leading-tight">{zone.warning}</p>
            </div>
          )}

          {isUnderflow && sourcingVectors.length > 0 && (
            <div className="text-[11px] text-indigo-700 bg-indigo-50 border border-indigo-100 rounded-lg p-2 flex items-center justify-between">
              <span className="font-bold flex items-center gap-1">
                <Radio size={12} className="text-indigo-600" /> {sourcingVectors.length} Vectors Available
              </span>
              <span className="font-extrabold text-indigo-900">
                From {sourcingVectors[0].source_name} (+{sourcingVectors[0].potential_match})
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-indigo-600 hover:text-indigo-800">
        <span>Drill Down & Detail Panel</span>
        <ArrowRight size={14} />
      </div>
    </div>
  );
}

// ── VECTOR MAP VIEW ─────────────────────────────────────────────────────────────
function VectorMapView({ flows, zones, onSelectZone }: {
  flows: Flow[];
  zones: Zone[];
  onSelectZone: (z: Zone) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
        <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
          <Radio className="text-indigo-600" size={16} /> Inter-District Skill Mobility Pathways (Surplus 🟢 ➔ Shortage 🔴)
        </h3>
        <p className="text-xs text-slate-500 mt-0.5">
          Matches overflow surplus capacity directly with underflow deficit hubs, distance-optimized across Indian industrial corridors.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {flows.map((flow, i) => {
          const srcZone = zones.find(z => z.id === flow.source);
          const tgtZone = zones.find(z => z.id === flow.target);

          return (
            <div key={i} className="bg-white p-4 rounded-xl border border-indigo-100 hover:border-indigo-300 shadow-2xs space-y-3 transition-colors">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <span className="text-[10px] font-mono font-extrabold px-2 py-0.5 bg-indigo-100 text-indigo-800 rounded">
                  {flow.vector_code}
                </span>
                <span className="text-xs font-bold text-slate-500">
                  ~{flow.distance_km} km distance
                </span>
              </div>

              <div className="flex items-center justify-between gap-2">
                {/* Source Surplus (Green) Hub */}
                <button
                  onClick={() => srcZone && onSelectZone(srcZone)}
                  className="flex-1 bg-emerald-50/80 hover:bg-emerald-100 border border-emerald-200 p-2.5 rounded-lg text-left transition-colors"
                >
                  <p className="text-[10px] font-extrabold text-emerald-700 uppercase flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Green Surplus Hub
                  </p>
                  <p className="text-sm font-extrabold text-slate-900">{flow.source_name}</p>
                  <p className="text-[11px] text-emerald-700 font-bold mt-0.5">+{flow.potential_match} surplus</p>
                </button>

                <div className="flex flex-col items-center flex-shrink-0 px-1">
                  <ArrowRight size={18} className="text-indigo-600" />
                  <span className="text-[9px] font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded mt-1">
                    {flow.potential_match} match
                  </span>
                </div>

                {/* Target Shortage (Red) Hub */}
                <button
                  onClick={() => tgtZone && onSelectZone(tgtZone)}
                  className="flex-1 bg-red-50/80 hover:bg-red-100 border border-red-200 p-2.5 rounded-lg text-left transition-colors"
                >
                  <p className="text-[10px] font-extrabold text-red-700 uppercase flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500" /> Red Shortage Hub
                  </p>
                  <p className="text-sm font-extrabold text-slate-900">{flow.target_name}</p>
                  <p className="text-[11px] text-red-700 font-bold mt-0.5">−{tgtZone?.gap || flow.potential_match} deficit</p>
                </button>
              </div>

              <p className="text-[10px] text-slate-400">
                Calculated mobility vector based on distance and skill compatibility.
              </p>
            </div>
          );
        })}

        {flows.length === 0 && (
          <div className="col-span-full py-12 text-center text-slate-400 bg-white rounded-xl border border-slate-200">
            <p className="font-bold text-sm text-slate-600">No active inter-district vectors for current selection.</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── ZONE DEEP-DIVE MODAL / DRILL-DOWN PANEL ────────────────────────────────────
function ZoneDeepDiveModal({ zone, allZones, flows, horizon, onClose, onSelectZone }: {
  zone: Zone;
  allZones: Zone[];
  flows: Flow[];
  horizon: string;
  onClose: () => void;
  onSelectZone: (z: Zone) => void;
}) {
  const cfg = STATUS_CONFIG[zone.status] || STATUS_CONFIG.Balanced;
  const isUnderflow = zone.status === "Underflow";
  const isOverflow = zone.status === "Overflow";

  const sourcingVectors = flows.filter(f => f.target === zone.id);
  const destinationVectors = flows.filter(f => f.source === zone.id);

  const trajectoryChartData = [
    { name: "Current", demand: zone.trajectories["current"]?.demand || zone.demand, supply: zone.trajectories["current"]?.supply || zone.supply },
    { name: "12m", demand: zone.trajectories["12m"]?.demand || zone.demand, supply: zone.trajectories["12m"]?.supply || zone.supply },
    { name: "18m", demand: zone.trajectories["18m"]?.demand || zone.demand, supply: zone.trajectories["18m"]?.supply || zone.supply },
    { name: "24m", demand: zone.trajectories["24m"]?.demand || zone.demand, supply: zone.trajectories["24m"]?.supply || zone.supply },
    { name: "36m", demand: zone.trajectories["36m"]?.demand || zone.demand, supply: zone.trajectories["36m"]?.supply || zone.supply },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto flex flex-col">
        {/* Modal Header */}
        <div className="p-6 bg-slate-900 text-white flex items-start justify-between sticky top-0 z-10 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${cfg.badgeBg}`}>
                {zone.status === "Underflow" ? "🔴 Skill Shortage (Underflow)" : zone.status === "Overflow" ? "🟢 Surplus Skill Supply (Overflow)" : "🟡 Balanced Supply"}
              </span>
              <span className="text-xs text-slate-400 font-mono">{zone.nco_code}</span>
            </div>
            <h2 className="text-2xl font-black text-white mt-1">{zone.district}, {zone.state}</h2>
            <p className="text-xs text-indigo-300 font-semibold mt-0.5 flex items-center gap-1">
              <MapPin size={12} /> {zone.cluster_name} ({zone.lat.toFixed(4)}°N, {zone.lng.toFixed(4)}°E)
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg border border-slate-800 hover:bg-slate-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6 flex-1">
          {/* Key Metrics Overview */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Current Demand</p>
              <p className="text-xl font-black text-slate-900 mt-1">{zone.demand.toLocaleString()}</p>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Skill Supply</p>
              <p className="text-xl font-black text-slate-900 mt-1">{zone.supply.toLocaleString()}</p>
            </div>

            <div className={`p-3.5 rounded-xl border ${isUnderflow ? "bg-red-50 border-red-200" : isOverflow ? "bg-emerald-50 border-emerald-200" : "bg-amber-50 border-amber-200"}`}>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Net Supply Gap</p>
              <p className={`text-xl font-black mt-1 ${isUnderflow ? "text-red-700" : isOverflow ? "text-emerald-700" : "text-amber-800"}`}>
                {isUnderflow ? `−${zone.gap.toLocaleString()}` : isOverflow ? `+${Math.abs(zone.gap).toLocaleString()}` : "0"}
              </p>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Annual Growth Rate</p>
              <p className="text-xl font-black text-indigo-600 mt-1">+{zone.growth_rate}%</p>
            </div>
          </div>

          {/* Active Early Warning Banner */}
          <div className={`p-4 rounded-xl border ${isUnderflow ? "bg-red-50 border-red-200 text-red-900" : "bg-indigo-50 border-indigo-200 text-indigo-900"}`}>
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className={isUnderflow ? "text-red-600" : "text-indigo-600"} size={16} />
              <h4 className="text-xs font-extrabold uppercase tracking-wider">Active Regional Warning</h4>
            </div>
            <p className="text-xs font-semibold leading-relaxed">{zone.warning}</p>
          </div>

          {/* Forecast Trajectory Chart */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
            <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider mb-3">
              12 / 18 / 24 / 36-Month Forecasted Trajectory
            </h4>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trajectoryChartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#64748b" }} />
                  <YAxis tick={{ fontSize: 11, fill: "#64748b" }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="demand" stroke="#3b82f6" strokeWidth={2.5} name="Demand Trajectory" />
                  <Line type="monotone" dataKey="supply" stroke="#10b981" strokeWidth={2.5} name="Supply Trajectory" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Recommended Policy Interventions */}
          <div className="bg-blue-50/80 border border-blue-200 p-4 rounded-xl">
            <h4 className="text-xs font-extrabold text-blue-900 uppercase tracking-wider mb-1 flex items-center gap-1.5">
              <ShieldCheck size={16} className="text-blue-600" /> Recommended Policy & Training Intervention
            </h4>
            <p className="text-xs font-semibold text-slate-800 leading-relaxed">{zone.recommendation}</p>
          </div>

          {/* Sourcing Vectors */}
          {isUnderflow && (
            <div className="space-y-3">
              <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Radio size={14} className="text-indigo-600" /> Optimized Sourcing Vectors ({sourcingVectors.length})
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {sourcingVectors.map((f, i) => {
                  const srcZone = allZones.find(z => z.id === f.source);
                  return (
                    <div key={i} className="bg-emerald-50/70 p-3 rounded-xl border border-emerald-200 hover:border-emerald-300 transition-colors">
                      <div className="flex justify-between items-start mb-1">
                        <div>
                          <p className="text-xs font-extrabold text-slate-900">{f.source_name}, {f.source_state}</p>
                          <p className="text-[10px] text-slate-500">~{f.distance_km} km away</p>
                        </div>
                        <span className="text-xs font-black text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
                          +{f.potential_match} Match
                        </span>
                      </div>
                      {srcZone && (
                        <p className="text-[11px] text-emerald-700 font-semibold mt-1">
                          🟢 Surplus Skill Supply: +{Math.abs(srcZone.gap).toLocaleString()} seats
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-between items-center text-xs text-slate-500">
          <span>Pan-India Regional Zone Architecture · SIH 26246</span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg transition-colors"
          >
            Close Panel
          </button>
        </div>
      </div>
    </div>
  );
}
