import os
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi import FastAPI, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from datetime import datetime
from pydantic import BaseModel, Field
from typing import Optional, Dict, List
from dotenv import load_dotenv
import json

# Load .env for GEMINI_API_KEY
load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), '.env'))

# Import Modules
from backend.modules.agent.engine import AgentEngine
from backend.modules.fines.lookup import FineLookup
from backend.modules.rules.loader import RulesLoader
from backend.modules.geofencing.engine import GeofencingEngine
from backend.modules.sync.router import router as sync_router

class UTF8JSONResponse(JSONResponse):
    """Preserve ₹ and other Unicode in JSON responses."""

    def render(self, content) -> bytes:
        return json.dumps(content, ensure_ascii=False).encode("utf-8")


app = FastAPI(
    title="DriveLegal API",
    description="AI-powered Indian traffic law assistant with agentic tool calling.",
    version="2.0.0",
    default_response_class=UTF8JSONResponse,
)

# ── CORS (required for web/browser clients) ───────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],      # Tighten to your domain in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {
        "message": "Welcome to DriveLegal API",
        "docs": "/docs",
        "health": "/health",
        "status": "online"
    }

# ── Data paths ────────────────────────────────────────────────────────────────
DATA_DIR   = os.path.join(os.path.dirname(__file__), "data")
FINES_DB   = os.path.join(DATA_DIR, "fines.db")
RULES_JSON = os.path.join(DATA_DIR, "rules.json")
ZONES_DIR  = os.path.join(DATA_DIR, "zones")

os.makedirs(DATA_DIR, exist_ok=True)

# ── Initialize backend modules ────────────────────────────────────────────────
fine_lookup    = FineLookup(FINES_DB)   if os.path.exists(FINES_DB)   else None
rules_loader   = RulesLoader(RULES_JSON)
geofencing     = GeofencingEngine(ZONES_DIR)

# ── Initialize the AI Agent ───────────────────────────────────────────────────
agent = AgentEngine(fine_lookup, rules_loader, geofencing)

# ── Request / Response Models ─────────────────────────────────────────────────

class QueryRequest(BaseModel):
    text: str
    gps: Optional[Dict[str, float]] = None
    # Conversation history for multi-turn context
    # Each entry: {"role": "user"|"model", "parts": ["message text"]}
    history: List[Dict] = Field(default_factory=list)


class ChallanRequest(BaseModel):
    vehicle_number: str


# ── Routes ────────────────────────────────────────────────────────────────────

@app.post("/query")
async def handle_query(request: QueryRequest = Body(...)):
    """
    Main AI agent endpoint.
    
    The agent (Gemini 1.5 Flash) autonomously decides which tools to call
    (fine lookup, rule lookup, zone check) and synthesizes a natural language
    response grounded in real data.
    
    Falls back to keyword-based matching if GEMINI_API_KEY is not configured.
    """
    result = agent.run(
        user_text=request.text,
        conversation_history=request.history,
        gps=request.gps,
    )
    result["citations"] = _citations_from_tools(result.get("tools_used") or [])
    return result


def _citations_from_tools(tools_used: list) -> list:
    """Human-readable source lines for the mobile trust footer."""
    lines = []
    for entry in tools_used:
        tool = entry.get("tool")
        res = entry.get("result") or {}
        if tool == "lookup_fine" and res.get("found"):
            section = res.get("section_ref") or "MV Act"
            amt = res.get("amount_inr")
            when = res.get("data_as_of") or res.get("fetched_at") or ""
            lines.append(f"{section}: ₹{amt} (local fines.db{f', updated {when[:10]}' if when else ''})")
        elif tool == "lookup_rule" and res.get("found"):
            lines.append(f"{res.get('section') or res.get('rule_id')}: rules.json")
    if not lines and tools_used:
        lines.append("AI synthesis — confirm on official portals")
    return lines


@app.post("/challan/calculate")
async def calculate_challan(request: ChallanRequest = Body(...)):
    """
    Look up pending challans by vehicle registration number.
    Currently uses mock data — integrate with official Parivahan API for production.
    """
    v_num = request.vehicle_number.upper().replace(" ", "").replace("-", "")

    demo_notice = (
        "Demo sample data only — not linked to Parivahan / eChallan. "
        "Do not use for real payment decisions."
    )

    if "TN" in v_num:
        return {
            "demo": True,
            "demo_notice": demo_notice,
            "vehicle_number": request.vehicle_number,
            "owner": "J*** S***",
            "vehicle_type": "Motor Car (LMV)",
            "pending_challans": [
                {"date": "2024-03-15", "violation": "Over Speeding",     "amount": 1000, "status": "Pending", "location": "Anna Salai, Chennai"},
                {"date": "2024-04-02", "violation": "No Helmet (Pillion)", "amount": 500,  "status": "Pending", "location": "OMR, Chennai"},
            ],
            "total_fine": 1500,
            "last_updated": datetime.now().isoformat(),
        }
    elif "DL" in v_num:
        return {
            "demo": True,
            "demo_notice": demo_notice,
            "vehicle_number": request.vehicle_number,
            "owner": "A*** K***",
            "vehicle_type": "Two Wheeler",
            "pending_challans": [
                {"date": "2024-02-10", "violation": "Red Light Jumping", "amount": 1000, "status": "Pending", "location": "Connaught Place, Delhi"},
            ],
            "total_fine": 1000,
            "last_updated": datetime.now().isoformat(),
        }
    else:
        return {
            "demo": True,
            "demo_notice": demo_notice,
            "vehicle_number": request.vehicle_number,
            "owner": "N/A",
            "vehicle_type": "Unknown",
            "pending_challans": [],
            "total_fine": 0,
            "last_updated": datetime.now().isoformat(),
            "message": "No pending challans found for this vehicle number.",
        }


@app.get("/health")
async def get_health():
    """Server and database status."""
    db_age       = fine_lookup.get_db_age() if fine_lookup else "DB not found"
    rules_count  = len(rules_loader.rules)  if rules_loader else 0
    agent_mode = "keyword-fallback"
    if agent.ollama_available:
        agent_mode = f"ollama/{agent.ollama_model}"
    elif agent.gemini_available:
        agent_mode = "gemini-2.0-flash"
    return {
        "status":        "ok",
        "agent_mode":    agent_mode,
        "db_age":        db_age,
        "rules_count":   rules_count,
        "chat_handler":  "v3-memory",
    }


# ── Sync router (for mobile offline sync) ─────────────────────────────────────
app.include_router(sync_router)


if __name__ == "__main__":
    from multiprocessing import freeze_support
    freeze_support()
    import uvicorn
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)
