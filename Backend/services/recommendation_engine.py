from typing import List, Dict, Any
from services.forecast_engine import ForecastEngine

class RecommendationEngine:
    def __init__(self, forecast_engine: ForecastEngine):
        self.forecast_engine = forecast_engine
        
    def get_recommendations(self, state: str = None, district: str = None) -> List[Dict[str, Any]]:
        df = self.forecast_engine.df.copy()
        if state: df = df[df['state'].str.lower() == state.lower()]
        if district: df = df[df['district'].str.lower() == district.lower()]
        
        recommendations = []
        skills = df['skill'].unique()
        
        for skill in skills:
            f_res = self.forecast_engine.get_forecast(skill, state, district)
            if not f_res: continue
            
            loc = district if district else (state if state else "National")
            f24 = next((f for f in f_res['forecasts'] if f['months'] == 24), None)
            
            if f24 and (f24['demand'] - f24['supply'] > 500):
                gap = f24['demand'] - f24['supply']
                recommendations.append({
                    "skill": skill,
                    "location": loc,
                    "recommendation": f"Increase {skill} training capacity by at least {int(gap * 0.8)} seats.",
                    "reasons": [
                        f"Projected demand is growing by {f_res['growth_rate']*100:.1f}% annually.",
                        "Current supply is below demand.",
                        f"Projected shortage in 24 months is {gap} workers."
                    ]
                })
            elif f24 and (f24['demand'] - f24['supply'] < -500):
                recommendations.append({
                    "skill": skill,
                    "location": loc,
                    "recommendation": f"Freeze or divert seat allocations for {skill}.",
                    "reasons": [
                        "Current supply exceeds demand.",
                        "Low projected demand growth.",
                        "Risk of workforce saturation."
                    ]
                })
                
        return recommendations
