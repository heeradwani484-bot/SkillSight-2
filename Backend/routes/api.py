from fastapi import APIRouter, Query, HTTPException
from typing import Optional
from cache.data_cache import DataCache
from services.demand_supply_engine import DemandSupplyEngine
from services.forecast_engine import ForecastEngine
from services.alert_engine import AlertEngine
from services.recommendation_engine import RecommendationEngine
from services.simulation_engine import SimulationEngine
from services.skill_transition_engine import SkillTransitionEngine
from services.workforce_mobility_engine import WorkforceMobilityEngine
from models.data_model import (
    APIResponse, DashboardSummary, DistrictAnalysis, 
    ForecastResult, Alert, Recommendation, SimulationRequest, 
    SimulationResult, SkillTransitionResult, Metadata
)

router = APIRouter()
cache = DataCache()
transition_engine = SkillTransitionEngine()

def wrap_response(data: any) -> dict:
    df, meta = cache.get_data()
    return {"data": data, "metadata": meta}

@router.get("/dashboard-summary")
def get_dashboard_summary(state: Optional[str] = None, district: Optional[str] = None):
    df, _ = cache.get_data()
    engine = DemandSupplyEngine(df)
    summary = engine.get_dashboard_summary(state, district)
    return wrap_response(summary)

@router.get("/districts")
def get_districts(state: Optional[str] = None, district: Optional[str] = None):
    df, _ = cache.get_data()
    engine = DemandSupplyEngine(df)
    results = engine.get_districts_analysis(state, district)
    return wrap_response(results)

@router.get("/skills")
def get_skills(state: Optional[str] = None, district: Optional[str] = None):
    df, _ = cache.get_data()
    engine = DemandSupplyEngine(df)
    filtered = engine.filter_data(state, district)
    skills = filtered['skill'].unique().tolist()
    return wrap_response(skills)

@router.get("/skill/{skill}")
def get_skill(skill: str, state: Optional[str] = None, district: Optional[str] = None):
    df, _ = cache.get_data()
    engine = DemandSupplyEngine(df)
    results = engine.get_districts_analysis(state, district)
    skill_data = [r for r in results if r['skill'].lower() == skill.lower()]
    if not skill_data:
        raise HTTPException(status_code=404, detail="Skill not found")
    # For MVP, just return the first matching or aggregate. The get_districts_analysis is per district,
    # so we might return a list of district details for this skill, or if district is provided, just one.
    return wrap_response(skill_data)

@router.get("/forecast/{skill}")
def get_forecast(skill: str, state: Optional[str] = None, district: Optional[str] = None):
    df, _ = cache.get_data()
    engine = ForecastEngine(df)
    forecast = engine.get_forecast(skill, state, district)
    if not forecast:
        raise HTTPException(status_code=404, detail="Skill not found for forecasting")
    return wrap_response(forecast)

@router.get("/alerts")
def get_alerts(state: Optional[str] = None, district: Optional[str] = None):
    df, _ = cache.get_data()
    f_engine = ForecastEngine(df)
    engine = AlertEngine(f_engine)
    alerts = engine.get_alerts(state, district)
    return wrap_response(alerts)

@router.get("/recommendations")
def get_recommendations(state: Optional[str] = None, district: Optional[str] = None):
    df, _ = cache.get_data()
    f_engine = ForecastEngine(df)
    engine = RecommendationEngine(f_engine)
    recs = engine.get_recommendations(state, district)
    return wrap_response(recs)

@router.post("/simulate")
def simulate(req: SimulationRequest):
    df, _ = cache.get_data()
    engine = SimulationEngine(df)
    res = engine.simulate(req.skill, req.training_capacity_increase_pct, req.state, req.district)
    if not res:
        raise HTTPException(status_code=404, detail="Simulation data not found")
    return wrap_response(res)

@router.get("/skill-transition/{skill}")
def get_skill_transition(skill: str):
    res = transition_engine.get_transitions(skill)
    return wrap_response(res)

@router.get("/workforce-map")
def get_workforce_map(
    skill: str,
    state: Optional[str] = None,
    horizon: str = "current"
):
    df, _ = cache.get_data()
    engine = WorkforceMobilityEngine(df)
    result = engine.get_mobility_map(skill, horizon, state)
    return wrap_response(result)
