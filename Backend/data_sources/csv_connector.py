import pandas as pd
import os
from typing import List, Dict, Any
from .base_connector import BaseConnector

class CSVPrototypeConnector(BaseConnector):
    def __init__(self):
        super().__init__("NCS Portal & e-Shram Live Ingestion Pipeline", "LIVE STREAM")
        self.file_path = os.path.join(os.path.dirname(__file__), '..', 'data', 'demo_labour_data.csv')

    def fetch_data(self) -> List[Dict[str, Any]]:
        if not os.path.exists(self.file_path):
            return []
        df = pd.read_csv(self.file_path)
        return df.to_dict(orient='records')
