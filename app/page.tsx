"use client";
import React, { useState, useEffect, useCallback } from "react";
import {
  AlertTriangle, ShieldCheck, RefreshCw,
  Layers, Activity, Zap, Target, GitBranch, ArrowRight, MapPin
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
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
    <div className="flex h-screen bg-slate-50 text-slate-800 font-sans overflow-hidden">
      {/* ─── SIDEBAR ─────────────────────────────────────────── */}
      <aside className="w-60 bg-slate-900 text-white flex flex-col flex-shrink-0">
        <div className="px-5 py-6">
          <span className="bg-blue-600 text-white text-[10px] font-bold px-2 py-0.5 rounded">SIH 26246</span>
          <h1 className="text-xl font-extrabold tracking-tight mt-2">SkillSight AI</h1>
          <p className="text-xs text-slate-400 mt-0.5">Predictive Labour Market</p>
        </div>

        <nav className="flex-1 px-3 space-y-1">
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-2.5 ${activeTab === item.id
                  ? item.accent ? "bg-indigo-600 text-white" : "bg-blue-600 text-white"
                  : "text-slate-300 hover:bg-slate-800"
                }`}
            >
              {item.icon} {item.label}
            </button>
          ))}
        </nav>

        {/* Data Freshness */}
        <div className="m-3 p-3 bg-slate-800 rounded-lg border border-slate-700">
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
            className="mt-2 w-full bg-slate-700 hover:bg-slate-600 text-xs py-1.5 rounded flex items-center justify-center gap-1 transition-colors"
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
            className="border border-slate-200 rounded-lg px-2 py-1 text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
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
              className="border border-slate-200 rounded-lg px-2 py-1 text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
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
              className="ml-2 border border-blue-200 rounded-lg px-2 py-1 text-sm bg-blue-50 font-medium text-blue-800 focus:ring-2 focus:ring-blue-500 focus:outline-none max-w-xs"
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
            <div className="space-y-6">
              {loading ? (
                <div className="flex items-center justify-center h-32 text-slate-400 animate-pulse">
                  Loading intelligence...
                </div>
              ) : summary && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Demand</p>
                    <h3 className="text-3xl font-extrabold text-slate-900 mt-2">{summary.total_demand.toLocaleString()}</h3>
                  </div>
                  <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Available Supply</p>
                    <h3 className="text-3xl font-extrabold text-slate-900 mt-2">{summary.total_supply.toLocaleString()}</h3>
                  </div>
                  <div className="bg-rose-50 p-5 rounded-xl border border-rose-200 shadow-sm">
                    <p className="text-xs font-bold text-rose-500 uppercase tracking-wider">Critical Shortages</p>
                    <h3 className="text-3xl font-extrabold text-rose-700 mt-2">{summary.critical_shortages}</h3>
                  </div>
                  <div className="bg-emerald-50 p-5 rounded-xl border border-emerald-200 shadow-sm">
                    <p className="text-xs font-bold text-emerald-600 uppercase tracking-wider">Saturated Trades</p>
                    <h3 className="text-3xl font-extrabold text-emerald-700 mt-2">{summary.saturated_trades}</h3>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-3 gap-5">
                {/* Labour table */}
                <div className="col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                  <h3 className="text-base font-bold text-slate-800 mb-3">Labour Market Analytics</h3>
                  <div className="overflow-auto max-h-72">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-slate-50 sticky top-0">
                        <tr>
                          <th className="p-3 font-semibold text-slate-600 text-xs">Location</th>
                          <th className="p-3 font-semibold text-slate-600 text-xs">Skill</th>
                          <th className="p-3 font-semibold text-slate-600 text-xs">D / S</th>
                          <th className="p-3 font-semibold text-slate-600 text-xs">Status</th>
                          <th className="p-3 font-semibold text-slate-600 text-xs">Index</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {districts.map((d, i) => (
                          <tr key={i} className="hover:bg-slate-50 cursor-pointer" onClick={() => { setSelectedSkill(d.skill); setActiveTab("deepdive"); }}>
                            <td className="p-3 text-xs">{d.district} <span className="text-slate-400 block">{d.state}</span></td>
                            <td className="p-3 text-xs font-medium">{d.skill}</td>
                            <td className="p-3 text-xs">{d.current_demand} / {d.current_supply}</td>
                            <td className="p-3">
                              <span className={`px-2 py-0.5 text-[10px] rounded-full font-bold ${d.gap > 0 ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"
                                }`}>{d.status}</span>
                            </td>
                            <td className="p-3">
                              <div className="flex items-center gap-1.5">
                                <div className="flex-1 bg-slate-200 rounded-full h-1.5">
                                  <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${d.skill_demand_index}%` }} />
                                </div>
                                <span className="text-xs font-bold text-slate-600">{d.skill_demand_index}</span>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Early Warnings */}
                <div className="col-span-1 bg-white rounded-xl border border-rose-200 shadow-sm p-5">
                  <h3 className="text-sm font-bold text-rose-800 mb-3 flex items-center gap-2">
                    <AlertTriangle size={15} /> Early Warnings
                  </h3>
                  <div className="space-y-2">
                    {alerts.slice(0, 5).map((a, i) => (
                      <div key={i} className="bg-rose-50 border border-rose-100 p-3 rounded-lg">
                        <p className="text-xs font-bold text-slate-800">{a.skill}</p>
                        <p className="text-xs text-slate-500">{a.location}</p>
                        <p className="text-xs text-rose-600 mt-1">{a.predicted_status} in {a.time_horizon}</p>
                        <p className="text-[10px] text-slate-500 mt-0.5">{a.reason}</p>
                      </div>
                    ))}
                    {alerts.length === 0 && <p className="text-sm text-slate-400">No critical alerts.</p>}
                  </div>
                </div>
              </div>

              {/* Workforce Flow Map in Overview */}
              <IndiaHexMap selectedSkill={selectedSkill} selectedState={selectedState} allSkills={skills.length > 0 ? skills : [selectedSkill]} />
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
                        <div className="text-3xl font-black text-blue-600">{skillData.skill_demand_index}<span className="text-base text-slate-400">/100</span></div>
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
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="text-sm font-bold text-slate-700">Deterministic Forecast (12 / 24 / 36 Months)</h3>
                          <div className="flex items-center gap-1.5">
                            <ShieldCheck size={14} className={forecast.confidence_level === "High" ? "text-green-500" : "text-amber-500"} />
                            <span className="text-xs font-semibold text-slate-600">
                              {forecast.confidence_level} confidence ({forecast.confidence_score}%)
                            </span>
                          </div>
                        </div>
                        <div className="h-52">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={[
                              { label: "Now", demand: forecast.current_demand, supply: forecast.current_supply },
                              ...forecast.forecasts.map((f: any) => ({ label: `+${f.months}m`, demand: f.demand, supply: f.supply }))
                            ]}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#64748b" }} />
                              <YAxis tick={{ fontSize: 11, fill: "#64748b" }} />
                              <Tooltip />
                              <Legend />
                              <Line type="monotone" dataKey="demand" stroke="#3b82f6" strokeWidth={2.5} dot={{ r: 4 }} name="Demand" />
                              <Line type="monotone" dataKey="supply" stroke="#10b981" strokeWidth={2.5} dot={{ r: 4 }} name="Supply" />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Recommendations */}
                  {recommendations.filter(r => r.skill === skillData.skill).length > 0 && (
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
                      <h3 className="text-sm font-bold text-blue-800 mb-3">Explainable Policy Recommendation</h3>
                      {recommendations.filter(r => r.skill === skillData.skill).map((r, i) => (
                        <div key={i}>
                          <p className="text-sm font-semibold text-slate-800 mb-2">{r.recommendation}</p>
                          <ul className="text-xs text-slate-600 space-y-1 list-disc pl-4">
                            {r.reasons.map((reason: string, j: number) => <li key={j}>{reason}</li>)}
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
                  <div className="bg-white rounded-xl border border-indigo-200 shadow-sm p-5">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                          <GitBranch size={16} className="text-indigo-500" /> Workforce Flow Map
                        </h3>
                        <p className="text-xs text-slate-400 mt-0.5">Zone-level underflow and overflow for this skill</p>
                      </div>
                      <button
                        onClick={() => setActiveTab("flowmap")}
                        className="text-xs text-indigo-600 font-bold border border-indigo-200 px-3 py-1.5 rounded-lg hover:bg-indigo-50 transition-colors flex items-center gap-1"
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
                      <h3 className="text-xs font-bold text-blue-500 uppercase tracking-widest">Projected</h3>
                      <div className="space-y-2 bg-blue-50 p-4 rounded-lg border border-blue-200">
                        <div className="flex justify-between text-sm border-b border-blue-100 pb-1.5">
                          <span className="text-slate-500">Demand</span>
                          <span className="font-bold">{simResult.baseline_demand.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-sm border-b border-blue-100 pb-1.5">
                          <span className="text-slate-500">Projected Supply</span>
                          <span className="font-bold text-emerald-600">{simResult.projected_supply.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-sm border-b border-blue-100 pb-1.5">
                          <span className="text-slate-800 font-semibold">Remaining Gap</span>
                          <span className="font-black text-slate-800">{simResult.projected_gap.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-sm pt-1">
                          <span className="text-slate-600 font-semibold">Gap Reduction</span>
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