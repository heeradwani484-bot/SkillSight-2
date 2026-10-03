from pydantic import BaseModel, Field
from typing import List, Optional, Any, Dict
from datetime import datetime

class Metadata(BaseModel):
    source: str
    status: str # "LIVE", "LATEST_AVAILABLE", "SIMULATED"
    fetched_at: str
    data_age_minutes: int

class APIResponse(BaseModel):
    data: Any
    metadata: Metadata

class LabourRecord(BaseModel):
    state: str
    district: str
    sector: str
    skill: str
    historical_demand: int
    current_demand: int
    current_supply: int
    training_capacity: int
    demand_growth_rate: float
    industry_growth_rate: float
    source: str
    confidence_score: int

class DashboardSummary(BaseModel):
    total_demand: int
    total_supply: int
    net_gap: int
    critical_shortages: int
    saturated_trades: int

class DistrictAnalysis(BaseModel):
    state: str
    district: str
    sector: str
    skill: str
    current_demand: int
    current_supply: int
    gap: int
    status: str
    skill_demand_index: int

class ForecastPoint(BaseModel):
    months: int
    demand: int
    supply: int

class ForecastResult(BaseModel):
    skill: str
    current_demand: int
    current_supply: int
    growth_rate: float
    forecasts: List[ForecastPoint]
    confidence_score: int
    confidence_level: str

class Alert(BaseModel):
    skill: str
    location: str
    current_status: str
    predicted_status: str
    time_horizon: str
    severity: str
    reason: str

class Recommendation(BaseModel):
    skill: str
    location: str
    recommendation: str
    reasons: List[str]

class SimulationRequest(BaseModel):
    state: Optional[str] = None
    district: Optional[str] = None
    skill: str
    training_capacity_increase_pct: float

class SimulationResult(BaseModel):
    baseline_demand: int
    baseline_supply: int
    baseline_gap: int
    projected_supply: int
    projected_gap: int
    gap_reduction_pct: float
    status: str

class SkillTransitionTarget(BaseModel):
    target_skill: str
    transferable_skills: List[str]
    missing_skills: List[str]
    suggested_training: str
    difficulty: str
    future_demand_trend: str

class SkillTransitionResult(BaseModel):
    current_skill: str
    transitions: List[SkillTransitionTarget]
