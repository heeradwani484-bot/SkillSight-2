import pandas as pd
from typing import Dict, Any, List

class ForecastEngine:
    def __init__(self, df: pd.DataFrame):
        self.df = df
        
    def _determine_confidence_level(self, score: int) -> str:
        if score >= 85: return "High"
        if score >= 70: return "Medium"
        return "Low"
        
    def get_forecast(self, skill: str, state: str = None, district: str = None) -> Dict[str, Any]:
        df = self.df[self.df['skill'].str.lower() == skill.lower()]
        if state:
            df = df[df['state'].str.lower() == state.lower()]
        if district:
            df = df[df['district'].str.lower() == district.lower()]
            
        if df.empty:
            return None
            
        # Aggregate if multiple rows match
        current_demand = df['current_demand'].sum()
        current_supply = df['current_supply'].sum()
        growth_rate = df['demand_growth_rate'].mean()
        conf_score = int(df['confidence_score'].mean())
        
        forecasts = []
        for months in [12, 24, 36]:
            years = months / 12.0
            projected_demand = int(current_demand * ((1 + growth_rate) ** years))
            # simple assumption for supply: grows half as fast as demand unless specified
            supply_growth = max(growth_rate * 0.5, 0.02)
            projected_supply = int(current_supply * ((1 + supply_growth) ** years))
            
            forecasts.append({
                "months": months,
                "demand": projected_demand,
                "supply": projected_supply
            })
            
        return {
            "skill": skill,
            "current_demand": int(current_demand),
            "current_supply": int(current_supply),
            "growth_rate": float(growth_rate),
            "forecasts": forecasts,
            "confidence_score": conf_score,
            "confidence_level": self._determine_confidence_level(conf_score)
        }
