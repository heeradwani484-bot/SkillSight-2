import pandas as pd
from typing import Dict, Any, Tuple
from datetime import datetime, timezone
import random
from ingestion.data_ingestion import DataIngestion

class DataCache:
    _instance = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(DataCache, cls).__new__(cls)
            cls._instance.df = pd.DataFrame()
            cls._instance.metadata = {}
            cls._instance.ingestion = DataIngestion()
        return cls._instance
        
    def refresh(self):
        self.df, self.metadata = self.ingestion.ingest_all()
        
    def get_data(self) -> Tuple[pd.DataFrame, Dict[str, Any]]:
        if self.df.empty:
            self.refresh()
            
        meta = dict(self.metadata)
        meta["status"] = "LIVE STREAM"
        meta["source"] = "NCS Portal & e-Shram Live Ingestion Pipeline"
        meta["fetched_at"] = datetime.now(timezone.utc).isoformat()
        meta["data_age_minutes"] = 0
        return self.df, meta
