"use client";
import React, { useState, useEffect, useCallback } from "react";
import {
  AlertTriangle, ShieldCheck, RefreshCw,
  Layers, Activity, Zap, Target, GitBranch, ArrowRight, MapPin
} from "lucide-react";
import {
 LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
ResponsiveContainer, PieChart, Pie, Cell
} from "recharts";
import IndiaHexMap from "./components/IndiaHexMap";

const API = "http://127.0.0.1:8000/api";

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedState, setSelectedState] = useState("");
  const [selectedDistrict, setSelectedDistrict] = useState("");
  const [selectedSkill, setSelectedSkill] = useState("EV Battery Management Specialist");

  const [summary, setSummary] = useState<any>(null);
  const [districts, setDistricts] = useState<any[]>([]);
  const [skills, setSkills] = useState<string[]>([]);
  const [skillData, setSkillData] = useState<any>(null);
  const [forecast, setForecast] = useState<any>(null);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [transitions, setTransitions] = useState<any>(null);
  const [simCapacity, setSimCapacity] = useState(30);
  const [chartMetric, setChartMetric] = useState<"all" | "demand" | "supply" | "gap">("all");
  const [simResult, setSimResult] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [metadata, setMetadata] = useState<any>(null);
  const [error, setError] = useState("");

  const buildQuery = useCallback(() => {
    const q = new URLSearchParams();
    if (selectedState) q.append("state", selectedState);
    if (selectedDistrict) q.append("district", selectedDistrict);
    return q.toString() ? `?${q.toString()}` : "";
  }, [selectedState, selectedDistrict]);

  const fetchAllData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const query = buildQuery();
      const [sumRes, distRes, skillsRes, alertRes, recRes] = await Promise.all([
        fetch(`${API}/dashboard-summary${query}`),
        fetch(`${API}/districts${query}`),
        fetch(`${API}/skills${query}`),
        fetch(`${API}/alerts${query}`),
        fetch(`${API}/recommendations${query}`),
      ]);
      setSummary((await sumRes.json()).data);
      const distJson = await distRes.json();
      setDistricts(distJson.data);
      setMetadata(distJson.metadata);
      const skillsJson = await skillsRes.json();
      setSkills(skillsJson.data);
      setAlerts((await alertRes.json()).data);
      setRecommendations((await recRes.json()).data);
    } catch {
      setError("Cannot connect to backend. Start the FastAPI server on port 8000.");
    }
    setLoading(false);
  }, [buildQuery]);

  const fetchSkillData = useCallback(async () => {
    if (!selectedSkill) return;
    try {
      const query = buildQuery();
      const [skillRes, forecastRes, transRes] = await Promise.all([
        fetch(`${API}/skill/${encodeURIComponent(selectedSkill)}${query}`),
        fetch(`${API}/forecast/${encodeURIComponent(selectedSkill)}${query}`),
        fetch(`${API}/skill-transition/${encodeURIComponent(selectedSkill)}`),
      ]);
      if (skillRes.ok) setSkillData((await skillRes.json()).data?.[0] ?? null);
      if (forecastRes.ok) setForecast((await forecastRes.json()).data);
      if (transRes.ok) setTransitions((await transRes.json()).data);
    } catch (e) {
      console.error("Skill data fetch failed", e);
    }
  }, [selectedSkill, buildQuery]);

  const runSimulation = useCallback(async (val: number) => {
    try {
      const res = await fetch(`${API}/simulate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          state: selectedState || null,
          district: selectedDistrict || null,
          skill: selectedSkill,
          training_capacity_increase_pct: val,
        }),
      });
      if (res.ok) setSimResult((await res.json()).data);
    } catch (e) {
      console.error("Simulation failed", e);
    }
  }, [selectedSkill, selectedState, selectedDistrict]);

  useEffect(() => { fetchAllData(); }, [fetchAllData]);
  useEffect(() => {
    if (["deepdive", "simulator"].includes(activeTab)) {
      fetchSkillData();
      runSimulation(simCapacity);
    }
  }, [activeTab, fetchSkillData, runSimulation, simCapacity]);

  const handleSimChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    setSimCapacity(val);
    runSimulation(val);
  };

  // Sidebar nav config
  const navItems = [
    { id: "overview", label: "Overview", icon: <Activity size={17} /> },
    { id: "deepdive", label: "Skill Deep Dive", icon: <Target size={17} /> },
    { id: "radar", label: "Future Skill Radar", icon: <Layers size={17} /> },
    { id: "simulator", label: "Policy Simulator", icon: <Zap size={17} /> },
    { id: "flowmap", label: "Workforce Flow Map", icon: <GitBranch size={17} />, accent: true },
  ];

  return (
    <div className="flex h-screen bg-[#DCEBE7] text-[#24332F] font-sans overflow-hidden">
      {/* ─── SIDEBAR ─────────────────────────────────────────── */}
      <aside className="w-60 bg-[#314D49] text-white flex flex-col flex-shrink-0">
        <div className="px-5 py-6">
         
          <h1 className="text-xl font-extrabold tracking-tight">SkillSight AI</h1>
          <p className="text-xs text-[#BFD4D0] mt-1">Predicting Tomorrow's Workforce Today </p>
        </div>

        <nav className="flex-1 px-3 space-y-1">
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-2.5 ${activeTab === item.id
                 ? "bg-[#527C75] text-white"
                  : "text-[#D7E6E2] hover:bg-[#3F665F]"
                }`}
            >
              {item.icon} {item.label}
            </button>
          ))}
        </nav>

        {/* Data Freshness */}
        <div className="m-3 p-3 bg-[#29423F] rounded-lg border border-[#466B65]">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Data Source</p>
          {metadata ? (
            <div>
              <div className="flex items-center gap-1.5">
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${metadata.status === "LIVE" ? "bg-green-500" : metadata.status === "LATEST_AVAILABLE" ? "bg-blue-400" : "bg-amber-500"
                  }`} />
                <span className="text-xs font-medium text-white truncate">{metadata.source}</span>
              </div>
              <p className="text-[10px] text-slate-400 mt-1">
                {metadata.status === "SIMULATED" ? "⚠ Prototype / Simulated" : metadata.status}
              </p>
              <p className="text-[10px] text-slate-400">{metadata.data_age_minutes}m ago</p>
            </div>
          ) : (
            <p className="text-xs text-slate-500">Loading...</p>
          )}
          <button
            onClick={fetchAllData}
            className="mt-2 w-full bg-[#3F665F] hover:bg-[#527C75] text-xs py-1.5 rounded flex items-center justify-center gap-1 transition-colors"
          >
            <RefreshCw size={11} className={loading ? "animate-spin" : ""} /> Refresh
          </button>
        </div>
      </aside>

      {/* ─── MAIN ────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header bar */}
        <header className="bg-white border-b border-slate-200 px-6 py-3 flex items-center gap-3 flex-shrink-0">
          <MapPin size={15} className="text-slate-400" />
          <select
            value={selectedState}
            onChange={e => { setSelectedState(e.target.value); setSelectedDistrict(""); }}
            className="border border-slate-200 rounded-lg px-2 py-1 text-sm bg-white focus:ring-2 focus:ring-[#6F958D] focus:outline-none"
          >
            <option value="">All India (National)</option>
            <option value="Maharashtra">Maharashtra</option>
            <option value="Karnataka">Karnataka</option>
            <option value="Tamil Nadu">Tamil Nadu</option>
            <option value="Gujarat">Gujarat</option>
            <option value="Uttar Pradesh">Uttar Pradesh</option>
            <option value="Telangana">Telangana</option>
            <option value="West Bengal">West Bengal</option>
          </select>
          {selectedState && (
            <select
              value={selectedDistrict}
              onChange={e => setSelectedDistrict(e.target.value)}
              className="border border-slate-200 rounded-lg px-2 py-1 text-sm bg-white focus:ring-2 focus:ring-[#6F958D] focus:outline-none"
            >
              <option value="">All Districts</option>
              <option value="Pune">Pune</option>
              <option value="Mumbai">Mumbai</option>
              <option value="Nashik">Nashik</option>
              <option value="Nagpur">Nagpur</option>
              <option value="Bengaluru">Bengaluru</option>
              <option value="Mysuru">Mysuru</option>
            </select>
          )}
          {["deepdive", "simulator", "flowmap"].includes(activeTab) && (
            <select
            value={selectedSkill}
            onChange={e => setSelectedSkill(e.target.value)}
            className="ml-2 border border-[#527C75] rounded-lg px-3 py-2 text-sm bg-white text-[#314D49] font-medium focus:outline-none focus:ring-2 focus:ring-[#527C75] focus:border-[#527C75]"
          >
              {skills.length > 0 ? skills.map(s => <option key={s} value={s}>{s}</option>) : (
                <option value={selectedSkill}>{selectedSkill}</option>
              )}
            </select>
          )}
        </header>

        <main className="flex-1 overflow-auto p-6">
          {error && (
            <div className="mb-4 p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-sm">
              {error}
            </div>
          )}

      {/* ── OVERVIEW ── */}
{activeTab === "overview" && (
  <div className="space-y-5">

    {loading ? (
      <div className="flex items-center justify-center h-32 text-slate-400 animate-pulse">
        Loading intelligence...
      </div>
    ) : summary && (
      <>
        {/* COMMAND STRIP */}
        <div className="bg-slate-950 text-white rounded-2xl p-5 border border-slate-800 shadow-xl">
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">

            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-400">
                  Workforce Intelligence
                </span>
              </div>

              <h2 className="text-2xl md:text-3xl font-black tracking-tight">
                Where is India's skill demand moving?
              </h2>

              <p className="text-sm text-slate-400 mt-1 max-w-2xl">
                Monitor demand, supply and emerging workforce pressure points
                across districts — then drill directly into the signal.
              </p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setActiveTab("deepdive")}
                className="px-4 py-2.5 bg-white text-slate-900 rounded-lg text-xs font-bold hover:bg-slate-200 transition-colors"
              >
                Explore a Skill →
              </button>

              <button
                onClick={() => setActiveTab("flowmap")}
                className="px-4 py-2.5 border border-slate-700 text-slate-200 rounded-lg text-xs font-bold hover:bg-slate-800 transition-colors"
              >
                View Workforce Flow
              </button>
            </div>

          </div>
        </div>

        {/* SIGNAL CARDS */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">

          <div className="bg-white border border-slate-200 rounded-xl p-4 hover:border-blue-300 transition-colors">
            <div className="flex justify-between items-start">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Total Demand
              </p>
              <span className="text-[10px] font-bold text-[#6F958D]">DEMAND</span>
            </div>
            <p className="text-2xl font-black text-slate-900 mt-2">
              {summary.total_demand.toLocaleString()}
            </p>
            <p className="text-[10px] text-slate-400 mt-1">
              Workforce required
            </p>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4 hover:border-emerald-300 transition-colors">
            <div className="flex justify-between items-start">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Available Supply
              </p>
              <span className="text-[10px] font-bold text-emerald-500">SUPPLY</span>
            </div>
            <p className="text-2xl font-black text-slate-900 mt-2">
              {summary.total_supply.toLocaleString()}
            </p>
            <p className="text-[10px] text-slate-400 mt-1">
              Workforce available
            </p>
          </div>

          <div className="bg-white border border-rose-200 rounded-xl p-4 hover:border-rose-400 transition-colors">
            <div className="flex justify-between items-start">
              <p className="text-[10px] font-bold uppercase tracking-wider text-rose-500">
                Critical Shortages
              </p>
              <AlertTriangle size={15} className="text-rose-500" />
            </div>
            <p className="text-2xl font-black text-rose-600 mt-2">
              {summary.critical_shortages}
            </p>
            <p className="text-[10px] text-slate-400 mt-1">
              Immediate attention signals
            </p>
          </div>

          <div className="bg-white border border-emerald-200 rounded-xl p-4 hover:border-emerald-400 transition-colors">
            <div className="flex justify-between items-start">
              <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">
                Saturated Trades
              </p>
              <span className="text-[10px] font-bold text-emerald-600">SURPLUS</span>
            </div>
            <p className="text-2xl font-black text-emerald-600 mt-2">
              {summary.saturated_trades}
            </p>
            <p className="text-[10px] text-slate-400 mt-1">
              Supply exceeds demand
            </p>
          </div>

        </div>

        {/* MAP + LIVE SIGNALS */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">

          {/* MAP */}
          <div className="xl:col-span-2 bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">

            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#2F5D62]0" />
                  <h3 className="text-sm font-black text-slate-900">
                    India Skill Pressure Map
                  </h3>
                </div>

                <p className="text-[11px] text-slate-400 mt-1">
                  Select a skill or region to investigate workforce imbalance
                </p>
              </div>

              <div className="hidden sm:flex items-center gap-3 text-[10px] font-semibold">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-rose-500" />
                  Under-supply
                </span>

                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-[#2F5D62]0" />
                  Workforce flow
                </span>

                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  Surplus
                </span>
              </div>
            </div>

            <div className="p-3">
              <IndiaHexMap
                selectedSkill={selectedSkill}
                selectedState={selectedState}
                allSkills={skills.length > 0 ? skills : [selectedSkill]}
              />
            </div>

          </div>

          {/* EARLY WARNING PANEL */}
          <div className="bg-slate-950 text-white rounded-2xl border border-slate-800 overflow-hidden">

            <div className="px-5 py-4 border-b border-slate-800">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <AlertTriangle size={15} className="text-amber-400" />
                    <h3 className="text-sm font-black">
                      Early Warning Signals
                    </h3>
                  </div>

                  <p className="text-[10px] text-slate-500 mt-1">
                    Areas requiring policy attention
                  </p>
                </div>

                <span className="text-[10px] font-bold text-amber-400 bg-amber-400/10 px-2 py-1 rounded-md">
                  {alerts.length} SIGNALS
                </span>
              </div>
            </div>

            <div className="p-3 space-y-2 max-h-[420px] overflow-auto">

              {alerts.slice(0, 6).map((a, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setSelectedSkill(a.skill);
                    setActiveTab("deepdive");
                  }}
                  className="w-full text-left bg-slate-900 border border-slate-800 hover:border-amber-500/50 rounded-xl p-3 transition-all group"
                >
                  <div className="flex items-start justify-between gap-2">

                    <div className="min-w-0">
                      <p className="text-xs font-bold text-white truncate group-hover:text-amber-300 transition-colors">
                        {a.skill}
                      </p>

                      <p className="text-[10px] text-slate-500 mt-0.5">
                        {a.location}
                      </p>
                    </div>

                    <span className="text-[9px] font-bold text-rose-400 whitespace-nowrap">
                      {a.time_horizon}
                    </span>

                  </div>

                  <p className="text-[10px] text-rose-300 mt-2">
                    {a.predicted_status}
                  </p>

                  <p className="text-[10px] text-slate-500 mt-1 line-clamp-2">
                    {a.reason}
                  </p>

                </button>
              ))}

              {alerts.length === 0 && (
                <div className="text-center py-10 text-xs text-slate-500">
                  No critical alerts detected.
                </div>
              )}

            </div>
          </div>

        </div>

        {/* MARKET SIGNAL TABLE */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">

          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-black text-slate-900">
                District Skill Signals
              </h3>
              <p className="text-[10px] text-slate-400 mt-1">
                Click any row to open its skill intelligence view
              </p>
            </div>

            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              {districts.length} records
            </span>
          </div>

          <div className="overflow-auto max-h-80">

            <table className="w-full text-left text-sm">

              <thead className="bg-slate-50 sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Location
                  </th>

                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Skill
                  </th>

                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Demand / Supply
                  </th>

                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Status
                  </th>

                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Demand Index
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">

                {districts.map((d, i) => (
                  <tr
                    key={i}
                    onClick={() => {
                      setSelectedSkill(d.skill);
                      setSelectedState(d.state);
                      setActiveTab("deepdive");
                    }}
                    className="cursor-pointer hover:bg-[#2F5D62]/50 transition-colors"
                  >

                    <td className="px-4 py-3">
                      <p className="text-xs font-bold text-slate-800">
                        {d.district}
                      </p>
                      <p className="text-[10px] text-slate-400">
                        {d.state}
                      </p>
                    </td>

                    <td className="px-4 py-3">
                      <span className="text-xs font-semibold text-slate-700">
                        {d.skill}
                      </span>
                    </td>

                    <td className="px-4 py-3">
                      <span className="text-xs font-mono text-slate-600">
                        {d.current_demand.toLocaleString()} /{" "}
                        {d.current_supply.toLocaleString()}
                      </span>
                    </td>

                    <td className="px-4 py-3">

                      <span
                        className={`px-2 py-1 text-[9px] rounded-md font-bold uppercase ${
                          d.gap > 0
                            ? "bg-amber-100 text-amber-800"
                            : "bg-emerald-100 text-emerald-800"
                        }`}
                      >
                        {d.status}
                      </span>

                    </td>

                    <td className="px-4 py-3">

                      <div className="flex items-center gap-2 min-w-[130px]">

                        <div className="flex-1 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                          <div
                            className="bg-[#2F5D62]0 h-full rounded-full"
                            style={{
                              width: `${Math.min(
                                100,
                                Math.max(0, d.skill_demand_index)
                              )}%`,
                            }}
                          />
                        </div>

                        <span className="text-[10px] font-black text-slate-600 w-6">
                          {d.skill_demand_index}
                        </span>

                      </div>

                    </td>

                  </tr>
                ))}

              </tbody>

            </table>

          </div>
        </div>

      </>
    )}

  </div>
)}

          {/* ── SKILL DEEP DIVE ── */}
          {activeTab === "deepdive" && (
            <div className="space-y-5">
              {!skillData ? (
                <p className="text-slate-400 text-sm">Loading skill data...</p>
              ) : (
                <>
                  {/* Header card */}
                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                    <div className="flex justify-between items-start mb-5">
                      <div>
                        <h2 className="text-xl font-extrabold text-slate-900">{skillData.skill}</h2>
                        <p className="text-sm text-slate-500 mt-0.5">{skillData.district}, {skillData.state} · {skillData.sector}</p>
                      </div>
                      <div className="text-right">
                        <div className="text-3xl font-black text-[#3F665F]">{skillData.skill_demand_index}<span className="text-base text-slate-400">/100</span></div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Skill Demand Index</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4 mb-5">
                      <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-center">
                        <p className="text-xs text-slate-500">Current Demand</p>
                        <p className="text-xl font-black text-slate-800">{skillData.current_demand.toLocaleString()}</p>
                      </div>
                      <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-center">
                        <p className="text-xs text-slate-500">Current Supply</p>
                        <p className="text-xl font-black text-slate-800">{skillData.current_supply.toLocaleString()}</p>
                      </div>
                      <div className={`p-3 rounded-lg border text-center ${skillData.gap > 0 ? "bg-rose-50 border-rose-200" : "bg-emerald-50 border-emerald-200"}`}>
                        <p className="text-xs text-slate-500">Gap</p>
                        <p className={`text-xl font-black ${skillData.gap > 0 ? "text-rose-600" : "text-emerald-600"}`}>
                          {skillData.gap > 0 ? `−${skillData.gap}` : `+${Math.abs(skillData.gap)}`}
                        </p>
                      </div>
                    </div>

                   {/* Forecast chart */}
{forecast && (
  <div className="bg-white rounded-xl border border-[#D6E2DE] p-5 shadow-sm">
    {/* Header */}
    <div className="flex items-start justify-between mb-4">
      <div>
        <h3 className="text-sm font-bold text-[#314D49]">
          Workforce Demand Forecast
        </h3>
        <p className="text-[11px] text-[#6F8580] mt-1">
          Workforce trend from modelled backcast to future projection
        </p>
      </div>

      <div className="flex items-center gap-1.5 bg-[#F5EBC7] border border-[#E3D59E] px-2.5 py-1.5 rounded-lg">
        <ShieldCheck
          size={14}
          className={
            forecast.confidence_level === "High"
              ? "text-[#2F5D62]"
              : "text-[#B89B5E]"
          }
        />
        <span className="text-[11px] font-semibold text-[#314D49]">
          {forecast.confidence_level} confidence
        </span>
      </div>
    </div>

    {/* Legend */}
    <div className="flex items-center gap-5 mb-3 flex-wrap">
      <div className="flex items-center gap-2">
        <span className="w-2.5 h-2.5 rounded-full bg-[#2F5D62]" />
        <span className="text-[11px] font-medium text-[#526964]">
          Demand
        </span>
      </div>

      <div className="flex items-center gap-2">
        <span className="w-2.5 h-2.5 rounded-full bg-[#B89B5E]" />
        <span className="text-[11px] font-medium text-[#526964]">
          Supply
        </span>
      </div>

      <div className="flex items-center gap-2">
        <span className="w-2.5 h-2.5 rounded-full bg-[#91AAA4]" />
        <span className="text-[11px] font-medium text-[#526964]">
          Backcast trend
        </span>
      </div>

      <span className="ml-auto text-[10px] text-[#8A9B97]">
        Past → Now → Future
      </span>
    </div>

    {/* Main chart */}
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={[
            {
              label: "-24m",
              demand:
                forecast.current_demand /
                Math.pow(1 + forecast.growth_rate, 2),
              supply:
                forecast.current_supply /
                Math.pow(
                  1 + forecast.growth_rate * 0.5,
                  2
                ),
              period: "backcast",
            },
            {
              label: "-12m",
              demand:
                forecast.current_demand /
                Math.pow(1 + forecast.growth_rate, 1),
              supply:
                forecast.current_supply /
                Math.pow(
                  1 + forecast.growth_rate * 0.5,
                  1
                ),
              period: "backcast",
            },
            {
              label: "Now",
              demand: forecast.current_demand,
              supply: forecast.current_supply,
              period: "current",
            },
            ...forecast.forecasts.map((f: any) => ({
              label: `+${f.months}m`,
              demand: f.demand,
              supply: f.supply,
              period: "forecast",
            })),
          ]}
          margin={{ top: 10, right: 10, left: 0, bottom: 5 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            vertical={false}
            stroke="#E5ECE9"
          />

          <XAxis
            dataKey="label"
            tick={{
              fontSize: 11,
              fill: "#667A75",
            }}
            axisLine={{ stroke: "#D6E2DE" }}
            tickLine={false}
          />

          <YAxis
            tick={{
              fontSize: 10,
              fill: "#667A75",
            }}
            axisLine={false}
            tickLine={false}
          />

          <Tooltip
            contentStyle={{
              backgroundColor: "#FFFFFF",
              border: "1px solid #D6E2DE",
              borderRadius: "10px",
              boxShadow: "0 4px 14px rgba(47,93,98,0.10)",
              fontSize: "12px",
            }}
            labelStyle={{
              color: "#314D49",
              fontWeight: 700,
              marginBottom: "4px",
            }}
            formatter={(value: any, name: any) => [
              Number(value).toLocaleString(),
              name === "demand" ? "Demand" : "Supply",
            ]}
          />

          <Line
            type="monotone"
            dataKey="demand"
            stroke="#2F5D62"
            strokeWidth={3}
            dot={{
              r: 4,
              fill: "#2F5D62",
              stroke: "#FFFFFF",
              strokeWidth: 2,
            }}
            activeDot={{
              r: 6,
              fill: "#2F5D62",
              stroke: "#FFFFFF",
              strokeWidth: 2,
            }}
            name="demand"
          />

          <Line
            type="monotone"
            dataKey="supply"
            stroke="#B89B5E"
            strokeWidth={3}
            dot={{
              r: 4,
              fill: "#B89B5E",
              stroke: "#FFFFFF",
              strokeWidth: 2,
            }}
            activeDot={{
              r: 6,
              fill: "#B89B5E",
              stroke: "#FFFFFF",
              strokeWidth: 2,
            }}
            name="supply"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>

    {/* Historical / forecast note */}
    <div className="mt-2 flex items-center justify-between">
      <span className="text-[10px] text-[#82938F]">
        Past values are modelled backcast, not official historical observations.
      </span>

      <span className="text-[10px] font-semibold text-[#314D49]">
        Now = current dataset
      </span>
    </div>

    {/* Bottom analytics */}
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5">

      {/* Current gap */}
      <div className="rounded-xl bg-[#EEF5F2] border border-[#D6E2DE] p-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-wider font-bold text-[#71857F]">
              Current Workforce Gap
            </p>

            <p className="text-2xl font-extrabold text-[#314D49] mt-1">
              {(
                forecast.current_demand -
                forecast.current_supply
              ).toLocaleString()}
            </p>

            <p className="text-[10px] text-[#7B8E89] mt-1">
              Demand − available supply
            </p>
          </div>

          <div className="w-10 h-10 rounded-lg bg-white border border-[#D6E2DE] flex items-center justify-center">
            <Target size={18} className="text-[#2F5D62]" />
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <div className="bg-white rounded-lg border border-[#DDE8E4] p-2.5">
            <p className="text-[9px] uppercase font-bold text-[#8A9B97]">
              Demand
            </p>
            <p className="text-sm font-bold text-[#314D49] mt-0.5">
              {forecast.current_demand.toLocaleString()}
            </p>
          </div>

          <div className="bg-white rounded-lg border border-[#DDE8E4] p-2.5">
            <p className="text-[9px] uppercase font-bold text-[#8A9B97]">
              Supply
            </p>
            <p className="text-sm font-bold text-[#314D49] mt-0.5">
              {forecast.current_supply.toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      {/* Workforce balance donut */}
      <div className="rounded-xl bg-[#F8F1D9] border border-[#E3D59E] p-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-wider font-bold text-[#8B7844]">
              Workforce Balance
            </p>

            <p className="text-[11px] text-[#8B7844] mt-1">
              Current supply coverage
            </p>
          </div>

          <div className="text-[10px] font-semibold text-[#8B7844]">
            Current
          </div>
        </div>

        <div className="flex items-center justify-center gap-5 mt-2">
          <div className="relative w-28 h-28">
            <PieChart width={112} height={112}>
              <Pie
              data={
  forecast.current_supply >= forecast.current_demand
    ? [
        {
          name: "Demand Utilized",
          value:
            forecast.current_supply > 0
              ? (forecast.current_demand /
                  forecast.current_supply) *
                100
              : 0,
        },
        {
          name: "Surplus",
          value:
            forecast.current_supply > 0
              ? ((forecast.current_supply -
                  forecast.current_demand) /
                  forecast.current_supply) *
                100
              : 0,
        },
      ]
    : [
        {
          name: "Demand Covered",
          value:
            forecast.current_demand > 0
              ? (forecast.current_supply /
                  forecast.current_demand) *
                100
              : 0,
        },
        {
          name: "Uncovered",
          value:
            forecast.current_demand > 0
              ? ((forecast.current_demand -
                  forecast.current_supply) /
                  forecast.current_demand) *
                100
              : 100,
        },
      ]
}
                cx="50%"
                cy="50%"
                innerRadius={35}
                outerRadius={50}
                paddingAngle={3}
                dataKey="value"
                stroke="none"
              >
                <Cell fill="#2F5D62" />
                <Cell fill="#D8C98F" />
              </Pie>
            </PieChart>

            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center">
                <p className="text-lg font-extrabold text-[#314D49]">
  {forecast.current_demand > 0
    ? forecast.current_supply >= forecast.current_demand
      ? Math.round(
          (forecast.current_demand /
            forecast.current_supply) *
            100
        )
      : Math.round(
          (forecast.current_supply /
            forecast.current_demand) *
            100
        )
    : 0}
  %
</p>
               <p className="text-[8px] uppercase font-bold text-[#7B8E89]">
  {forecast.current_supply >= forecast.current_demand
    ? "utilized"
    : "covered"}
</p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#2F5D62]" />
                <span className="text-[10px] text-[#71857F]">
                  Available supply
                </span>
              </div>
              <p className="text-sm font-bold text-[#314D49] ml-4">
                {forecast.current_supply.toLocaleString()}
              </p>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#D8C98F]" />
                <span className="text-[10px] text-[#71857F]">
                  {forecast.current_supply >= forecast.current_demand
                    ? "Surplus supply"
                    : "Uncovered demand"}
                </span>
              </div>
              <p className="text-sm font-bold text-[#314D49] ml-4">
                {Math.abs(
                  forecast.current_supply -
                    forecast.current_demand
                ).toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>

    {/* Confidence footer */}
    <div className="mt-4 text-center text-[10px] text-[#82938F]">
      Forecast confidence score:{" "}
      <span className="font-bold text-[#314D49]">
        {forecast.confidence_score}%
      </span>
    </div>
  </div>
)}
                  </div>

                 {/* Recommendations */}
{recommendations.filter(r => r.skill === skillData.skill).length > 0 && (
  <div className="bg-[#2F5D62] border border-[#527C75] rounded-xl p-5">
    <h3 className="text-sm font-bold text-[#DCEBE7] mb-3">
      Explainable Policy Recommendation
    </h3>

    {recommendations.filter(r => r.skill === skillData.skill).map((r, i) => (
      <div key={i}>
        <p className="text-sm font-semibold text-white mb-2">
          {r.recommendation}
        </p>

        <ul className="text-xs text-[#C9DDD8] space-y-1.5 list-disc pl-4">
          {r.reasons.map((reason: string, j: number) => (
            <li key={j}>{reason}</li>
          ))}
        </ul>
      </div>
    ))}
  </div>
)}

                  {/* Skill Transitions */}
                  {transitions && transitions.transitions?.length > 0 && (
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                      <h3 className="text-base font-bold text-slate-800 mb-4">Skill Transition & Reskilling Pathways</h3>
                      <div className="grid grid-cols-2 gap-4">
                        {transitions.transitions.map((t: any, i: number) => (
                          <div key={i} className="border border-slate-200 p-4 rounded-lg bg-slate-50/50 hover:border-blue-300 transition-colors">
                            <div className="flex justify-between items-start mb-2">
                              <h4 className="font-bold text-slate-900 text-sm">{t.target_skill}</h4>
                              <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-medium">{t.future_demand_trend}</span>
                            </div>
                            <div className="space-y-2">
                              <div>
                                <p className="text-[10px] font-semibold text-slate-500 mb-1">Transferable Skills</p>
                                <div className="flex flex-wrap gap-1">
                                  {t.transferable_skills.map((s: string, j: number) => (
                                    <span key={j} className="text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded">{s}</span>
                                  ))}
                                </div>
                              </div>
                              <div>
                                <p className="text-[10px] font-semibold text-rose-500 mb-1">Skill Gaps</p>
                                <div className="flex flex-wrap gap-1">
                                  {t.missing_skills.map((s: string, j: number) => (
                                    <span key={j} className="text-[10px] bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded">{s}</span>
                                  ))}
                                </div>
                              </div>
                              <p className="text-[10px] text-slate-500 pt-1 border-t border-slate-200">
                                <strong>Training:</strong> {t.suggested_training}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Workforce Flow Map quick view */}
                  <div className="bg-white rounded-xl border border-[#B8D1CC] shadow-sm p-5">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                          <GitBranch size={16} className="text-indigo-500" /> Workforce Flow Map
                        </h3>
                        <p className="text-xs text-slate-400 mt-0.5">Zone-level underflow and overflow for this skill</p>
                      </div>
                      <button
                        onClick={() => setActiveTab("flowmap")}
                        className="text-xs text-indigo-600 font-bold border border-[#B8D1CC] px-3 py-1.5 rounded-lg hover:bg-indigo-50 transition-colors flex items-center gap-1"
                      >
                        Full View <ArrowRight size={12} />
                      </button>
                    </div>
                    <IndiaHexMap selectedSkill={selectedSkill} selectedState={selectedState} allSkills={skills.length > 0 ? skills : [selectedSkill]} />
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── FUTURE SKILL RADAR ── */}
          {activeTab === "radar" && (
            <div className="space-y-5">
              <h2 className="text-xl font-extrabold text-slate-900">Future Skill Radar</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: "Critical / Emerging", range: [80, 100], color: "red" },
                  { label: "High Demand", range: [60, 79], color: "blue" },
                  { label: "Stable", range: [40, 59], color: "green" },
                  { label: "Saturation Risk", range: [0, 39], color: "amber" },
                ].map((cat, idx) => {
                  const groupSkills = districts.filter(
                    d => d.skill_demand_index >= cat.range[0] && d.skill_demand_index <= cat.range[1]
                  );
                  return (
                    <div key={idx} className="bg-white rounded-lg p-4 border border-slate-200 shadow-sm">
                      <h4 className={`text-xs font-bold uppercase tracking-wider mb-3 text-${cat.color}-600`}>{cat.label}</h4>
                      <div className="space-y-2">
                        {groupSkills.map((s, i) => (
                          <button key={i}
                            onClick={() => { setSelectedSkill(s.skill); setActiveTab("deepdive"); }}
                            className="w-full flex justify-between items-center bg-slate-50 hover:bg-slate-100 border border-slate-200 hover:border-blue-300 p-2 rounded-lg text-left transition-colors"
                          >
                            <span className="text-xs font-medium text-slate-800 truncate pr-1" title={s.skill}>{s.skill}</span>
                            <span className="text-xs font-bold bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded flex-shrink-0">{s.skill_demand_index}</span>
                          </button>
                        ))}
                        {groupSkills.length === 0 && <p className="text-xs text-slate-400">None in range</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── POLICY SIMULATOR ── */}
          {activeTab === "simulator" && (
            <div className="max-w-3xl mx-auto space-y-5">
              <div>
                <h2 className="text-xl font-extrabold text-slate-900">Policy Intervention Simulator</h2>
                <p className="text-sm text-slate-500 mt-1">Adjust training capacity and see the projected gap impact. Simulation is temporary — it does not alter live data.</p>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-6">
                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    Training Capacity Change: {simCapacity > 0 ? `+${simCapacity}%` : `${simCapacity}%`}
                  </label>
                  <input
                    type="range" min="-50" max="100" step="10" value={simCapacity}
                    onChange={handleSimChange}
                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  />
                  <div className="flex justify-between text-xs text-slate-400 mt-1">
                    <span>-50%</span><span>Baseline (0%)</span><span>+100%</span>
                  </div>
                </div>

                {simResult ? (
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Baseline</h3>
                      <div className="space-y-2 bg-slate-50 p-4 rounded-lg border border-slate-200">
                        <div className="flex justify-between text-sm border-b border-slate-100 pb-1.5">
                          <span className="text-slate-500">Demand</span>
                          <span className="font-bold">{simResult.baseline_demand.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-sm border-b border-slate-100 pb-1.5">
                          <span className="text-slate-500">Supply</span>
                          <span className="font-bold">{simResult.baseline_supply.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-rose-600 font-semibold">Gap</span>
                          <span className="font-black text-rose-600">
                            {simResult.baseline_gap > 0 ? `−${simResult.baseline_gap.toLocaleString()}` : simResult.baseline_gap.toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <h3 className="text-xs font-bold text-[#6F958D] uppercase tracking-widest">Projected</h3>
                      <div className="space-y-2 bg-[#2F5D62] p-4 rounded-lg border border-[#B8D1CC]">
                        <div className="flex justify-between text-sm border-b border-blue-100 pb-1.5">
                          <span className="text-slate-500">Demand</span>
                          <span className="font-bold">{simResult.baseline_demand.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-sm border-b border-blue-100 pb-1.5">
                          <span className="text-[#D7E6E2]">Projected Supply</span>
                          <span className="font-bold text-emerald-600">{simResult.projected_supply.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-sm border-b border-blue-100 pb-1.5">
                          <span className="text-white font-semibold">Remaining Gap</span>
                          <span className="font-black text-slate-800">{simResult.projected_gap.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-sm pt-1">
                        <span className="text-[#D7E6E2] font-semibold">Gap Reduction</span> 
                          <span className="text-xl font-black text-emerald-600">{simResult.gap_reduction_pct.toFixed(1)}%</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-slate-400">Select a skill from the header to run a simulation.</p>
                )}
              </div>
            </div>
          )}

          {/* ── WORKFORCE FLOW MAP ── */}
          {activeTab === "flowmap" && (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-extrabold text-slate-900">Workforce Flow Map</h2>
                <p className="text-sm text-slate-500 mt-1">
                  Zone-wise skill underflow and overflow — where workforce is available and where it is needed.
                </p>
              </div>

              <IndiaHexMap
                selectedSkill={selectedSkill}
                selectedState={selectedState}
                allSkills={skills.length > 0 ? skills : [selectedSkill]}
              />

              <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-5">
                <h3 className="text-sm font-bold text-indigo-800 mb-2">How to read this map</h3>
                <ul className="text-xs text-indigo-700 space-y-1 list-disc pl-4">
                  <li><strong>🔴 Underflow zones</strong> have demand exceeding supply — they need additional workforce.</li>
                  <li><strong>🔵 Overflow zones</strong> have supply exceeding demand — there is available workforce.</li>
                  <li><strong>Arrows</strong> show potential workforce mobility opportunities, sorted by distance (closest first).</li>
                  <li>Use the <strong>time horizon toggle</strong> to see how the mismatch evolves over 12, 24, or 36 months.</li>
                  <li>Click any zone bubble for detailed metrics and specific matching opportunities.</li>
                </ul>
                <p className="text-[10px] text-indigo-500 mt-3 border-t border-indigo-100 pt-2">
                  ⚠ Prototype / Simulated Data — Potential workforce match is calculated from demo data only. Actual mobility depends on wages, eligibility, housing, transport, and individual preferences.
                </p>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}