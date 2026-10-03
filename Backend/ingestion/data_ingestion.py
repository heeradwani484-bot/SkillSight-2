from typing import List, Dict, Any, Tuple
from data_sources.csv_connector import CSVPrototypeConnector
import pandas as pd
from datetime import datetime, timezone

class DataIngestion:
    def __init__(self):
        # We can add NCS, eShram connectors here later
        self.connectors = [CSVPrototypeConnector()]
        
    def ingest_all(self) -> Tuple[pd.DataFrame, Dict[str, Any]]:
        # In MVP, just use the first available connector that returns data
        for connector in self.connectors:
            data = connector.fetch_data()
            if data:
                metadata = connector.get_metadata()
                return pd.DataFrame(data), metadata
        
        return pd.DataFrame(), {"source": "None", "status": "SIMULATED", "fetched_at": datetime.now(timezone.utc).isoformat()}
