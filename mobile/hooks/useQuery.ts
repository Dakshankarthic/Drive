import { useState } from 'react';
import { Platform } from 'react-native';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface ToolCall {
  tool: string;
  params: Record<string, unknown>;
  result: Record<string, unknown>;
}

export interface AgentResponse {
  /** Natural language answer written by the AI agent */
  response: string;
  /** "ok" = Gemini answered | "fallback" = keyword mode | "error" */
  status: 'ok' | 'fallback' | 'error';
  /** List of tools the agent called to build this answer */
  tools_used: ToolCall[];
  /** True when Gemini generated the answer */
  agent_powered: boolean;
  /** Which model was used (e.g. "gemini-1.5-flash") */
  model?: string;
}

interface UseQueryResult {
  data: AgentResponse | null;
  isLoading: boolean;
  isOffline: boolean;
  error: string | null;
  submitQuery: (text: string, history?: ConversationTurn[]) => Promise<void>;
}

export interface ConversationTurn {
  role: 'user' | 'model';
  parts: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Backend URL — change to your machine's IP for physical device testing
// ─────────────────────────────────────────────────────────────────────────────

const BACKEND_URL = 'http://192.168.29.212:8000';


// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

export function useQuery(): UseQueryResult {
  const [data, setData] = useState<AgentResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submitQuery = async (
    text: string,
    history: ConversationTurn[] = [],
  ): Promise<void> => {
    if (!text.trim()) return;

    setIsLoading(true);
    setError(null);
    setData(null);

    try {
      // ── Call the AI agent endpoint ────────────────────────────────────────
      const response = await fetch(`${BACKEND_URL}/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,       // ✅ Fixed: was incorrectly "query" before
          history,    // Conversation context for multi-turn memory
          gps: null,  // TODO: pass real GPS from expo-location
        }),
      });

      if (!response.ok) {
        const errBody = await response.text();
        throw new Error(`Server error ${response.status}: ${errBody}`);
      }

      const result: AgentResponse = await response.json();
      setData(result);
      setIsOffline(false);

    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn('[useQuery] Network failed, switching to offline mode:', message);
      setIsOffline(true);

      // ── Offline fallback: static helpful message ──────────────────────────
      // In production this would query the local SQLite DB via useLocalDB.
      setData({
        status: 'fallback',
        response:
          'You appear to be offline. Basic traffic law information:\n\n' +
          '• No Helmet (2-Wheeler): ₹1,000 (Section 129 MV Act)\n' +
          '• Over Speeding (LMV): ₹1,000–₹2,000 (Section 183)\n' +
          '• Drunk Driving: ₹10,000 + imprisonment (Section 185)\n' +
          '• Red Light Jumping: ₹1,000–₹5,000 (Section 184)\n' +
          '• No Seatbelt: ₹1,000 (Section 194B)\n\n' +
          '⚠️ Connect to internet for AI-powered, state-specific answers.',
        tools_used: [],
        agent_powered: false,
      });

    } finally {
      setIsLoading(false);
    }
  };

  return { data, isLoading, isOffline, error, submitQuery };
}
