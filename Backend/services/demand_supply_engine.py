import pandas as pd
from typing import Dict, Any

class DemandSupplyEngine:
    def __init__(self, df: pd.DataFrame):
        self.df = df
        
    def calculate_skill_demand_index(self, row) -> int:
        # 30% Current Demand (normalized roughly assuming max ~10k)
        # 25% Demand Growth
        # 25% Supply Gap
        # 20% Future Growth (using industry growth as proxy)
        
        # very simple normalization for prototype
        demand_score = min(row['current_demand'] / 10000 * 100, 100) * 0.30
        growth_score = max(min(row['demand_growth_rate'] * 100 * 2, 100), 0) * 0.25
        
        gap = row['current_demand'] - row['current_supply']
        gap_score = max(min((gap / max(row['current_demand'], 1)) * 100 + 50, 100), 0) * 0.25
        
        future_growth = max(min(row['industry_growth_rate'] * 100 * 2, 100), 0) * 0.20
        
        index = int(demand_score + growth_score + gap_score + future_growth)
        return max(min(index, 100), 0)

    def get_market_status(self, gap: int) -> str:
        if gap > 500:
            return "Critical Shortage"
        elif gap > 0:
            return "Shortage"
        elif gap < -500:
            return "Saturated / Oversupply"
        elif gap < 0:
            return "Oversupply"
        else:
            return "Balanced Market"

    def filter_data(self, state: str = None, district: str = None, skill: str = None) -> pd.DataFrame:
        df = self.df.copy()
        if state:
            df = df[df['state'].str.lower() == state.lower()]
        if district:
            df = df[df['district'].str.lower() == district.lower()]
        if skill:
            df = df[df['skill'].str.lower() == skill.lower()]
        return df

    def get_dashboard_summary(self, state: str = None, district: str = None) -> Dict[str, Any]:
        df = self.filter_data(state, district)
        if df.empty:
            return {"total_demand": 0, "total_supply": 0, "net_gap": 0, "critical_shortages": 0, "saturated_trades": 0}
            
        total_demand = int(df["current_demand"].sum())
        total_supply = int(df["current_supply"].sum())
        
        # Calculate gaps to find shortages/saturated
        df['gap'] = df['current_demand'] - df['current_supply']
        critical_shortages = int((df['gap'] > 500).sum())
        saturated = int((df['gap'] < -100).sum())
        
        return {
            "total_demand": total_demand,
            "total_supply": total_supply,
            "net_gap": total_demand - total_supply,
            "critical_shortages": critical_shortages,
            "saturated_trades": saturated
        }
        
    def get_districts_analysis(self, state: str = None, district: str = None) -> list:
        df = self.filter_data(state, district)
        results = []
        for _, row in df.iterrows():
            gap = int(row['current_demand'] - row['current_supply'])
            results.append({
                "state": row['state'],
                "district": row['district'],
                "sector": row['sector'],
                "skill": row['skill'],
                "current_demand": int(row['current_demand']),
                "current_supply": int(row['current_supply']),
                "gap": gap,
                "status": self.get_market_status(gap),
                "skill_demand_index": self.calculate_skill_demand_index(row)
            })
        return results
