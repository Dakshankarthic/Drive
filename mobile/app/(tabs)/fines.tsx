import React, { useState, useMemo } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  SafeAreaView, 
  ScrollView, 
  TouchableOpacity,
  Platform
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

interface Violation {
  id: string;
  title: string;
  subtitle: string;
  amount: number;
}

const VIOLATIONS: Violation[] = [
  { id: '1', title: 'Over-speeding', subtitle: '15 km/h above limit', amount: 2000 },
  { id: '2', title: 'No helmet (rider)', subtitle: 'Section 129', amount: 1000 },
  { id: '3', title: 'Phone while driving', subtitle: 'Section 184', amount: 1000 },
  { id: '4', title: 'Red light jump', subtitle: 'Section 119', amount: 1000 },
  { id: '5', title: 'No license / RC', subtitle: 'Section 130', amount: 500 },
  { id: '6', title: 'Drunk Driving', subtitle: 'Section 185', amount: 10000 },
  { id: '7', title: 'Seatbelt violation', subtitle: 'Section 194B', amount: 1000 },
];

export default function FinesScreen() {
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<string[]>(['1', '2']);

  const toggleViolation = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const total = useMemo(() => {
    return selectedIds.reduce((sum, id) => {
      const v = VIOLATIONS.find(item => item.id === id);
      return sum + (v ? v.amount : 0);
    }, 0);
  }, [selectedIds]);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#1c1c1c" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Challan calculator</Text>
        <View style={styles.locationPill}>
          <Ionicons name="location" size={12} color="#d97706" />
          <Text style={styles.locationText}>Tamil Nadu</Text>
        </View>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.description}>
          Estimate the fine before it happens. Tap violations to add them. Numbers reflect <Text style={styles.boldText}>local enforcement</Text>, not just national rules.
        </Text>

        {/* Vehicle Card */}
        <View style={styles.vehicleCard}>
          <View style={styles.vehicleInfo}>
            <MaterialCommunityIcons name="car-outline" size={20} color="#1c1c1c" />
            <Text style={styles.vehicleText}>Car · Personal</Text>
          </View>
          <TouchableOpacity>
            <Text style={styles.changeLink}>Change</Text>
          </TouchableOpacity>
        </View>

        {/* Violations List */}
        <View style={styles.listContainer}>
          {VIOLATIONS.map((item) => {
            const isSelected = selectedIds.includes(item.id);
            return (
              <TouchableOpacity 
                key={item.id} 
                style={[styles.itemRow, isSelected && styles.itemRowSelected]}
                onPress={() => toggleViolation(item.id)}
              >
                <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                  {isSelected && <Ionicons name="checkmark" size={14} color="#fff" />}
                </View>
                
                <View style={styles.itemTextContainer}>
                  <Text style={styles.itemTitle}>{item.title}</Text>
                  <Text style={styles.itemSubtitle}>{item.subtitle}</Text>
                </View>
                
                <Text style={styles.itemAmount}>₹{item.amount.toLocaleString()}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      {/* Summary Section */}
      <View style={styles.summaryContainer}>
        <View style={styles.summaryCard}>
          <View style={styles.summaryHeader}>
            <Text style={styles.summaryLabel}>Estimated total</Text>
            <Text style={styles.violationCount}>{selectedIds.length} violations</Text>
          </View>
          
          <View style={styles.totalRow}>
            <Text style={styles.totalAmount}>₹{total.toLocaleString()}</Text>
            <Text style={styles.courtFee}>+ court fee</Text>
          </View>
          
          <View style={styles.warningBox}>
            <MaterialCommunityIcons name="lightning-bolt" size={16} color="#fbbf24" />
            <Text style={styles.warningText}>
              You may also lose <Text style={styles.boldWarningText}>3 license points</Text> and need to re-take a road safety test.
            </Text>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAF8F5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f0ea',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1c1c1c',
    marginLeft: 12,
    flex: 1,
  },
  locationPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef3c7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 16,
  },
  locationText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#d97706',
    marginLeft: 4,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 200, // Space for the summary card
  },
  description: {
    fontSize: 14,
    color: '#4b5563',
    lineHeight: 20,
    marginBottom: 24,
  },
  boldText: {
    fontWeight: 'bold',
    color: '#1c1c1c',
  },
  vehicleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#f3f0ea',
    marginBottom: 16,
  },
  vehicleInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  vehicleText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1c1c1c',
    marginLeft: 10,
  },
  changeLink: {
    fontSize: 14,
    color: '#d97706',
    fontWeight: '600',
  },
  listContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#f3f0ea',
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f0ea',
  },
  itemRowSelected: {
    backgroundColor: '#fffbeb',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#d1d5db',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxSelected: {
    backgroundColor: '#d97706',
    borderColor: '#d97706',
  },
  itemTextContainer: {
    flex: 1,
    marginLeft: 12,
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1c1c1c',
  },
  itemSubtitle: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  itemAmount: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1c1c1c',
  },
  summaryContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    backgroundColor: '#FAF8F5',
  },
  summaryCard: {
    backgroundColor: '#1c1c1c',
    borderRadius: 24,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 8,
  },
  summaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  summaryLabel: {
    color: '#9ca3af',
    fontSize: 13,
    fontWeight: '500',
  },
  violationCount: {
    color: '#9ca3af',
    fontSize: 12,
    fontWeight: '500',
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 16,
  },
  totalAmount: {
    color: '#d97706',
    fontSize: 32,
    fontWeight: '700',
  },
  courtFee: {
    color: '#9ca3af',
    fontSize: 14,
    marginLeft: 8,
  },
  warningBox: {
    flexDirection: 'row',
    backgroundColor: '#262626',
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  warningText: {
    flex: 1,
    color: '#d1d5db',
    fontSize: 12,
    lineHeight: 18,
    marginLeft: 10,
  },
  boldWarningText: {
    fontWeight: 'bold',
    color: '#fff',
  },
});
