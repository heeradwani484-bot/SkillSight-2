import pandas as pd
from typing import Dict, Any, List
import math

class WorkforceMobilityEngine:
    def __init__(self, df: pd.DataFrame):
        self.df = df
        
    def _haversine(self, lat1, lon1, lat2, lon2):
        R = 6371.0
        lat1_rad = math.radians(lat1)
        lon1_rad = math.radians(lon1)
        lat2_rad = math.radians(lat2)
        lon2_rad = math.radians(lon2)
        
        dlon = lon2_rad - lon1_rad
        dlat = lat2_rad - lat1_rad
        
        a = math.sin(dlat / 2)**2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(dlon / 2)**2
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
        return R * c

    def get_mobility_map(self, skill: str, horizon: str = "current", state: str = None) -> Dict[str, Any]:
        if not skill or skill.lower() in ["all", "all skills", "national"]:
            df = self.df.copy()
        else:
            df = self.df[self.df['skill'].str.lower() == skill.lower()].copy()

        if state:
            df = df[df['state'].str.lower() == state.lower()]
            
        if df.empty:
            return {
                "zones": [],
                "underflow_zones": [],
                "overflow_zones": [],
                "balanced_zones": [],
                "potential_flows": []
            }
            
        zones = []
        underflow = []
        overflow = []
        balanced = []
        
        # Calculate years multiplier for horizon
        years = 0
        if horizon == '12m': years = 1.0
        elif horizon == '18m': years = 1.5
        elif horizon == '24m': years = 2.0
        elif horizon == '36m': years = 3.0
            
        for _, row in df.iterrows():
            current_demand = int(row['current_demand'])
            current_supply = int(row['current_supply'])
            growth = float(row['demand_growth_rate'])
            training_cap = int(row.get('training_capacity', current_supply))
            
            supply_growth = max(growth * 0.5, 0.02)
            
            # Forecasts for 12, 18, 24, 36 months
            trajectories = {}
            for h_key, h_years in [("current", 0), ("12m", 1.0), ("18m", 1.5), ("24m", 2.0), ("36m", 3.0)]:
                d_proj = int(current_demand * ((1 + growth) ** h_years))
                s_proj = int(current_supply * ((1 + supply_growth) ** h_years))
                trajectories[h_key] = {
                    "demand": d_proj,
                    "supply": s_proj,
                    "gap": d_proj - s_proj
                }
            
            calc_demand = trajectories.get(horizon, trajectories["current"])["demand"]
            calc_supply = trajectories.get(horizon, trajectories["current"])["supply"]
            gap = calc_demand - calc_supply
            gap_pct = round((gap / calc_demand) * 100, 1) if calc_demand > 0 else 0.0
            
            status = "Balanced"
            if gap > 150:
                status = "Underflow"
            elif gap < -150:
                status = "Overflow"
                
            severity = "High" if abs(gap) > 800 else "Medium" if abs(gap) > 300 else "Low"
            
            # Formulate early warning for this zone
            warning = None
            if gap > 500 and growth > 0.15:
                warning = f"Critical workforce deficit in {row['district']}! Projected demand outpaces supply by {gap} seats within {horizon if horizon != 'current' else '12m'} due to {growth*100:.0f}% annual growth."
            elif gap < -300:
                warning = f"Workforce saturation warning in {row['district']}: Supply exceeds active industry hiring demand by {abs(gap)} seats."
            else:
                warning = f"Stable demand-supply equilibrium maintained in {row['district']} industrial cluster."
                
            # Formulate policy intervention recommendation
            if status == "Underflow":
                rec = f"Action Required: Expand ITI/PMKVY training capacity by +{int(gap * 0.5)} seats in {row['district']} ({row.get('cluster_name', 'Industrial Zone')}). Facilitate inter-district workforce mobility."
            elif status == "Overflow":
                rec = f"Policy Action: Divert excess training capacity (-{int(abs(gap) * 0.4)} seats) from {row['district']} towards active underflow hubs."
            else:
                rec = f"Maintain stable training allocation of {training_cap} seats in {row['district']}."

            zone_data = {
                "id": f"{row['district']}-{row['state']}",
                "district": row['district'],
                "state": row['state'],
                "lat": float(row.get('lat', 0)),
                "lng": float(row.get('lng', 0)),
                "sector": row.get('sector', 'General'),
                "skill": row['skill'],
                "nco_code": str(row.get('nco_code', 'NCO-2015/7412.0100')),
                "cluster_name": str(row.get('cluster_name', f"{row['district']} Industrial Hub")),
                "demand": calc_demand,
                "supply": calc_supply,
                "gap": gap,
                "gap_percentage": gap_pct,
                "training_capacity": training_cap,
                "status": status,
                "severity": severity,
                "growth_rate": round(growth * 100, 1),
                "trajectories": trajectories,
                "warning": warning,
                "recommendation": rec
            }
            
            zones.append(zone_data)
            
            if status == "Underflow": underflow.append(zone_data)
            elif status == "Overflow": overflow.append(zone_data)
            else: balanced.append(zone_data)
            
        # Calculate potential matching flows
        flows = []
        for uz in underflow:
            for oz in overflow:
                available = abs(oz['gap'])
                needed = uz['gap']
                potential_match = min(available, needed)
                
                dist = 0
                if uz['lat'] and oz['lat']:
                    dist = self._haversine(uz['lat'], uz['lng'], oz['lat'], oz['lng'])
                
                if potential_match > 30:
                    flows.append({
                        "source": oz['id'],
                        "source_name": oz['district'],
                        "source_state": oz['state'],
                        "target": uz['id'],
                        "target_name": uz['district'],
                        "target_state": uz['state'],
                        "potential_match": potential_match,
                        "distance_km": int(dist),
                        "source_lat": oz['lat'],
                        "source_lng": oz['lng'],
                        "target_lat": uz['lat'],
                        "target_lng": uz['lng'],
                        "vector_code": f"VEC-{oz['district'][:3].upper()}2{uz['district'][:3].upper()}"
                    })
                    
        flows = sorted(flows, key=lambda x: (x['distance_km'], -x['potential_match']))

        # Compute Macro Regional Zones (North, West, South, East, Central, North-East)
        state_to_zone_id = {
            "delhi": "north", "haryana": "north", "punjab": "north", "himachal pradesh": "north",
            "jammu and kashmir": "north", "ladakh": "north", "chandigarh": "north", "rajasthan": "north",
            "uttar pradesh": "north", "uttaranchal": "north", "uttarakhand": "north",
            "maharashtra": "west", "gujarat": "west", "goa": "west", "dadra and nagar haveli": "west", "daman and diu": "west",
            "karnataka": "south", "tamil nadu": "south", "telangana": "south", "andhra pradesh": "south",
            "kerala": "south", "puducherry": "south", "lakshadweep": "south",
            "west bengal": "east", "bihar": "east", "jharkhand": "east", "orissa": "east", "odisha": "east", "andaman and nicobar": "east",
            "madhya pradesh": "central", "chhattisgarh": "central",
            "assam": "northeast", "meghalaya": "northeast", "arunachal pradesh": "northeast",
            "manipur": "northeast", "mizoram": "northeast", "nagaland": "northeast", "sikkim": "northeast", "tripura": "northeast"
        }

        zone_defs = [
            {"id": "north", "name": "North Zone", "states": ["Delhi", "Haryana", "Punjab", "Himachal Pradesh", "Jammu and Kashmir", "Ladakh", "Chandigarh", "Rajasthan", "Uttar Pradesh", "Uttarakhand"]},
            {"id": "west", "name": "West Zone", "states": ["Maharashtra", "Gujarat", "Goa", "Dadra and Nagar Haveli", "Daman and Diu"]},
            {"id": "south", "name": "South Zone", "states": ["Karnataka", "Tamil Nadu", "Telangana", "Andhra Pradesh", "Kerala", "Puducherry", "Lakshadweep"]},
            {"id": "east", "name": "East Zone", "states": ["West Bengal", "Bihar", "Jharkhand", "Odisha", "Andaman and Nicobar"]},
            {"id": "central", "name": "Central Zone", "states": ["Madhya Pradesh", "Chhattisgarh"]},
            {"id": "northeast", "name": "North-East Zone", "states": ["Assam", "Meghalaya", "Arunachal Pradesh", "Manipur", "Mizoram", "Nagaland", "Sikkim", "Tripura"]}
        ]

        regional_zones = []
        for zd in zone_defs:
            zid = zd["id"]
            z_districts = [z for z in zones if state_to_zone_id.get(z["state"].lower()) == zid]
            
            z_demand = sum(z["demand"] for z in z_districts)
            z_supply = sum(z["supply"] for z in z_districts)
            z_capacity = sum(z["training_capacity"] for z in z_districts)
            z_gap = z_demand - z_supply
            z_gap_pct = round((z_gap / z_demand) * 100, 1) if z_demand > 0 else 0.0
            z_ratio = round((z_supply / z_demand), 2) if z_demand > 0 else (1.0 if z_supply > 0 else 0.0)

            # Trajectories aggregation for zone
            z_trajectories = {}
            for h in ["current", "12m", "18m", "24m", "36m"]:
                h_d = sum(z["trajectories"].get(h, {}).get("demand", 0) for z in z_districts)
                h_s = sum(z["trajectories"].get(h, {}).get("supply", 0) for z in z_districts)
                z_trajectories[h] = {"demand": h_d, "supply": h_s, "gap": h_d - h_s}

            if not z_districts:
                status = "Inactive"
                color = "#475569" # slate neutral
                rec = f"No active {skill} telemetry recorded in {zd['name']}."
            elif z_gap > 100:
                status = "Underflow" # Deficit / Shortage
                color = "#ef4444" # RED
                rec = f"High priority: Expand training capacity by +{int(z_gap * 0.45)} seats and attract surplus inflow from West/East corridors."
            elif z_gap < -100:
                status = "Overflow" # Surplus Supply
                color = "#10b981" # GREEN
                rec = f"Talent exporter: Facilitate out-of-zone hiring agreements and redeploy +{int(abs(z_gap) * 0.35)} trainees into deficit corridors."
            else:
                status = "Balanced" # Balanced Supply
                color = "#f59e0b" # YELLOW
                rec = f"Stable equilibrium: Supply matches current industry intake ({z_supply} vs {z_demand})."

            regional_zones.append({
                "id": zid,
                "name": zd["name"],
                "states": zd["states"],
                "active_states": list(set(z["state"] for z in z_districts)),
                "active_districts": [z["district"] for z in z_districts],
                "clusters": [z["cluster_name"] for z in z_districts],
                "demand": z_demand,
                "supply": z_supply,
                "training_capacity": z_capacity,
                "gap": z_gap,
                "gap_percentage": z_gap_pct,
                "supply_ratio": z_ratio,
                "status": status,
                "color": color,
                "trajectories": z_trajectories,
                "recommendation": rec
            })

        # Compute State Zones
        state_zones = []
        states_seen = set(z["state"] for z in zones)
        for st_name in sorted(states_seen):
            st_districts = [z for z in zones if z["state"].lower() == st_name.lower()]
            s_demand = sum(z["demand"] for z in st_districts)
            s_supply = sum(z["supply"] for z in st_districts)
            s_gap = s_demand - s_supply
            s_gap_pct = round((s_gap / s_demand) * 100, 1) if s_demand > 0 else 0.0
            
            s_status = "Balanced"
            s_color = "#f59e0b"
            if s_gap > 80:
                s_status = "Underflow"
                s_color = "#ef4444"
            elif s_gap < -80:
                s_status = "Overflow"
                s_color = "#10b981"

            state_zones.append({
                "id": st_name.lower().replace(" ", "-"),
                "name": st_name,
                "zone_id": state_to_zone_id.get(st_name.lower(), "central"),
                "demand": s_demand,
                "supply": s_supply,
                "gap": s_gap,
                "gap_percentage": s_gap_pct,
                "status": s_status,
                "color": s_color,
                "districts": [z["district"] for z in st_districts]
            })

        return {
            "zones": zones,
            "regional_zones": regional_zones,
            "state_zones": state_zones,
            "underflow_zones": underflow,
            "overflow_zones": overflow,
            "balanced_zones": balanced,
            "potential_flows": flows
        }

