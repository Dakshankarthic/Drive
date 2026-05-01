import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, useWindowDimensions, Platform } from 'react-native';
let MapLibreGL: any;
try {
  MapLibreGL = require('@maplibre/maplibre-react-native').default;
} catch (e) {
  MapLibreGL = null;
}
import * as Location from 'expo-location';
import * as SQLite from 'expo-sqlite';
import { Ionicons } from '@expo/vector-icons';
import { Hamburger } from '../../components/Hamburger';

// Set MapLibre accessor if needed
// MapLibreGL.setAccessToken(null);



interface Zone {
  id: number;
  type: 'school_zone' | 'no_horn' | 'speed_limit';
  coordinates: any; // GeoJSON geometry
  rules: string;
  active_hours: string;
}

export default function ZonesScreen() {
  const { width, height: SCREEN_HEIGHT } = useWindowDimensions();
  const isLargeScreen = width > 768;
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [zones, setZones] = useState<Zone[]>([]);
  const [selectedZone, setSelectedZone] = useState<Zone | null>(null);
  const db = Platform.OS !== 'web' ? SQLite.openDatabase('drivelegal.db') : null;

  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      let loc = await Location.getCurrentPositionAsync({});
      setLocation(loc);
      fetchZones();
    })();
  }, []);

  const fetchZones = () => {
    if (!db) return;
    db.transaction(tx => {
      tx.executeSql(
        'SELECT * FROM zones',
        [],
        (_, { rows }) => {
          const results: Zone[] = [];
          for (let i = 0; i < rows.length; i++) {
            const item = rows.item(i);
            results.push({
              ...item,
              id: item.zone_id,
              coordinates: JSON.parse(item.geometry_json)
            });
          }
          setZones(results);
        }
      );
    });
  };

  const getZoneColor = (type: string) => {
    switch (type) {
      case 'school_zone': return '#f59e0b'; // amber
      case 'no_horn': return '#ef4444'; // red
      case 'speed_limit': return '#8b5cf6'; // violet
      default: return '#64748b';
    }
  };

  const onZonePress = (e: any) => {
    const feature = e.features[0];
    if (feature) {
      const zoneId = feature.properties.id;
      const zone = zones.find(z => z.id === zoneId);
      setSelectedZone(zone || null);
    }
  };

  return (
    <View style={styles.container}>
      {MapLibreGL ? (
        <MapLibreGL.MapView
          style={styles.map}
          // @ts-ignore
          styleURL={`file://mobile/assets/tiles/india.mbtiles`}
        >
          <MapLibreGL.Camera
            zoomLevel={14}
            centerCoordinate={location ? [location.coords.longitude, location.coords.latitude] : [77.2090, 28.6139]}
          />

          {location && (
            <MapLibreGL.PointAnnotation
              id="userLocation"
              coordinate={[location.coords.longitude, location.coords.latitude]}
            >
              <View style={styles.userDot} />
            </MapLibreGL.PointAnnotation>
          )}

          {zones.map(zone => (
            <MapLibreGL.ShapeSource
              key={zone.id}
              id={`source-${zone.id}`}
              onPress={onZonePress}
              shape={zone.coordinates}
            >
              <MapLibreGL.FillLayer
                id={`layer-${zone.id}`}
                style={{
                  fillColor: getZoneColor(zone.type),
                  fillOpacity: 0.4,
                  fillOutlineColor: getZoneColor(zone.type),
                }}
              />
            </MapLibreGL.ShapeSource>
          ))}
        </MapLibreGL.MapView>
      ) : (
        <View style={styles.fallbackContainer}>
          <Ionicons name="map-outline" size={64} color="#10b981" />
          <Text style={styles.fallbackText}>Interactive Map Unavailable</Text>
          <Text style={styles.fallbackSubtext}>MapLibre requires a development build. Open this screen in a web browser for the fallback view.</Text>
        </View>
      )}

      {selectedZone && (
        <View style={[
          styles.bottomSheet, 
          isLargeScreen && { width: 400, left: 20, bottom: 20, borderRadius: 24, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 }
        ]}>
          <View style={styles.sheetHeader}>
            <View style={[styles.typeBadge, { backgroundColor: getZoneColor(selectedZone.type) }]}>
              <Text style={styles.typeText}>{selectedZone.type.replace('_', ' ').toUpperCase()}</Text>
            </View>
            <TouchableOpacity onPress={() => setSelectedZone(null)}>
              <Ionicons name="close-circle" size={24} color="#94a3b8" />
            </TouchableOpacity>
          </View>

          <Text style={styles.sheetTitle}>Applicable Rules</Text>
          <Text style={styles.sheetDescription}>{selectedZone.rules}</Text>

          <View style={styles.activeHours}>
            <Ionicons name="time-outline" size={16} color="#64748b" />
            <Text style={styles.hoursText}>Active: {selectedZone.active_hours}</Text>
          </View>
        </View>
      )}

      <TouchableOpacity style={styles.gpsButton} onPress={async () => {
        let loc = await Location.getCurrentPositionAsync({});
        setLocation(loc);
      }}>
        <Ionicons name="locate" size={24} color="#10b981" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  floatingHamburger: {
    position: 'absolute',
    top: 20,
    left: 20,
    zIndex: 10,
  },
  map: {
    flex: 1,
  },
  userDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#10b981',
    borderWidth: 3,
    borderColor: '#000',
  },
  bottomSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#121212',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    borderTopWidth: 1,
    borderTopColor: '#2a2a2a',
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  typeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  typeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '900',
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8,
  },
  sheetDescription: {
    fontSize: 14,
    color: '#9ca3af',
    lineHeight: 20,
    marginBottom: 16,
  },
  activeHours: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#1e293b',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#374151',
  },
  hoursText: {
    fontSize: 13,
    color: '#9ca3af',
    fontWeight: '600',
  },
  gpsButton: {
    position: 'absolute',
    right: 20,
    top: 20,
    backgroundColor: '#121212',
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#374151',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 4,
  },
  fallbackContainer: {
    flex: 1,
    backgroundColor: '#0f172a',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  fallbackText: {
    color: '#f8fafc',
    fontSize: 20,
    fontWeight: '700',
    marginTop: 20,
    marginBottom: 8,
  },
  fallbackSubtext: {
    color: '#94a3b8',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  }
});
