# DriveLegal AI Agent Architecture

This document explains the core Artificial Intelligence and Computer Science methods powering the DriveLegal AI Agent. Our agent is designed to be highly accurate, context-aware, and strictly grounded in real legal data.

There are **3 core methods** powering the agent:

---

## 1. 🔧 Function Calling (Tool Use)

This is the primary method. Instead of the AI making up (hallucinating) answers, it acts as an intelligent router that calls real backend functions.

```mermaid
graph TD;
    User["User: 'Fine for drunk driving in Delhi?'"] --> Gemini
    Gemini -->|Decides it needs fine data| ToolLookup["call lookup_fine(\"drunk driving\", \"GENERAL\", \"Delhi\")"]
    ToolLookup -->|Queries fines.db| SQL[(SQLite Database)]
    SQL -->|Returns: amount_inr: 10000, section: '185'| ToolLookup
    ToolLookup --> Gemini
    Gemini -->|Synthesizes Answer| Final["The fine for drunk driving in Delhi is ₹10,000 under Section 185..."]
```

**Why it matters:** The AI never *guesses* a fine amount. It always fetches from real data.

### In Code (`backend/modules/agent/tools.py`):
```python
TOOL_DEFINITIONS = [
    {
        "name": "lookup_fine",                              # ← Tool name Gemini calls
        "description": "Look up the exact fine amount...",  # ← Gemini reads this to decide WHEN to use it
        "parameters": { ... }                               # ← What arguments to pass
    },
    { "name": "lookup_rule",   ... },
    { "name": "check_zone",    ... },
    { "name": "search_rules",  ... },
]
```

**The 4 Available Tools:**
| Tool Name | What It Does | Data Source |
|---|---|---|
| `lookup_fine` | Gets exact fine/penalty amount | Local SQLite (`fines.db`) |
| `lookup_rule` | Gets MV Act section + law text | `rules.json` |
| `check_zone` | Checks GPS zone restrictions | GeoJSON polygons |
| `search_rules` | Keyword search across all rules | `rules.json` |

---

## 2. 🔁 Agentic Loop (ReAct Pattern)

The agent doesn't just call one tool and stop. It loops — calling multiple tools if needed — until it has enough gathered information to fully answer the user's prompt. 

**The Agentic Loop Flow:**
1. User sends message.
2. Gemini thinks...
3. Needs fine data? → call `lookup_fine()` → gets result → sends back to Gemini.
4. Also needs rule text? → call `lookup_rule()` → gets result → sends back to Gemini.
5. GPS coordinates available? → call `check_zone()` → gets result → sends back to Gemini.
6. **Condition Met:** Has enough info → writes final text answer.

### In Code (`backend/modules/agent/engine.py`):
```python
for iteration in range(self.MAX_TOOL_ITERATIONS):  # max 5 loops
    
    tool_calls = [part.function_call for part in response.parts if part.function_call.name]
    
    if not tool_calls:
        break  # ← Gemini is done, has a final text answer
    
    # Execute all tools Gemini decided to use in this iteration
    for call in tool_calls:
        result = self.tool_executor.execute(call.name, params, gps)
    
    # Send results BACK to Gemini → it thinks again with the new context
    response = chat.send_message(tool_results)
```
*(Note: `MAX_TOOL_ITERATIONS = 5` prevents infinite loops)*

---

## 3. 🧠 Multi-turn Conversation Memory

The agent remembers previous messages in the same chat session. This is known as **conversation history injection**.

* **Turn 1 (User):** "What is the helmet fine?"
* **Turn 1 (AI):** "₹1,000 under Section 194D..."
* **Turn 2 (User):** "What if it's the second time?" 

*Without memory,* the AI has NO idea what "it" refers to.
*With memory,* the AI knows "it" = "helmet fine". It will search for the repeat offence amount for a helmet violation.

### In Code (`mobile/app/(tabs)/index.tsx`):
```typescript
// Last 10 messages are sent as history with every new query
const history: ConversationTurn[] = chatHistory
  .slice(-10)
  .map(m => ({
    role: m.sender === 'user' ? 'user' : 'model',
    parts: [m.text],
  }));

await submitQuery(text, history);   // history sent to backend
```

### In Code (`backend/modules/agent/engine.py`):
```python
# Gemini receives the full context of the chat
chat = self.model.start_chat(history=history)  
response = chat.send_message(enriched_text)
```

---

## 🧱 Bonus: GPS Context Injection

Before sending the request to Gemini, the user's GPS coordinates are injected directly into the prompt as system context.

### In Code (`backend/modules/agent/engine.py`):
```python
if gps:
    enriched_text += (
        f"\n\n[System context — User GPS: lat={gps.get('lat')}, "
        f"lon={gps.get('lon')}. "
        "Proactively check for zone restrictions if relevant.]"
    )
```
This implicitly tells the AI: *"The user is currently at these coordinates — decide if you should call the `check_zone()` tool before answering."*

---

## 🧱 Bonus: Graceful Keyword Fallback

If `GEMINI_API_KEY` is not set, the agent automatically degrades gracefully to the old rule-based method without crashing.

### In Code (`backend/modules/agent/engine.py`):
```python
def run(self, user_text, ...):
    if self.gemini_available:
        return self._run_gemini(...)    # ← Full AI agent using Gemini
    return self._keyword_fallback(...)  # ← Simple keyword matching
```

---

## Technical Summary 

| Method / Feature | Implemented In | Primary Benefit |
|---|---|---|
| **Function Calling** | `tools.py` & `engine.py` | AI safely calls real DB functions; eliminates generated hallucinations. |
| **Agentic Loop** | `engine.py -> _run_gemini()` | Agent can sequence multiple tool calls per query to gather all necessary context. |
| **Conversation Memory** | `index.tsx` & `engine.py` | Follow-up questions work correctly in a human-like dialogue. |
| **GPS Context Injection** | `engine.py -> run()` | Allows proactive location-aware zone warnings. |
| **Keyword Fallback** | `engine.py -> _keyword_fallback()` | Ensures the application remains functional even without a configured API key. |
