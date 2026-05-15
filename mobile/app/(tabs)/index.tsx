import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  Image,
  SafeAreaView
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { useSettings } from '../../hooks/useSettings';

export default function HomeScreen() {
  const router = useRouter();
  const { t, profile, notificationsEnabled } = useSettings();
  
  const [address, setAddress] = useState('Fetching Location...');
  const [region, setRegion] = useState('Locating...');

  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setAddress('Location Access Denied');
        setRegion('Please enable GPS');
        return;
      }
      try {
        let loc = await Location.getCurrentPositionAsync({});
        let geocode = await Location.reverseGeocodeAsync(loc.coords);
        if (geocode.length > 0) {
          const place = geocode[0];
          setAddress([place.street, place.city].filter(Boolean).join(', '));
          setRegion(place.region || 'Unknown Region');
        }
      } catch (e) {}
    })();
  }, []);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.logoContainer}>
              <Text style={styles.logoText}>DL</Text>
            </View>
            <Text style={styles.greeting}>{t('greeting')}</Text>
          </View>
          <TouchableOpacity style={styles.notificationBtn} onPress={() => router.push('/(tabs)/settings')}>
            <Ionicons name="notifications-outline" size={22} color="#1c1c1c" />
            {notificationsEnabled && <View style={styles.notificationDot} />}
          </TouchableOpacity>
        </View>

        {/* Location Card */}
        <View style={styles.locationCard}>
          <View style={styles.locationHeader}>
            <Ionicons name="location-outline" size={16} color="#d97706" />
            <Text style={styles.locationLabel}>{t('location_label')}</Text>
          </View>
          <Text style={styles.locationTitle}>{address}</Text>
          <Text style={styles.locationSubtitle}>{region} • Live GPS Context</Text>
          
          <View style={styles.pillsRow}>
            <View style={styles.pill}>
              <Text style={styles.pillLabel}>{t('speed')}</Text>
              <Text style={styles.pillValueOrange}>50 <Text style={styles.pillUnitOrange}>kmph</Text></Text>
            </View>
            <View style={[styles.pill, { backgroundColor: '#3f1d1d' }]}>
              <Text style={[styles.pillLabel, { color: '#fca5a5' }]}>{t('fine_zone')}</Text>
              <Text style={styles.pillValue}>School</Text>
            </View>
            <View style={styles.pill}>
              <Text style={styles.pillLabel}>{t('helmet')}</Text>
              <Text style={styles.pillValue}>{t('mandatory')}</Text>
            </View>
          </View>
        </View>

        {/* Action Grid */}
        <View style={styles.gridContainer}>
          <View style={styles.gridRow}>
            <TouchableOpacity 
              style={[styles.gridItem, styles.askItem]} 
              onPress={() => router.push('/(tabs)/ask')}
            >
              <View style={styles.iconContainerWhite}>
                <Ionicons name="chatbubble-ellipses-outline" size={20} color="#fff" />
              </View>
              <Text style={styles.askItemTitle}>{t('ask_title')}</Text>
              <Text style={styles.askItemSubtitle}>{t('ask_subtitle')}</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.gridItem} onPress={() => router.push('/(tabs)/fines')}>
              <View style={styles.iconContainerBrown}>
                <Ionicons name="document-text-outline" size={20} color="#d97706" />
              </View>
              <Text style={styles.gridItemTitle}>{t('challan_title')}</Text>
              <Text style={styles.gridItemSubtitle}>{t('challan_subtitle')}</Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.gridRow}>
            <TouchableOpacity style={styles.gridItem} onPress={() => router.push('/settings/documents')}>
              <View style={styles.iconContainerBrown}>
                <Ionicons name="folder-outline" size={20} color="#d97706" />
              </View>
              <Text style={styles.gridItemTitle}>{t('vault_title')}</Text>
              <Text style={styles.gridItemSubtitle}>{t('vault_subtitle')}</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.gridItem} onPress={() => router.push('/sos')}>
              <View style={[styles.iconContainerBrown, { backgroundColor: '#fee2e2' }]}>
                <Ionicons name="alert-circle-outline" size={20} color="#ef4444" />
              </View>
              <Text style={styles.gridItemTitle}>{t('sos_title')}</Text>
              <Text style={styles.gridItemSubtitle}>{t('sos_subtitle')}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Today's Brief */}
        <View style={styles.briefHeader}>
          <Text style={styles.briefTitle}>{t('todays_brief')}</Text>
          <TouchableOpacity>
            <Text style={styles.seeAllText}>{t('see_all')}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.briefCard}>
          <View style={[styles.briefIconContainer, { backgroundColor: '#fef3c7' }]}>
            <MaterialCommunityIcons name="helmet" size={20} color="#d97706" />
          </View>
          <View style={styles.briefContent}>
            <Text style={styles.briefCardTitle}>Helmet rule update</Text>
            <Text style={styles.briefCardDesc}>Tamil Nadu now fines pillion riders ₹1,000 — effective today.</Text>
          </View>
        </View>

        <View style={styles.briefCard}>
          <View style={[styles.briefIconContainer, { backgroundColor: '#e0f2fe' }]}>
            <Ionicons name="snow-outline" size={20} color="#0284c7" />
          </View>
          <View style={styles.briefContent}>
            <Text style={styles.briefCardTitle}>Monsoon advisory</Text>
            <Text style={styles.briefCardDesc}>Hazard lights only when stationary. Reduced visibility warning active.</Text>
          </View>
        </View>
        
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FAF8F5',
  },
  container: {
    flex: 1,
    backgroundColor: '#FAF8F5',
  },
  content: {
    padding: 20,
    paddingTop: Platform.OS === 'android' ? 40 : 20,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoContainer: {
    width: 32,
    height: 32,
    backgroundColor: '#1c1c1c',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  logoText: {
    color: '#d97706',
    fontWeight: 'bold',
    fontSize: 14,
  },
  greeting: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
    letterSpacing: 0.5,
  },
  notificationBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f3f0ea',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  notificationDot: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ef4444',
    borderWidth: 1,
    borderColor: '#f3f0ea',
  },
  locationCard: {
    backgroundColor: '#1c1c1c',
    borderRadius: 24,
    padding: 20,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 15,
    elevation: 5,
  },
  locationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  locationLabel: {
    color: '#9ca3af',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 6,
  },
  locationTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  locationSubtitle: {
    color: '#9ca3af',
    fontSize: 13,
    marginBottom: 20,
  },
  pillsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  pill: {
    flex: 1,
    backgroundColor: '#2e2e2e',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  pillLabel: {
    color: '#9ca3af',
    fontSize: 10,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  pillValue: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  pillValueOrange: {
    color: '#d97706',
    fontSize: 14,
    fontWeight: 'bold',
  },
  pillUnitOrange: {
    fontSize: 11,
    fontWeight: 'normal',
  },
  gridContainer: {
    gap: 12,
    marginBottom: 24,
  },
  gridRow: {
    flexDirection: 'row',
    gap: 12,
  },
  gridItem: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  askItem: {
    backgroundColor: '#d97706',
  },
  iconContainerWhite: {
    width: 40,
    height: 40,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  iconContainerBrown: {
    width: 40,
    height: 40,
    backgroundColor: '#fef3c7',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  askItemTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  askItemSubtitle: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
  },
  gridItemTitle: {
    color: '#1c1c1c',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  gridItemSubtitle: {
    color: '#6b7280',
    fontSize: 12,
  },
  briefHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  briefTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1c1c1c',
  },
  seeAllText: {
    color: '#b45309',
    fontSize: 14,
    fontWeight: '600',
  },
  briefCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  briefIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  briefContent: {
    flex: 1,
  },
  briefCardTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#1c1c1c',
    marginBottom: 4,
  },
  briefCardDesc: {
    fontSize: 13,
    color: '#4b5563',
    lineHeight: 18,
  },
});

