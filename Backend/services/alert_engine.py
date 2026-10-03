from typing import List, Dict, Any
from services.forecast_engine import ForecastEngine

class AlertEngine:
    def __init__(self, forecast_engine: ForecastEngine):
        self.forecast_engine = forecast_engine
        
    def get_alerts(self, state: str = None, district: str = None) -> List[Dict[str, Any]]:
        # For prototype, we just look at unique skills in the dataset matching filter
        df = self.forecast_engine.df.copy()
        if state: df = df[df['state'].str.lower() == state.lower()]
        if district: df = df[df['district'].str.lower() == district.lower()]
        
        alerts = []
        skills = df['skill'].unique()
        
        for skill in skills:
            forecast_res = self.forecast_engine.get_forecast(skill, state, district)
            if not forecast_res: continue
            
            f24 = next((f for f in forecast_res['forecasts'] if f['months'] == 24), None)
            if not f24: continue
            
            current_gap = forecast_res['current_demand'] - forecast_res['current_supply']
            future_gap = f24['demand'] - f24['supply']
            
            loc = district if district else (state if state else "National")
            
            if future_gap > 1000 and forecast_res['growth_rate'] > 0.15:
                alerts.append({
                    "skill": skill,
                    "location": loc,
                    "current_status": "Shortage" if current_gap > 0 else "Balanced",
                    "predicted_status": "Critical Shortage",
                    "time_horizon": "24 months",
                    "severity": "High",
                    "reason": f"Demand expected to grow significantly faster ({forecast_res['growth_rate']*100:.1f}% annual) than workforce supply."
                })
            elif future_gap < -500 and forecast_res['growth_rate'] < 0.05:
                alerts.append({
                    "skill": skill,
                    "location": loc,
                    "current_status": "Saturated" if current_gap < -100 else "Balanced",
                    "predicted_status": "Oversupply",
                    "time_horizon": "24 months",
                    "severity": "Medium",
                    "reason": "Declining or stagnant demand while training output remains high."
                })
                
        return alerts
