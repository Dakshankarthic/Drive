import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  SafeAreaView,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import MapView, { PROVIDER_GOOGLE, Marker } from 'react-native-maps';

export default function LiveNearYouScreen() {
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [address, setAddress] = useState('Fetching Location...');
  const router = useRouter();

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setAddress('Location Access Denied');
        return;
      }
      const initial = await Location.getCurrentPositionAsync({});
      setLocation(initial);
      
      try {
        let geocode = await Location.reverseGeocodeAsync(initial.coords);
        if (geocode.length > 0) {
          const place = geocode[0];
          setAddress([place.street, place.city, place.region].filter(Boolean).join(' · '));
        }
      } catch(e) {}
    })();
  }, []);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        
        {/* HEADER */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#1f2937" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Live near you</Text>
          <View style={styles.liveBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>Live</Text>
          </View>
        </View>

        {/* MAP SECTION (Full Google Maps View) */}
        <View style={{ flex: 1.5, position: 'relative' }}>
          <MapView
            style={{ flex: 1 }}
            provider={PROVIDER_GOOGLE}
            showsUserLocation={true}
            showsMyLocationButton={true}
            showsCompass={true}
            showsBuildings={true}
            showsTraffic={false}
            showsIndoors={true}
            mapType="standard"
            initialRegion={{
              latitude: location ? location.coords.latitude : 12.9716,
              longitude: location ? location.coords.longitude : 77.5946,
              latitudeDelta: 0.005,
              longitudeDelta: 0.005,
            }}
            region={location ? {
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
              latitudeDelta: 0.005,
              longitudeDelta: 0.005,
            } : undefined}
          >
            {location && (
              <Marker
                coordinate={{
                  latitude: location.coords.latitude,
                  longitude: location.coords.longitude,
                }}
                title="You are here"
                description={address}
              />
            )}
          </MapView>

          {/* Location Card Floating */}
          <View style={styles.locationCard}>
            <View style={styles.locationIconContainer}>
              <Ionicons name="location" size={18} color="#fff" />
            </View>
            <View style={styles.locationTextContainer}>
              <Text style={styles.locationTitle}>{address}</Text>
              <Text style={styles.locationSubtitle}>Live GPS Active</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
          </View>
        </View>

        {/* RULES SECTION (Scrollable Bottom Panel) */}
        <View style={{ flex: 1, backgroundColor: '#FAF8F5', borderTopLeftRadius: 24, borderTopRightRadius: 24, marginTop: -20, shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 10, overflow: 'hidden' }}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            <View style={styles.rulesContainer}>
              <Text style={styles.sectionTitle}>RULES IN FORCE HERE</Text>

              {/* Rule 1: Speed limit */}
              <TouchableOpacity style={styles.ruleCard}>
                <View style={[styles.ruleIconContainer, { backgroundColor: '#FFEDD5' }]}>
                  <Ionicons name="flash" size={20} color="#C2410C" />
                </View>
                <View style={styles.ruleTextContainer}>
                  <Text style={styles.ruleTitle}>
                    Speed limit · <Text style={styles.ruleTitleBold}>50 km/h</Text>
                  </Text>
                  <Text style={styles.ruleSubtitle}>Urban arterial · TN Rule §125</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
              </TouchableOpacity>

              {/* Rule 2: School zone */}
              <TouchableOpacity style={styles.ruleCard}>
                <View style={[styles.ruleIconContainer, { backgroundColor: '#FEF3C7' }]}>
                  <Ionicons name="business" size={20} color="#B45309" />
                </View>
                <View style={styles.ruleTextContainer}>
                  <Text style={styles.ruleTitle}>
                    School zone in <Text style={styles.ruleTitleBold}>240m</Text>
                  </Text>
                  <Text style={styles.ruleSubtitle}>Limit drops to 25 km/h</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
              </TouchableOpacity>

              {/* Rule 3: No-honking */}
              <TouchableOpacity style={styles.ruleCard}>
                <View style={[styles.ruleIconContainer, { backgroundColor: '#E0F2FE' }]}>
                  <Ionicons name="megaphone" size={20} color="#0369A1" />
                </View>
                <View style={styles.ruleTextContainer}>
                  <Text style={styles.ruleTitleBold}>No-honking corridor</Text>
                  <Text style={styles.ruleSubtitle}>Hospital - 24/7 - ₹1,000 fine</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
              </TouchableOpacity>

              {/* Rule 4: Parking */}
              <TouchableOpacity style={styles.ruleCard}>
                <View style={[styles.ruleIconContainer, { backgroundColor: '#F3F4F6' }]}>
                  <Ionicons name="car" size={20} color="#4B5563" />
                </View>
                <View style={styles.ruleTextContainer}>
                  <Text style={styles.ruleTitleBold}>Parking allowed (paid)</Text>
                  <Text style={styles.ruleSubtitle}>₹20/hr · 8AM–8PM</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
              </TouchableOpacity>

            </View>
          </ScrollView>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fff',
  },
  container: {
    flex: 1,
    backgroundColor: '#FAF8F5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? 40 : 10,
    paddingBottom: 16,
    backgroundColor: '#fff',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
    zIndex: 10,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1f2937',
    marginLeft: -16,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#D1FAE5',
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
    marginRight: 6,
  },
  liveText: {
    color: '#059669',
    fontSize: 12,
    fontWeight: '700',
  },
  scrollContent: {
    paddingBottom: 40,
  },
  mapContainer: {
    height: 280,
    backgroundColor: '#F3EDE4',
    position: 'relative',
    overflow: 'hidden',
  },
  mapGridLineV: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: '45%',
    width: 24,
    backgroundColor: '#fff',
    transform: [{ skewX: '-10deg' }],
    opacity: 0.6,
  },
  mapZoneText: {
    position: 'absolute',
    top: 30,
    left: 40,
    fontSize: 12,
    fontWeight: '800',
    color: '#78350F',
    letterSpacing: 0.5,
  },
  radarCircleLarge: {
    position: 'absolute',
    top: '20%',
    left: '30%',
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: '#D97706',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(217, 119, 6, 0.05)',
  },
  radarCircleMedium: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(217, 119, 6, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radarCircleSmall: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#D97706',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: 'rgba(217, 119, 6, 0.3)',
  },
  radarDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#fff',
  },
  radarSecondary: {
    position: 'absolute',
    bottom: 20,
    right: -20,
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 1,
    borderColor: '#D97706',
    borderStyle: 'dashed',
    backgroundColor: 'rgba(217, 119, 6, 0.08)',
  },
  locationCard: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  locationIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#D97706',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  locationTextContainer: {
    flex: 1,
  },
  locationTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 4,
  },
  locationSubtitle: {
    fontSize: 12,
    color: '#6b7280',
  },
  rulesContainer: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#9CA3AF',
    letterSpacing: 1,
    marginBottom: 16,
    marginTop: 8,
  },
  ruleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 6,
    elevation: 1,
  },
  ruleIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  ruleTextContainer: {
    flex: 1,
  },
  ruleTitle: {
    fontSize: 15,
    color: '#1F2937',
    marginBottom: 4,
    fontWeight: '500',
  },
  ruleTitleBold: {
    fontWeight: '700',
    color: '#1F2937',
    fontSize: 15,
  },
  ruleSubtitle: {
    fontSize: 13,
    color: '#6B7280',
  },
});
