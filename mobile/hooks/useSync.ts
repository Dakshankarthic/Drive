import { useState } from 'react';

interface SyncStatus {
  lastSync: {
    fines: string;
    rules: string;
    zones: string;
  };
  counts: {
    fines: number;
    rules: number;
    zones: number;
  };
}

export function useSync() {
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    lastSync: {
      fines: '2024-04-16',
      rules: '2024-04-16',
      zones: '2024-04-15',
    },
    counts: {
      fines: 1240,
      rules: 450,
      zones: 85,
    }
  });

  const triggerSync = async () => {
    setIsSyncing(true);
    // Simulate sync
    await new Promise(resolve => setTimeout(resolve, 2000));
    setSyncStatus(prev => ({
      ...prev,
      lastSync: {
        fines: new Date().toISOString().split('T')[0],
        rules: new Date().toISOString().split('T')[0],
        zones: new Date().toISOString().split('T')[0],
      }
    }));
    setIsSyncing(false);
  };

  const clearCache = async () => {
    // Logic to drop and recreate SQLite DB
    console.log('Clearing local database...');
  };

  return { isSyncing, syncStatus, triggerSync, clearCache };
}
