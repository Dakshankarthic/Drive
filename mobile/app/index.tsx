import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';

export default function OnboardingScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <View style={styles.content}>
        
        {/* Logo Section */}
        <View style={styles.logoContainer}>
          <View style={styles.logoIcon}>
            <Text style={styles.logoIconText}>DL</Text>
          </View>
          <Text style={styles.logoText}>DriveLegal</Text>
        </View>

        <View style={styles.mainBody}>
          {/* Headline */}
          <Text style={styles.headline}>
            Know the rules,{'\n'}wherever you <Text style={styles.italicHighlight}>drive.</Text>
          </Text>

          {/* Subheadline */}
          <Text style={styles.subheadline}>
            Plain-language traffic laws, fines and rights — for your exact street, in your language.
          </Text>
        </View>

        {/* Footer / Actions */}
        <View style={styles.footer}>
          <TouchableOpacity 
            style={styles.primaryButton}
            onPress={() => router.push('/location')}
          >
            <Text style={styles.primaryButtonText}>Get started</Text>
            <Ionicons name="arrow-forward" size={18} color="#fff" style={styles.buttonIcon} />
          </TouchableOpacity>

          <View style={styles.signInRow}>
            <Text style={styles.signInText}>Already have an account? </Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)')}>
              <Text style={styles.signInLink}>Sign in</Text>
            </TouchableOpacity>
          </View>
        </View>
        
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FBF7F0',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: Platform.OS === 'ios' ? 20 : 40,
    justifyContent: 'space-between',
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
  },
  logoIcon: {
    width: 32,
    height: 32,
    backgroundColor: '#1B1A17',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  logoIconText: {
    color: '#C9621D',
    fontWeight: '700',
    fontSize: 14,
  },
  logoText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1B1A17',
    fontFamily: Platform.OS === 'web' ? 'Outfit, sans-serif' : 'System',
    letterSpacing: -0.5,
  },
  mainBody: {
    flex: 1,
    justifyContent: 'center',
    marginTop: -40,
  },
  headline: {
    fontSize: 42,
    lineHeight: 48,
    color: '#1B1A17',
    fontFamily: Platform.OS === 'web' ? '"Playfair Display", serif' : 'serif',
    marginBottom: 24,
    letterSpacing: -1,
  },
  italicHighlight: {
    color: '#C9621D',
    fontStyle: 'italic',
  },
  subheadline: {
    fontSize: 16,
    lineHeight: 24,
    color: '#4b5563',
    fontFamily: Platform.OS === 'web' ? 'Inter, sans-serif' : 'System',
    maxWidth: '85%',
  },
  footer: {
    width: '100%',
  },
  primaryButton: {
    backgroundColor: '#C9621D',
    borderRadius: 24,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    marginBottom: 24,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: Platform.OS === 'web' ? 'Inter, sans-serif' : 'System',
  },
  buttonIcon: {
    marginLeft: 8,
  },
  signInRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  signInText: {
    color: '#6b7280',
    fontSize: 14,
    fontFamily: Platform.OS === 'web' ? 'Inter, sans-serif' : 'System',
  },
  signInLink: {
    color: '#C9621D',
    fontSize: 14,
    fontWeight: '600',
    fontFamily: Platform.OS === 'web' ? 'Inter, sans-serif' : 'System',
  }
});
