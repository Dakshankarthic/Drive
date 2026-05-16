import { useState } from 'react';
import * as Location from 'expo-location';
import { getApiBaseUrl } from '../lib/api';

export interface ChatHistoryTurn {
  role: 'user' | 'model';
  parts: string[];
}

export interface ToolUsage {
  tool: string;
  params?: Record<string, unknown>;
  result?: {
    found?: boolean;
    amount_inr?: number;
    section_ref?: string;
    source_url?: string;
    data_as_of?: string;
    section?: string;
    message?: string;
  };
}

export interface QueryResult {
  status: string;
  response?: string;
  text?: string;
  intent?: string;
  query_summary?: string;
  model?: string;
  agent_powered?: boolean;
  tools_used?: ToolUsage[];
  citations?: string[];
  fine?: {
    amount_inr: number | null;
    section_ref: string;
    source_url: string;
    data_as_of: string;
  } | null;
  rule?: {
    rule_id: string;
    title: string;
    description: string;
    state_override?: string;
  } | null;
}

interface UseQueryResult {
  data: QueryResult | null;
  isLoading: boolean;
  isOffline: boolean;
  error: string | null;
  submitQuery: (text: string, history?: ChatHistoryTurn[]) => Promise<void>;
}

export function useQuery(): UseQueryResult {
  const [data, setData] = useState<QueryResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submitQuery = async (text: string, history: ChatHistoryTurn[] = []) => {
    setIsLoading(true);
    setError(null);
    setData(null);

    const BASE_URL = getApiBaseUrl();

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 120000);

      let gps = null;
      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({});
          gps = { lat: loc.coords.latitude, lon: loc.coords.longitude };
        }
      } catch {
        // GPS optional
      }

      const response = await fetch(`${BASE_URL}/query`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json; charset=utf-8',
          'Bypass-Tunnel-Reminder': 'true'
        },
        body: JSON.stringify({ text, history, gps }),
        signal: controller.signal as AbortSignal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const result = await response.json();
        setData(result);
        setIsOffline(false);
      } else {
        const detail = await response.text().catch(() => '');
        throw new Error(detail || `HTTP ${response.status}`);
      }
    } catch (err: unknown) {
      const e = err as { name?: string; message?: string };
      console.log(`Network failed for ${BASE_URL}:`, e);
      setIsOffline(true);

      const fetchErrorMsg =
        e.name === 'AbortError'
          ? `[TIMEOUT] Request to ${BASE_URL} timed out. Is Ollama/backend running?`
          : `[CONNECT_ERROR] Failed to reach ${BASE_URL} (${e.message ?? 'unknown'}). Same Wi-Fi? Set EXPO_PUBLIC_API_HOST to your PC IP.`;

      setError(fetchErrorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  return { data, isLoading, isOffline, error, submitQuery };
}
