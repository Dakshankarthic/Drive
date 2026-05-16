# DriveLegal — demo script (hackathon / portfolio)

Use this when you are **new** and want to **showcase** the app honestly.

## 30-second pitch

> "DriveLegal is an AI traffic-law assistant for India. It answers questions in plain language, looks up **real fine amounts** from our local database—not guesses—and runs **fully local AI** with Ollama. Challan lookup is **demo data** and labeled clearly; we are not pretending to be the government."

## Before you present

1. Run `D:\drive\scripts\start-dev.ps1`
2. Open http://127.0.0.1:8000/health — show `agent_mode: ollama/...` and `chat_handler: v3-memory`
3. Open http://localhost:8081 → **You** → set **your real name** in profile
4. **New chat** in **Ask** tab

## Live demo flow (3 minutes)

| Step | You say | You show |
|------|---------|----------|
| 1 | "Personal greeting from profile" | Ask tab welcome uses your name |
| 2 | "Helmet fine in Tamil Nadu for a bike" | AI answer + **Source: Section … · ₹ from DB** footer |
| 3 | "What about the 5th time?" | Follow-up uses **chat memory** |
| 4 | "Which model runs this?" | Answers `qwen2.5-coder:7b` via Ollama |
| 5 | "Challan lookup is demo only" | Challan calculator → **DEMO DATA** banner, try `TN01AB1234` |

## What to say when judges ask "Is it reliable?"

- **Fines / rules:** Grounded in `fines.db` + `rules.json` (MV Act dataset); cite section in the UI.
- **AI:** Local Ollama; can still misunderstand—always verify on MoRTH / eChallan.
- **Challan:** Demo mock—not Parivahan.
- **Not** legal advice; informational only.

## Good screenshot shots

1. Ask tab with trust banner + sourced fine answer  
2. Health JSON in browser (`/health`)  
3. Challan screen with yellow **Demo only** banner  
4. Settings profile with your name  

## If something breaks

- Restart `start-dev.ps1` (kills old port 8000)  
- Hard refresh Expo (`Ctrl+Shift+R`)  
- Check Ollama app is running  
