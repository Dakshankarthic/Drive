import React from 'react';
import { Tabs, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme, Platform, View, StyleSheet, useWindowDimensions, TouchableOpacity } from 'react-native';
import { Sidebar } from '../../components/Sidebar';
import { SidebarRail } from '../../components/SidebarRail';

import { UIProvider, useUI } from '../../hooks/useUI';

const isWeb = Platform.OS === 'web';

export default function TabLayout() {
  return (
    <UIProvider>
      <LayoutContent />
    </UIProvider>
  );
}

function LayoutContent() {
  const { width } = useWindowDimensions();
  const isLargeScreen = width > 768;
  const { isSidebarOpen, setSidebarOpen } = useUI();
  const router = useRouter();

  // We no longer auto-close the sidebar on mobile to respect the user's "sidebar by default" preference.

  const handleNewChat = () => {
    router.push({ pathname: '/', params: { new: 'true', t: Date.now() } });
  };

  return (
    <View style={styles.container}>
      {/* Show Rail only when Sidebar is closed */}
      {!isSidebarOpen && <SidebarRail />}

      {isSidebarOpen && (
        <View style={isLargeScreen ? styles.sidebarDesktop : styles.sidebarMobile}>
          <Sidebar
            onClose={() => setSidebarOpen(false)}
            onNewChat={handleNewChat}
          />
          {!isLargeScreen && (
            <TouchableOpacity
              style={styles.overlay}
              onPress={() => setSidebarOpen(false)}
              activeOpacity={1}
            />
          )}
        </View>
      )}
      <View style={styles.content}>
        <Tabs
          screenOptions={{
            tabBarActiveTintColor: '#10b981',
            tabBarInactiveTintColor: '#9ca3af',
            tabBarStyle: {
              backgroundColor: '#121212',
              borderTopColor: '#2a2a2a',
              height: 60,
              display: isWeb ? (isLargeScreen ? 'none' : 'flex') : 'flex',
              paddingBottom: 8,
              paddingTop: 8,
            },
            headerShown: false, // Use custom headers for pages
            headerStyle: {
              backgroundColor: '#121212',
            },
            headerTintColor: '#fff',
            headerTitleStyle: {
              fontWeight: 'bold',
            },
          }}
        >
          <Tabs.Screen
            name="index"
            options={{
              title: 'Query',
              tabBarLabel: 'Query',
              tabBarIcon: ({ color, size }: { color: string; size: number }) => (
                <Ionicons name="chatbox-ellipses" size={size} color={color} />
              ),
            }}
          />
          <Tabs.Screen
            name="zones"
            options={{
              title: 'Zones Map',
              tabBarLabel: 'Zones',
              tabBarIcon: ({ color, size }: { color: string; size: number }) => (
                <Ionicons name="map" size={size} color={color} />
              ),
            }}
          />
          <Tabs.Screen
            name="settings"
            options={{
              title: 'Settings',
              tabBarLabel: 'Settings',
              tabBarIcon: ({ color, size }: { color: string; size: number }) => (
                <Ionicons name="settings" size={size} color={color} />
              ),
            }}
          />
          <Tabs.Screen
            name="zones.web"
            options={{
              href: null, // Hide this from the tab bar
            }}
          />
        </Tabs>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
  },
  sidebarDesktop: {
    height: '100%',
  },
  sidebarMobile: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    right: 0,
    zIndex: 100,
    flexDirection: 'row',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  content: {
    flex: 1,
  }
});
