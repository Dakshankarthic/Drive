import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Platform,
  Animated,
  KeyboardAvoidingView,
  SafeAreaView,
  Alert
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useQuery } from '../../hooks/useQuery';
import { StatusBar } from 'expo-status-bar';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useHistory } from '../../hooks/useHistory';
import { useSettings } from '../../hooks/useSettings';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as Location from 'expo-location';

export default function DriveLegalAssistant() {
  const { q, sid, new: isNew } = useLocalSearchParams<{ q: string, sid: string, new: string }>();
  const { addSession, sessions } = useHistory();
  const { t } = useSettings();
  const router = useRouter();

  const [queryText, setQueryText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isAttachMenuOpen, setIsAttachMenuOpen] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<string>('');
  const attachMenuAnim = useRef(new Animated.Value(0)).current;
  
  const scrollRef = useRef<ScrollView>(null);
  const lastQueryRef = useRef<string>('');
  
  interface ChatMessage {
    id: string;
    sender: 'user' | 'ai';
    text: string;
    suggestions?: string[];
    source?: string;
  }

  const initialMessage: ChatMessage = {
    id: '1',
    sender: 'ai',
    text: "Hi Arjun 👋 I'm your DriveLegal assistant. Ask anything about traffic rules, fines, or paperwork — in plain language.",
    suggestions: [
      "What's the fine?",
      "Are there any exceptions?",
      "Where is it allowed?"
    ]
  };

  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([initialMessage]);
  const { data, isLoading, error, submitQuery } = useQuery();

  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        try {
          let loc = await Location.getCurrentPositionAsync({});
          let geocode = await Location.reverseGeocodeAsync(loc.coords);
          if (geocode.length > 0) {
            const place = geocode[0];
            const locationName = [place.street, place.city].filter(Boolean).join(' · ');
            setCurrentLocation(locationName);
          }
        } catch (e) {
          console.log('Location error:', e);
        }
      }
    })();
  }, []);

  useEffect(() => {
    if (isNew === 'true') {
      setChatHistory([initialMessage]);
      router.setParams({ new: '' });
      return;
    }

    if (sid) {
      const session = sessions.find(s => s.id === sid);
      if (session) {
        setChatHistory([
          initialMessage,
          { id: 'u' + session.id, sender: 'user', text: session.query },
          { id: 'a' + session.id, sender: 'ai', text: session.response }
        ]);
        setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
      }
    } else if (q) {
      handleSend(q);
    }
  }, [q, sid, isNew]); 

  const handleSend = async (textOverride?: string) => {
    const text = textOverride || queryText;
    if (!text.trim()) return;
    
    lastQueryRef.current = text;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      sender: 'user',
      text: text,
    };
    
    setChatHistory(prev => [...prev, userMessage]);
    setQueryText('');
    
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    await submitQuery(text);
  };

  useEffect(() => {
    if (data) {
      const respText = data.response || data.text || "I found some information regarding your query.";
      const aiResponse: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: 'ai',
        text: respText,
        source: currentLocation ? `${currentLocation} · Motor Vehicles Act` : "Motor Vehicles Act 1988"
      };

      if (lastQueryRef.current) {
        addSession(lastQueryRef.current, respText);
        lastQueryRef.current = '';
      }

      setChatHistory(prev => [...prev, aiResponse]);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    } else if (error) {
      const errorResponse: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: 'ai',
        text: `Sorry, I couldn't find information for that. ${error}`,
      };
      setChatHistory(prev => [...prev, errorResponse]);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [data, error]);

  const toggleAttachMenu = () => {
    const toValue = isAttachMenuOpen ? 0 : 1;
    setIsAttachMenuOpen(!isAttachMenuOpen);
    Animated.spring(attachMenuAnim, {
      toValue,
      useNativeDriver: true,
      tension: 50,
      friction: 7
    }).start();
  };

  const handlePickImage = async () => {
    toggleAttachMenu();
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 1,
    });
    if (!result.canceled) {
      Alert.alert("Success", "Image uploaded for analysis.");
    }
  };

  const handlePickDocument = async () => {
    toggleAttachMenu();
    const result = await DocumentPicker.getDocumentAsync({
      type: "*/*",
    });
    if (!result.canceled) {
      Alert.alert("Success", "Document uploaded for analysis.");
    }
  };

  const handleVoiceInput = () => {
    toggleAttachMenu();
    setIsListening(true);
    setTimeout(() => {
      setIsListening(false);
      Alert.alert("Voice Input", "Listening for your query...");
    }, 2000);
  };

  const handleShareLocation = async () => {
    toggleAttachMenu();
    let { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert("Permission Denied", "Location access is required.");
      return;
    }
    let location = await Location.getCurrentPositionAsync({});
    handleSend(`I am at ${location.coords.latitude}, ${location.coords.longitude}. What rules apply here?`);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.container}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#1c1c1c" />
          </TouchableOpacity>
          
          <View style={styles.headerTitleContainer}>
            <View style={styles.assistantIcon}>
              <MaterialCommunityIcons name="sparkles" size={18} color="#fff" />
            </View>
            <View>
              <Text style={styles.headerTitle}>{t('assistant_name')}</Text>
              <View style={styles.statusRow}>
                <View style={styles.statusDot} />
                <Text style={styles.statusText}>{t('assistant_status')}</Text>
              </View>
            </View>
          </View>
          
          <TouchableOpacity style={styles.translateButton} onPress={() => router.push('/(tabs)/settings')}>
            <MaterialCommunityIcons name="translate" size={22} color="#1c1c1c" />
          </TouchableOpacity>
        </View>

        {/* Chat Area */}
        <ScrollView 
          ref={scrollRef}
          style={styles.chatArea}
          contentContainerStyle={styles.chatContent}
        >
          <Text style={styles.dateDivider}>Today, 9:41 AM</Text>
          
          {chatHistory.map((msg, index) => (
            <View key={msg.id} style={[
              styles.messageWrapper,
              msg.sender === 'user' ? styles.userWrapper : styles.aiWrapper
            ]}>
              {msg.sender === 'ai' && (
                <View style={styles.aiAvatar}>
                  <MaterialCommunityIcons name="sparkles" size={14} color="#d97706" />
                </View>
              )}
              
              <View style={styles.bubbleContainer}>
                {msg.sender === 'ai' && msg.source && (
                  <View style={styles.sourceTag}>
                    <Ionicons name="book" size={12} color="#d97706" />
                    <Text style={styles.sourceTagText}>{msg.source}</Text>
                  </View>
                )}
                
                <View style={[
                  styles.messageBubble,
                  msg.sender === 'user' ? styles.userBubble : styles.aiBubble
                ]}>
                  <Text style={[
                    styles.messageText,
                    msg.sender === 'user' ? styles.userText : styles.aiText
                  ]}>
                    {msg.text}
                  </Text>
                </View>
                
                {msg.sender === 'ai' && msg.source && (
                  <Text style={styles.sourceFooter}>
                    {msg.source} - 1989 (amended 2024)
                  </Text>
                )}
                
                {msg.sender === 'ai' && index === chatHistory.length - 1 && msg.suggestions && (
                  <View style={styles.suggestionsRow}>
                    {msg.suggestions.map((s, i) => (
                      <TouchableOpacity key={i} style={styles.suggestionChip} onPress={() => handleSend(s)}>
                        <Text style={styles.suggestionText}>{s}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            </View>
          ))}
          
          {isLoading && (
            <View style={styles.loadingWrapper}>
              <ActivityIndicator size="small" color="#d97706" />
            </View>
          )}
        </ScrollView>

        {/* Attachment Menu */}
        <Animated.View style={[
          styles.attachMenu,
          {
            transform: [{
              translateY: attachMenuAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [200, 0]
              })
            }],
            opacity: attachMenuAnim
          }
        ]}>
          <View style={styles.attachRow}>
            <TouchableOpacity style={styles.attachItem} onPress={handlePickImage}>
              <View style={[styles.attachIcon, { backgroundColor: '#E0F2FE' }]}>
                <Ionicons name="image" size={24} color="#0369A1" />
              </View>
              <Text style={styles.attachLabel}>Image</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.attachItem} onPress={handlePickDocument}>
              <View style={[styles.attachIcon, { backgroundColor: '#DCFCE7' }]}>
                <Ionicons name="document-text" size={24} color="#15803D" />
              </View>
              <Text style={styles.attachLabel}>Doc</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.attachItem} onPress={handleVoiceInput}>
              <View style={[styles.attachIcon, { backgroundColor: '#FEF3C7' }]}>
                <Ionicons name="mic" size={24} color="#B45309" />
              </View>
              <Text style={styles.attachLabel}>Voice</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.attachItem} onPress={handleShareLocation}>
              <View style={[styles.attachIcon, { backgroundColor: '#F3F4F6' }]}>
                <Ionicons name="location" size={24} color="#4B5563" />
              </View>
              <Text style={styles.attachLabel}>Location</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* Input Area */}
        <View style={styles.inputContainer}>
          <View style={styles.inputWrapper}>
            <TouchableOpacity style={styles.attachButton} onPress={toggleAttachMenu}>
              <Animated.View style={{ transform: [{ rotate: attachMenuAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '45deg'] }) }] }}>
                <Ionicons name="add" size={24} color={isAttachMenuOpen ? "#d97706" : "#6b7280"} />
              </Animated.View>
            </TouchableOpacity>
            
            <TextInput
              style={[
                styles.input,
                Platform.OS === 'web' && { outlineStyle: 'none' } as any
              ]}
              placeholder={t('input_placeholder')}
              placeholderTextColor="#9ca3af"
              value={queryText}
              onChangeText={setQueryText}
              onSubmitEditing={() => handleSend()}
              selectionColor="#d97706"
              onFocus={() => isAttachMenuOpen && toggleAttachMenu()}
            />
            
            <TouchableOpacity style={styles.micButton} onPress={handleVoiceInput}>
              <Ionicons name="mic-outline" size={24} color={isListening ? "#d97706" : "#6b7280"} />
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.sendButton, !queryText.trim() && styles.sendButtonDisabled]}
              onPress={() => handleSend()}
              disabled={!queryText.trim() && !isLoading}
            >
              <Ionicons name="send" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
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
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f0ea',
    backgroundColor: '#fff',
  },
  backButton: {
    padding: 4,
  },
  headerTitleContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 12,
  },
  assistantIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#d97706',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1c1c1c',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10b981',
    marginRight: 4,
  },
  statusText: {
    fontSize: 11,
    color: '#10b981',
    fontWeight: '500',
  },
  translateButton: {
    padding: 4,
  },
  chatArea: {
    flex: 1,
  },
  chatContent: {
    padding: 16,
    paddingBottom: 32,
  },
  dateDivider: {
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '700',
    color: '#9ca3af',
    textTransform: 'uppercase',
    marginBottom: 24,
    backgroundColor: '#f3f0ea',
    alignSelf: 'center',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  messageWrapper: {
    flexDirection: 'row',
    marginBottom: 24,
    maxWidth: '85%',
  },
  userWrapper: {
    alignSelf: 'flex-end',
    flexDirection: 'row-reverse',
  },
  aiWrapper: {
    alignSelf: 'flex-start',
  },
  aiAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#fef3c7',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  bubbleContainer: {
    flex: 1,
  },
  sourceTag: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    backgroundColor: '#fef3c7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  sourceTagText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#b45309',
    marginLeft: 4,
  },
  messageBubble: {
    padding: 14,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  aiBubble: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 4,
  },
  userBubble: {
    backgroundColor: '#1c1c1c',
    borderTopRightRadius: 4,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 22,
  },
  aiText: {
    color: '#1c1c1c',
  },
  userText: {
    color: '#fff',
  },
  sourceFooter: {
    fontSize: 10,
    fontStyle: 'italic',
    color: '#9ca3af',
    marginTop: 6,
    marginLeft: 4,
  },
  suggestionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 12,
    gap: 8,
  },
  suggestionChip: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  suggestionText: {
    fontSize: 13,
    color: '#4b5563',
    fontWeight: '500',
  },
  loadingWrapper: {
    padding: 10,
    alignSelf: 'flex-start',
    marginLeft: 36,
  },
  attachMenu: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    position: 'absolute',
    bottom: 80,
    left: 0,
    right: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 10,
    zIndex: 100,
  },
  attachRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  attachItem: {
    alignItems: 'center',
    gap: 8,
  },
  attachIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  attachLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4b5563',
  },
  inputContainer: {
    padding: 16,
    backgroundColor: '#FAF8F5',
    borderTopWidth: 1,
    borderTopColor: '#f3f0ea',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 30,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#f3f0ea',
  },
  attachButton: {
    padding: 4,
  },
  input: {
    flex: 1,
    paddingHorizontal: 12,
    fontSize: 15,
    color: '#1c1c1c',
    maxHeight: 100,
  },
  micButton: {
    padding: 4,
    marginRight: 4,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#d97706',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#f3f0ea',
  }
});

