import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, usePathname } from 'expo-router';
import { useHistory, ChatSession } from '../hooks/useHistory';

export function Sidebar({ 
  onClose,
  onNewChat,
}: { 
  onClose?: () => void,
  onNewChat?: () => void,
}) {
  const [hoveredId, setHoveredId] = React.useState<string | null>(null);
  const [isNewChatHovered, setIsNewChatHovered] = React.useState(false);
  const [activeMenuId, setActiveMenuId] = React.useState<string | null>(null);
  const router = useRouter();
  const pathname = usePathname();
  const { sessions, deleteSession, renameSession, toggleStar } = useHistory();

  const starredSessions = sessions.filter((s: ChatSession) => s.isStarred);

  const handleRecentClick = (session: ChatSession) => {
    // Navigate to home and pass the session ID to restore it
    router.push({ pathname: '/', params: { sid: session.id, t: Date.now() } });
  };

  const renderHistoryItem = (session: ChatSession, isFav?: boolean) => (
    <View 
      key={(isFav ? 'fav-' : '') + session.id} 
      style={styles.recentItemContainer}
      // @ts-ignore
      onMouseEnter={() => setHoveredId((isFav ? 'fav-' : '') + session.id)}
      onMouseLeave={() => setHoveredId(null)}
    >
      <TouchableOpacity 
        style={styles.recentItem} 
        onPress={() => handleRecentClick(session)}
      >
        <Ionicons 
          name={session.isStarred ? "star" : "chatbox-outline"} 
          size={14} 
          color={session.isStarred ? "#fbbf24" : "#6b7280"} 
          style={{marginRight: 8}} 
        />
        <Text style={styles.recentItemText} numberOfLines={1}>{session.query}</Text>
      </TouchableOpacity>
      
      {(hoveredId === (isFav ? 'fav-' : '') + session.id || activeMenuId === (isFav ? 'fav-' : '') + session.id) && (
        <TouchableOpacity 
          style={styles.moreButton}
          onPress={() => setActiveMenuId(activeMenuId === (isFav ? 'fav-' : '') + session.id ? null : (isFav ? 'fav-' : '') + session.id)}
        >
          <Ionicons name="ellipsis-vertical" size={14} color="#9ca3af" />
        </TouchableOpacity>
      )}

      {activeMenuId === (isFav ? 'fav-' : '') + session.id && (
        <View style={[styles.contextMenu, isFav && { bottom: '100%', top: 'auto', marginBottom: -4 }]}>
          <TouchableOpacity 
            style={styles.menuOption} 
            onPress={() => {
              toggleStar(session.id);
              setActiveMenuId(null);
            }}
          >
            <Ionicons name={session.isStarred ? "star" : "star-outline"} size={16} color={session.isStarred ? "#fbbf24" : "#9ca3af"} />
            <Text style={styles.menuOptionText}>{session.isStarred ? 'Unstar' : 'Star'}</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.menuOption}
            onPress={() => {
              // prompt() is browser-only and crashes on native.
              // Replacing with a placeholder until a custom Modal is implemented.
              console.log('Rename requested for session:', session.id);
              setActiveMenuId(null);
            }}
          >
            <Ionicons name="pencil-outline" size={16} color="#9ca3af" />
            <Text style={styles.menuOptionText}>Rename</Text>
          </TouchableOpacity>
          <View style={styles.menuSeparator} />
          <TouchableOpacity 
            style={styles.menuOption}
            onPress={() => {
              deleteSession(session.id);
              setActiveMenuId(null);
            }}
          >
            <Ionicons name="trash-outline" size={16} color="#fca5a5" />
            <Text style={[styles.menuOptionText, { color: '#fca5a5' }]}>Delete</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  return (
    <View style={styles.sidebar}>
      <View style={styles.sidebarHeader}>
        <View style={{flexDirection: 'row', alignItems: 'center', flex: 1}}>
          <View style={styles.logoContainer}>
            <Ionicons name="shield-checkmark" size={22} color="#10b981" />
          </View>
          <Text style={styles.logoText}>DriveLegal</Text>
        </View>
        <TouchableOpacity onPress={onClose} style={styles.toggleButton}>
          <View style={styles.panelIconContainer}>
            <View style={[styles.panelIconOuter, { borderColor: '#9ca3af' }]}>
              <View style={[styles.panelIconInner, { borderRightColor: '#9ca3af' }]} />
            </View>
          </View>
        </TouchableOpacity>
      </View>

      <View style={styles.govBadge}>
        <Text style={styles.govBadgeText}>Official Govt Portal</Text>
      </View>

      <TouchableOpacity 
        style={[styles.newChatButton, isNewChatHovered && styles.newChatButtonHovered]} 
        onPress={onNewChat}
        // @ts-ignore
        onMouseEnter={() => setIsNewChatHovered(true)}
        onMouseLeave={() => setIsNewChatHovered(false)}
      >
        <View style={[styles.newChatIconContainer, isNewChatHovered && styles.newChatIconContainerHovered]}>
          <Ionicons name="add" size={20} color={isNewChatHovered ? "#fff" : "#9ca3af"} />
        </View>
        <Text style={[styles.newChatButtonText, isNewChatHovered && styles.newChatButtonTextHovered]}>New chat</Text>
      </TouchableOpacity>


      <ScrollView 
        style={styles.scrollArea} 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.menuSection}>
          <Text style={styles.sectionTitle}>Services</Text>
          <TouchableOpacity 
            style={[styles.menuItem, pathname === '/' && styles.menuItemActive]}
            onPress={() => {
              router.push('/');
            }}
          >
            <Ionicons name="chatbubble-outline" size={18} color={pathname === '/' ? "#fff" : "#9ca3af"} />
            <Text style={pathname === '/' ? styles.menuItemText : styles.menuItemTextSecondary}>AI Law Assistant</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.menuItem, pathname === '/zones' && styles.menuItemActive]}
            onPress={() => {
              router.push('/zones');
            }}
          >
            <Ionicons name="map-outline" size={18} color={pathname === '/zones' ? "#fff" : "#9ca3af"} />
            <Text style={pathname === '/zones' ? styles.menuItemText : styles.menuItemTextSecondary}>Traffic Zones</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.menuItem, pathname === '/settings' && styles.menuItemActive]}
            onPress={() => {
              router.push('/settings');
            }}
          >
            <Ionicons name="settings-outline" size={18} color={pathname === '/settings' ? "#fff" : "#9ca3af"} />
            <Text style={pathname === '/settings' ? styles.menuItemText : styles.menuItemTextSecondary}>System Settings</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.menuItem}
            onPress={() => {
              router.push({ pathname: '/', params: { calc: 'true', t: Date.now() } });
            }}
          >
            <Ionicons name="calculator-outline" size={18} color="#9ca3af" />
            <Text style={styles.menuItemTextSecondary}>Challan Calculator</Text>
          </TouchableOpacity>
        </View>

        {starredSessions.length > 0 && (
          <View style={styles.menuSection}>
            <Text style={styles.sectionTitle}>Starred</Text>
            {starredSessions.map((session: ChatSession) => renderHistoryItem(session, true))}
          </View>
        )}
  
        <View style={styles.menuSection}>
          <Text style={styles.sectionTitle}>Recents</Text>
          {sessions.length > 0 ? sessions.map((session: ChatSession) => renderHistoryItem(session)) : (
            <Text style={styles.emptyRecent}>No recent queries</Text>
          )}
        </View>
      </ScrollView>

      <View style={styles.sidebarFooter}>
        <View style={styles.footerInfo}>
          <Ionicons name="shield-outline" size={14} color="#4b5563" />
          <Text style={styles.footerText}>MO-Road Transport</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sidebar: {
    width: 280,
    backgroundColor: '#0f1115', // Slightly deeper black/grey like Claude
    borderRightWidth: 1,
    borderRightColor: '#1f2937',
    padding: 16,
    height: '100%',
    fontFamily: Platform.OS === 'web' ? 'Inter, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' : 'System',
  },
  sidebarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  toggleButton: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#1a1f26',
  },
  panelIconContainer: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  panelIconOuter: {
    width: 20,
    height: 18,
    borderWidth: 1.5,
    borderRadius: 3,
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  panelIconInner: {
    width: 6,
    height: '100%',
    borderRightWidth: 1.5,
  },
  newChatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 8,
    alignSelf: 'stretch',
    marginBottom: 16,
  },
  newChatButtonHovered: {
    backgroundColor: '#1a1f26',
  },
  newChatIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1a1f26',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  newChatIconContainerHovered: {
    backgroundColor: '#374151',
  },
  newChatButtonText: {
    color: '#9ca3af',
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: -0.1,
  },
  newChatButtonTextHovered: {
    color: '#fff',
  },
  logoContainer: {
    width: 32,
    height: 32,
    backgroundColor: '#1e293b',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  logoText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.3,
    fontFamily: Platform.OS === 'web' ? 'Outfit, Inter, sans-serif' : 'System',
  },
  govBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginBottom: 16,
    borderWidth: 0.5,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  govBadgeText: {
    color: '#10b981',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  menuSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    color: '#6b7280',
    fontSize: 11,
    fontWeight: '500',
    marginBottom: 6,
    paddingLeft: 4,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 2,
  },
  menuItemActive: {
    backgroundColor: '#262626',
  },
  menuItemText: {
    color: '#fff',
    fontSize: 12.5,
    marginLeft: 12,
    fontWeight: '500',
  },
  menuItemTextSecondary: {
    color: '#9ca3af',
    fontSize: 12.5,
    marginLeft: 12,
    fontWeight: '400',
    fontFamily: Platform.OS === 'web' ? 'Inter, sans-serif' : 'System',
  },
  recentItemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
    borderRadius: 8,
  },
  recentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
    flex: 1,
  },
  moreButton: {
    padding: 8,
    opacity: 0.8,
  },
  scrollArea: {
    flex: 1,
    marginVertical: 8,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  contextMenu: {
    position: 'absolute',
    right: 0,
    top: 36,
    backgroundColor: '#1e1e1e',
    borderRadius: 12,
    padding: 4,
    width: 150,
    zIndex: 2000,
    borderWidth: 1,
    borderColor: '#333',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 20,
  },
  menuOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  menuOptionText: {
    color: '#d1d5db',
    fontSize: 13,
    marginLeft: 10,
    fontWeight: '500',
  },
  menuSeparator: {
    height: 1,
    backgroundColor: '#333',
    marginVertical: 4,
    marginHorizontal: -6,
  },
  recentItemText: {
    color: '#9ca3af',
    fontSize: 12.5,
    fontWeight: '400',
    flex: 1,
  },
  emptyRecent: {
    color: '#4b5563',
    fontSize: 12,
    paddingLeft: 12,
    fontStyle: 'italic',
  },
  sidebarFooter: {
    marginTop: 'auto',
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#2a2a2a',
  },
  footerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  footerText: {
    color: '#6b7280',
    fontSize: 11,
    fontWeight: '500',
  }
});
