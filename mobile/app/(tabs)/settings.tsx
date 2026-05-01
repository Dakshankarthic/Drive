import React, { useState } from 'react';
import { View, Text, StyleSheet, Switch, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSync } from '../../hooks/useSync';
import { Hamburger } from '../../components/Hamburger';

export default function SettingsScreen() {
  const [syncWifiOnly, setSyncWifiOnly] = useState(true);
  const { isSyncing, syncStatus, triggerSync, clearCache } = useSync();

  const handleClearCache = () => {
    Alert.alert(
      "Clear Cache",
      "This will delete all local data and re-download. Continue?",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Clear", style: "destructive", onPress: clearCache }
      ]
    );
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Settings</Text>
      </View>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Sync Configuration</Text>
        <View style={styles.settingRow}>
          <View>
            <Text style={styles.settingLabel}>Sync on Wi-Fi only</Text>
            <Text style={styles.settingSublabel}>Save data by avoiding cellular sync</Text>
          </View>
          <Switch 
            value={syncWifiOnly} 
            onValueChange={setSyncWifiOnly}
            trackColor={{ false: '#374151', true: '#064e3b' }}
            thumbColor={syncWifiOnly ? '#10b981' : '#9ca3af'}
          />
        </View>

        <TouchableOpacity 
          style={[styles.syncButton, isSyncing && styles.disabledButton]} 
          onPress={triggerSync}
          disabled={isSyncing}
        >
          <Ionicons name={isSyncing ? "refresh-outline" : "cloud-download-outline"} size={20} color="#fff" />
          <Text style={styles.syncButtonText}>{isSyncing ? "Syncing..." : "Sync Now"}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Local Data Status</Text>
        
        <View style={styles.dataCard}>
          <View style={styles.dataRow}>
            <Text style={styles.dataLabel}>Fines Database</Text>
            <Text style={styles.dataValue}>{syncStatus.counts.fines} rows</Text>
          </View>
          <Text style={styles.lastSync}>Last sync: {syncStatus.lastSync.fines}</Text>
        </View>

        <View style={styles.dataCard}>
          <View style={styles.dataRow}>
            <Text style={styles.dataLabel}>Rules Library</Text>
            <Text style={styles.dataValue}>{syncStatus.counts.rules} rules</Text>
          </View>
          <Text style={styles.lastSync}>Last sync: {syncStatus.lastSync.rules}</Text>
        </View>

        <View style={styles.dataCard}>
          <View style={styles.dataRow}>
            <Text style={styles.dataLabel}>Traffic Zones</Text>
            <Text style={styles.dataValue}>{syncStatus.counts.zones} zones</Text>
          </View>
          <Text style={styles.lastSync}>Last sync: {syncStatus.lastSync.zones}</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Maintenance</Text>
        <TouchableOpacity style={styles.dangerButton} onPress={handleClearCache}>
          <Ionicons name="trash-outline" size={18} color="#ef4444" />
          <Text style={styles.dangerButtonText}>Clear Local Cache</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.footer}>
        <Text style={styles.version}>DriveLegal v1.0.0</Text>
        <Text style={styles.copyright}>© 2024 Road Safety Division</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1c1c1c',
  },
  header: {
    padding: 24,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
  },
  section: {
    padding: 24,
    backgroundColor: '#121212',
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 16,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  settingSublabel: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 2,
  },
  syncButton: {
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 10,
    gap: 8,
  },
  syncButtonText: {
    color: '#000',
    fontWeight: '700',
    fontSize: 15,
  },
  disabledButton: {
    opacity: 0.6,
  },
  dataCard: {
    backgroundColor: '#1e293b',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#374151',
  },
  dataRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  dataLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#e2e8f0',
  },
  dataValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#10b981',
  },
  lastSync: {
    fontSize: 11,
    color: '#94a3b8',
    textTransform: 'uppercase',
  },
  dangerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#991b1b',
    gap: 8,
    backgroundColor: '#121212',
  },
  dangerButtonText: {
    color: '#ef4444',
    fontWeight: '700',
    fontSize: 15,
  },
  footer: {
    padding: 32,
    alignItems: 'center',
  },
  version: {
    color: '#4b5563',
    fontSize: 12,
    fontWeight: '600',
  },
  copyright: {
    color: '#374151',
    fontSize: 10,
    marginTop: 4,
  }
});
