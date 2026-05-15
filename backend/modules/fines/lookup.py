import sqlite3
from datetime import datetime
import os

class FineLookup:
    def __init__(self, db_path: str):
        self.db_path = db_path
        if not os.path.exists(self.db_path):
            raise FileNotFoundError(f"Database not found at {self.db_path}")

    def query(self, offence_code: str, vehicle_class: str, state: str, repeat: bool = False) -> dict | None:
        """
        Query the fine database for a specific offence and vehicle class in a state.
        Returns: {amount_inr, repeat_amount_inr, section_ref, source_url, fetched_at, state} or None
        """
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        # Build query based on state flexibility
        if state == "ANY":
            query = """
                SELECT amount_inr, repeat_amount_inr, section_ref, source_url, fetched_at, state 
                FROM fines 
                WHERE offence_code = ? AND (vehicle_class = ? OR ? = 'GENERAL' OR vehicle_class = 'ALL')
                LIMIT 1
            """
            cursor.execute(query, (offence_code, vehicle_class, vehicle_class))
        else:
            # Try exact match for state, or "ALL" if state-specific not found
            query = """
                SELECT amount_inr, repeat_amount_inr, section_ref, source_url, fetched_at, state 
                FROM fines 
                WHERE offence_code = ? AND (vehicle_class = ? OR ? = 'GENERAL' OR vehicle_class = 'ALL') AND (state = ? OR state = 'ALL')
                ORDER BY CASE WHEN state = ? THEN 0 ELSE 1 END
                LIMIT 1
            """
            cursor.execute(query, (offence_code, vehicle_class, vehicle_class, state, state))
            
        row = cursor.fetchone()
        conn.close()

        if row:
            data = dict(row)
            if repeat and data['repeat_amount_inr'] is not None:
                data['amount_inr'] = data['repeat_amount_inr']
            return data
        return None

    def query_by_section(self, section_ref: str) -> list[dict]:
        """Query fines by section reference."""
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM fines WHERE section_ref LIKE ?", (f"%{section_ref}%",))
        rows = [dict(row) for row in cursor.fetchall()]
        conn.close()
        return rows

    def get_db_age(self) -> str:
        """Returns human-readable 'last updated X days ago' representation of the database."""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute("SELECT MAX(fetched_at) FROM fines")
        last_updated = cursor.fetchone()[0]
        conn.close()

        if not last_updated:
            return "never updated"

        try:
            dt = datetime.fromisoformat(last_updated)
            diff = datetime.now() - dt
            if diff.days == 0:
                hours = diff.seconds // 3600
                if hours == 0:
                    return "updated less than an hour ago"
                return f"last updated {hours} hours ago"
            return f"last updated {diff.days} days ago"
        except ValueError:
            return "unknown age"
    def get_changes(self, since: str) -> list[dict]:
        """Returns all fines updated since the given ISO timestamp."""
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM fines WHERE fetched_at > ?", (since,))
        rows = [dict(row) for row in cursor.fetchall()]
        conn.close()
        return rows

    def get_all(self) -> list[dict]:
        """Returns all fines in the database."""
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM fines")
        rows = [dict(row) for row in cursor.fetchall()]
        conn.close()
        return rows

    def get_count(self) -> int:
        """Returns total number of fines."""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM fines")
        count = cursor.fetchone()[0]
        conn.close()
        return count
