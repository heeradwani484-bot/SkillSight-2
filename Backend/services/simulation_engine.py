import pandas as pd
from typing import Dict, Any

class SimulationEngine:
    def __init__(self, df: pd.DataFrame):
        self.df = df
        
    def simulate(self, skill: str, training_increase_pct: float, state: str = None, district: str = None) -> Dict[str, Any]:
        df = self.df[self.df['skill'].str.lower() == skill.lower()]
        if state: df = df[df['state'].str.lower() == state.lower()]
        if district: df = df[df['district'].str.lower() == district.lower()]
            
        if df.empty:
            return None
            
        baseline_demand = int(df['current_demand'].sum())
        baseline_supply = int(df['current_supply'].sum())
        training_cap = int(df['training_capacity'].sum())
        
        baseline_gap = baseline_demand - baseline_supply
        
        # Simulate: new supply = baseline_supply + (training_cap * (training_increase_pct / 100))
        additional_supply = int(training_cap * (training_increase_pct / 100))
        projected_supply = baseline_supply + additional_supply
        
        projected_gap = baseline_demand - projected_supply
        
        # Calculate reduction % safely
        if baseline_gap > 0:
            reduction_pct = max(0, ((baseline_gap - projected_gap) / baseline_gap) * 100)
        else:
            reduction_pct = 0.0
            
        status = "Shortage" if projected_gap > 0 else "Balanced" if projected_gap > -500 else "Oversupply"
        
        return {
            "baseline_demand": baseline_demand,
            "baseline_supply": baseline_supply,
            "baseline_gap": baseline_gap,
            "projected_supply": projected_supply,
            "projected_gap": projected_gap,
            "gap_reduction_pct": float(reduction_pct),
            "status": status
        }
