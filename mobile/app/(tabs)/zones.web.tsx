/**
 * zones.web.tsx — Web-safe version of the Zones screen.
 *
 * @maplibre/maplibre-react-native is a native-only library and cannot run
 * in a browser. This file is automatically picked up by Metro on web builds
 * instead of zones.tsx, providing a graceful fallback UI.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function ZonesScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Ionicons name="map-outline" size={56} color="#3b82f6" style={styles.icon} />
        <Text style={styles.title}>Zones Map</Text>
        <Text style={styles.subtitle}>
          The interactive traffic-zone map requires the native mobile app.
        </Text>
        <Text style={styles.hint}>
          Open DriveLegal on your Android or iOS device to view zones in real-time.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 20,
    padding: 36,
    alignItems: 'center',
    maxWidth: 380,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 12,
  },
  icon: {
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#f8fafc',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 15,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 12,
  },
  hint: {
    fontSize: 13,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 20,
  },
});
