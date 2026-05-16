"""Normalize AI tool inputs to match fines.db / rules.json conventions."""

from __future__ import annotations

# Plain-language offence phrases → offence_code in SQLite
OFFENCE_ALIASES: dict[str, str] = {
    "no helmet": "NO_HELMET",
    "helmet": "NO_HELMET",
    "without helmet": "NO_HELMET",
    "no license": "NO_LICENSE",
    "no licence": "NO_LICENSE",
    "driving without license": "NO_LICENSE",
    "speeding": "SPEED_EXCESS",
    "over speeding": "SPEED_EXCESS",
    "speed excess": "SPEED_EXCESS",
    "drunk driving": "DRUNK_DRIVING",
    "drink driving": "DRUNK_DRIVING",
    "dui": "DRUNK_DRIVING",
    "no insurance": "NO_INSURANCE",
    "mobile phone": "MOBILE_PHONE",
    "phone while driving": "MOBILE_PHONE",
    "red light": "RED_LIGHT_JUMPING",
    "jumping red light": "RED_LIGHT_JUMPING",
    "seatbelt": "NO_SEATBELT",
    "no seatbelt": "NO_SEATBELT",
}

VEHICLE_CLASS_MAP: dict[str, str] = {
    "2W": "TWO_WHEELER",
    "TWO WHEELER": "TWO_WHEELER",
    "TWO-WHEELER": "TWO_WHEELER",
    "BIKE": "TWO_WHEELER",
    "MOTORCYCLE": "TWO_WHEELER",
    "SCOOTER": "TWO_WHEELER",
    "LMV": "LMV",
    "CAR": "LMV",
    "HGV": "HGV",
    "TRUCK": "HGV",
    "BUS": "HGV",
    "3W": "3W",
    "AUTO": "3W",
    "GENERAL": "GENERAL",
    "ALL": "ALL",
}

STATE_MAP: dict[str, str] = {
    "TAMIL NADU": "TN",
    "TAMILNADU": "TN",
    "DELHI": "DL",
    "NCT OF DELHI": "DL",
    "MAHARASHTRA": "MH",
    "KARNATAKA": "KA",
    "KERALA": "KL",
    "ANDHRA PRADESH": "AP",
    "TELANGANA": "TS",
    "WEST BENGAL": "WB",
    "GUJARAT": "GJ",
    "RAJASTHAN": "RJ",
    "UTTAR PRADESH": "UP",
    "PUNJAB": "PB",
    "HARYANA": "HR",
    "ODISHA": "OR",
    "BIHAR": "BR",
    "MADHYA PRADESH": "MP",
}


def normalize_offence_code(offence_type: str) -> str:
    raw = (offence_type or "").strip()
    if not raw:
        return ""
    key = raw.lower().replace("-", " ").replace("_", " ")
    if key in OFFENCE_ALIASES:
        return OFFENCE_ALIASES[key]
    # Already snake case or single token
    return raw.upper().replace(" ", "_").replace("-", "_")


def normalize_vehicle_class(vehicle_class: str) -> str:
    vc = (vehicle_class or "GENERAL").strip().upper().replace("-", " ")
    return VEHICLE_CLASS_MAP.get(vc, vc.replace(" ", "_"))


def normalize_state(state: str) -> str:
    s = (state or "ALL").strip().upper()
    if s in ("ALL", "ANY", "INDIA", "NATIONAL"):
        return "ALL"
    if len(s) <= 3 and s.isalpha():
        return s
    compact = s.replace(" ", "")
    if compact in STATE_MAP:
        return STATE_MAP[compact]
    return STATE_MAP.get(s, s)
