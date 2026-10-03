from typing import List, Dict, Any

class SkillTransitionEngine:
    def __init__(self):
        # Rule-based transition mapping for MVP
        self.transitions = {
            "data entry operator": [
                {
                    "target_skill": "Junior Data Analyst",
                    "transferable_skills": ["Excel", "Data Handling", "Documentation"],
                    "missing_skills": ["SQL", "Basic Python", "Data Visualization"],
                    "suggested_training": "3-month SQL and Tableau Bootcamp",
                    "difficulty": "Moderate",
                    "future_demand_trend": "High Growth"
                },
                {
                    "target_skill": "Data Operations Associate",
                    "transferable_skills": ["Keyboarding", "Data Validation"],
                    "missing_skills": ["ERP Systems", "Quality Assurance"],
                    "suggested_training": "1-month ERP fundamentals",
                    "difficulty": "Low",
                    "future_demand_trend": "Stable"
                }
            ],
            "cnc precision machinist": [
                {
                    "target_skill": "Robotics Technician",
                    "transferable_skills": ["Precision Manufacturing", "Blueprint Reading", "Tooling"],
                    "missing_skills": ["Basic Electronics", "PLC Programming"],
                    "suggested_training": "6-month Industrial Automation Certification",
                    "difficulty": "Moderate",
                    "future_demand_trend": "Critical Shortage"
                }
            ]
        }
        
    def get_transitions(self, skill: str) -> Dict[str, Any]:
        targets = self.transitions.get(skill.lower(), [])
        
        # fallback for unknown skills
        if not targets:
            targets = [{
                "target_skill": "Adjacent Technical Role",
                "transferable_skills": ["Core competency in " + skill],
                "missing_skills": ["Digital literacy for sector"],
                "suggested_training": "Sector-specific digital upskilling",
                "difficulty": "Unknown",
                "future_demand_trend": "Stable"
            }]
            
        return {
            "current_skill": skill,
            "transitions": targets
        }
