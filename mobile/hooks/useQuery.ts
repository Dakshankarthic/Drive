import { useState, useEffect } from 'react';
import { Platform, Alert } from 'react-native';
import Constants from 'expo-constants';

interface QueryResult {
  status: string;
  intent: string;
  text: string;
  query_summary: string;
  fine: {
    amount_inr: number | null;
    section_ref: string;
    source_url: string;
    data_as_of: string;
  } | null;
  rule: {
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
  submitQuery: (text: string) => Promise<void>;
}

import * as Location from 'expo-location';

export function useQuery(): UseQueryResult {
  const [data, setData] = useState<QueryResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [session, setSession] = useState<any>({});

  const submitQuery = async (text: string) => {
    setIsLoading(true);
    setError(null);
    setData(null);
    
    // Secure USB Tunnel
    let host = '127.0.0.1';
    
    const BASE_URL = `http://${host}:8000`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 seconds for AI processing

      let gps = null;
      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({});
          gps = { lat: loc.coords.latitude, lon: loc.coords.longitude };
        }
      } catch(e) {}

      // Attempt network fetch
      const response = await fetch(`${BASE_URL}/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text, session: session, gps: gps }),
        signal: controller.signal as any,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const result = await response.json();
        setData(result);
        if (result.session) {
          setSession((prevSession: any) => ({ ...prevSession, ...result.session }));
        }
        setIsOffline(false);
      } else {
        throw new Error('Network response not ok');
      }
    } catch (err: any) {
      console.log(`Network failed for ${BASE_URL}:`, err);
      setIsOffline(true);
      
      const fetchErrorMsg = err.name === 'AbortError' 
        ? `[TIMEOUT] Request to ${BASE_URL} timed out. Is the backend frozen?` 
        : `[CONNECT_ERROR] Failed to reach ${BASE_URL} (${err.message}). Are you on the same Wi-Fi?`;

      setError(fetchErrorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  return { data, isLoading, isOffline, error, submitQuery };
}
