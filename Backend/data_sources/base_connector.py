from abc import ABC, abstractmethod
from typing import List, Dict, Any
from datetime import datetime, timezone

class BaseConnector(ABC):
    def __init__(self, name: str, status: str):
        self.name = name
        self.status = status # "LIVE", "LATEST_AVAILABLE", "SIMULATED"
    
    @abstractmethod
    def fetch_data(self) -> List[Dict[str, Any]]:
        pass
    
    def get_metadata(self) -> Dict[str, Any]:
        return {
            "source": self.name,
            "status": self.status,
            "fetched_at": datetime.now(timezone.utc).isoformat()
        }
