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
  Easing,
  useWindowDimensions,
  Animated,
  KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { useQuery, ConversationTurn } from '../../hooks/useQuery';
import { StatusBar } from 'expo-status-bar';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useHistory } from '../../hooks/useHistory';
import { useUI } from '../../hooks/useUI';
import { Hamburger } from '../../components/Hamburger';
import { ChallanCalculator } from '../../components/ChallanCalculator';

export default function DriveLegalDashboard() {
  const { width } = useWindowDimensions();
  const isLargeScreen = width > 768;
  const isSmallScreen = width < 480;

  const { q, sid, t, new: isNew, calc } = useLocalSearchParams<{ q: string, sid: string, t: string, new: string, calc: string }>();
  const { addSession, sessions } = useHistory();
  const { toggleSidebar } = useUI();
  const router = useRouter();

  const [queryText, setQueryText] = useState('');
  const [currentLocation, setCurrentLocation] = useState('Chennai, TN');
  const [isListening, setIsListening] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [attachment, setAttachment] = useState<{ uri: string, name: string, type: string } | null>(null);
  const [showChallan, setShowChallan] = useState(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  
  const scrollRef = useRef<ScrollView>(null);
  const lastQueryRef = useRef<string>(''); // Track the current pending query
  
  interface ChatMessage {
    id: string;
    sender: 'user' | 'ai';
    text: string;
    suggestions?: string[];
    attachmentName?: string;
    agentPowered?: boolean;   // true = answered by Gemini
    toolsUsed?: string[];    // which tools the agent called
  }

  const initialMessage: ChatMessage = {
    id: '1',
    sender: 'ai',
    text: 'Hello! I am DriveLegal AI — your official government road safety assistant. I can help you with traffic laws specific to your location, calculate challans for traffic violations, and answer any driving-related legal questions.',
    suggestions: [
      'Mobile phone fine — TN',
      'Drunk driving challan',
      'Helmet rules Chennai',
      'NH-44 speed limits'
    ]
  };

  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([initialMessage]);
  
  const { data, isLoading, error, submitQuery } = useQuery();

  // Handle incoming query, session restoration, or new chat from Sidebar
  useEffect(() => {
    if (isNew === 'true') {
      setChatHistory([initialMessage]);
      // Clear navigation params so we don't reset on every mount
      router.setParams({ new: '' });
      return;
    }

    if (sid) {
      // Restore previous session
      const session = sessions.find(s => s.id === sid);
      if (session) {
        setChatHistory([
          { id: '1', sender: 'ai', text: 'Restored from history:' },
          { id: 'u' + session.id, sender: 'user', text: session.query },
          { id: 'a' + session.id, sender: 'ai', text: session.response }
        ]);
        setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
      }
    } else if (q) {
      // New query from chips or other sources
      handleSend(q);
    }

    if (calc === 'true') {
      setShowChallan(true);
      router.setParams({ calc: '' });
    }
  }, [q, sid, t, isNew, calc]); 


  const handleSend = async (textOverride?: string) => {
    const text = textOverride || queryText;
    if (!text.trim()) return;
    
    // Check if this is already in another session
    const existing = sessions.find(s => s.query.toLowerCase() === text.toLowerCase());
    if (existing && textOverride) {
       setChatHistory(prev => [
         ...prev, 
         { id: Date.now().toString(), sender: 'user', text: text },
         { id: (Date.now() + 1).toString(), sender: 'ai', text: existing.response }
       ]);
       setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
       return;
    }

    lastQueryRef.current = text; // Track this for when response arrives

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      sender: 'user',
      text: text,
      attachmentName: attachment?.name
    };
    
    setChatHistory(prev => [...prev, userMessage]);
    setQueryText('');
    setAttachment(null);
    
    // Auto-scroll to bottom
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    
    // Build conversation history for multi-turn agent context
    const history: ConversationTurn[] = chatHistory
      .filter(m => m.sender === 'user' || m.sender === 'ai')
      .slice(-10) // last 10 turns to keep context window reasonable
      .map(m => ({
        role: m.sender === 'user' ? 'user' : 'model',
        parts: [m.text],
      }));

    await submitQuery(text, history);
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 1,
    });

    if (!result.canceled) {
      setAttachment({
        uri: result.assets[0].uri,
        name: result.assets[0].fileName || 'photo.jpg',
        type: 'image'
      });
    }
    setShowAttachMenu(false);
  };

  const pickDocument = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: 'application/pdf',
    });

    if (!result.canceled) {
      setAttachment({
        uri: result.assets[0].uri,
        name: result.assets[0].name,
        type: 'pdf'
      });
    }
    setShowAttachMenu(false);
  };

  const handleVoiceInput = () => {
    if (isListening) {
      setIsListening(false);
      pulseAnim.setValue(1);
      // Simulate voice result
      const mockResult = "Where is the nearest traffic police station?";
      setQueryText(mockResult);
    } else {
      setIsListening(true);
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
        ])
      ).start();

      // Mock listening timeout
      setTimeout(() => {
        if (isListening) {
          setIsListening(false);
          pulseAnim.setValue(1);
          setQueryText("How much is the fine for helmet violation?");
        }
      }, 3000);
    }
  };

  useEffect(() => {
    if (data) {
      // Agent returns a natural language "response" field directly
      const respText = data.response || "I found some information regarding your query.";
      const toolNames = data.tools_used?.map(t => t.tool) ?? [];

      const aiResponse: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: 'ai',
        text: respText,
        agentPowered: data.agent_powered,
        toolsUsed: toolNames,
      };

      if (lastQueryRef.current) {
        addSession(lastQueryRef.current, respText);
        lastQueryRef.current = '';
      }

      setChatHistory(prev => [...prev, aiResponse]);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    } else if (error) {
      const errorText = `Sorry, I couldn't process that query. Please try again.`;
      const errorResponse: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: 'ai',
        text: errorText,
        agentPowered: false,
      };

      if (lastQueryRef.current) {
        addSession(lastQueryRef.current, errorText);
        lastQueryRef.current = '';
      }

      setChatHistory(prev => [...prev, errorResponse]);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [data, error]);

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.mainContent}
      >
        {/* Header */}
        <View style={styles.mainHeader}>
          <View style={{flexDirection: 'row', alignItems: 'center'}}>

            <View>
              <View style={styles.titleRow}>
                <View style={styles.statusDot} />
                <Text style={styles.headerTitle}>DriveLegal AI</Text>
              </View>
              <Text style={styles.headerSubtitle}>Official Government Law Assistant</Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <TouchableOpacity 
              style={[styles.locationBadge, { backgroundColor: '#111827', borderColor: '#10b981' }]}
              onPress={() => setShowChallan(true)}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Ionicons name="calculator-outline" size={14} color="#10b981" />
                {!isSmallScreen && <Text style={[styles.locationBadgeText, { color: '#10b981' }]}>Calculator</Text>}
              </View>
            </TouchableOpacity>
            {!isSmallScreen && (
              <View style={styles.locationBadge}>
                <Text style={styles.locationBadgeText}>{currentLocation}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Chat Area */}
        <ScrollView 
          ref={scrollRef}
          style={styles.chatArea}
          contentContainerStyle={[
            styles.chatContent,
            { paddingHorizontal: isLargeScreen ? 120 : (isSmallScreen ? 12 : 20) }
          ]}
        >
          {chatHistory.map(msg => (
            <View key={msg.id} style={[
              styles.messageWrapper,
              msg.sender === 'user' ? styles.userWrapper : styles.aiWrapper
            ]}>
              {msg.sender === 'ai' && (
                <View style={[styles.avatarCircleMin, { backgroundColor: '#374151' }]}>
                  <Text style={[styles.avatarTextMin, { fontSize: 10 }]}>DL</Text>
                </View>
              )}
              <View style={[
                styles.messageBubble,
                msg.sender === 'user' ? styles.userBubble : styles.aiBubble
              ]}>
                <Text style={styles.messageText}>{msg.text}</Text>

                {/* Agent-powered badge + tools used */}
                {msg.sender === 'ai' && msg.agentPowered && msg.toolsUsed && msg.toolsUsed.length > 0 && (
                  <View style={styles.agentBadgeRow}>
                    <Ionicons name="flash" size={11} color="#10b981" />
                    <Text style={styles.agentBadgeText}>
                      AI · {msg.toolsUsed.join(' · ')}
                    </Text>
                  </View>
                )}
                
                {msg.attachmentName && (
                  <View style={styles.messageAttachment}>
                    <Ionicons name="attach" size={16} color="#10b981" />
                    <Text style={styles.messageAttachmentText}>{msg.attachmentName}</Text>
                  </View>
                )}
                
                {msg.suggestions && msg.id === chatHistory[0].id && (
                  <View style={styles.suggestionsRow}>
                    {msg.suggestions.map((s, i) => (
                      <TouchableOpacity 
                        key={i} 
                        style={styles.suggestionChip}
                        onPress={() => handleSend(s)}
                      >
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
              <ActivityIndicator size="small" color="#10b981" />
            </View>
          )}
        </ScrollView>

        {/* Attachment Preview */}
        {attachment && (
          <View style={[
            styles.attachmentPreviewContainer,
            { paddingHorizontal: isLargeScreen ? 120 : (isSmallScreen ? 12 : 20) }
          ]}>
            <View style={styles.attachmentCard}>
              <View style={styles.attachmentIconContainer}>
                <Ionicons 
                  name={attachment.type === 'image' ? "image-outline" : "document-text-outline"} 
                  size={20} 
                  color="#10b981" 
                />
              </View>
              <Text style={styles.attachmentName} numberOfLines={1}>{attachment.name}</Text>
              <TouchableOpacity onPress={() => setAttachment(null)} style={styles.removeAttachment}>
                <Ionicons name="close-circle" size={18} color="#9ca3af" />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Input Area */}
        <View style={[
          styles.inputContainer,
          { paddingHorizontal: isLargeScreen ? 120 : (isSmallScreen ? 12 : 20) }
        ]}>
          <View style={{ position: 'relative' }}>
            <TouchableOpacity 
              style={styles.attachButton}
              onPress={() => setShowAttachMenu(!showAttachMenu)}
            >
              <Ionicons name={showAttachMenu ? "close" : "add"} size={24} color="#9ca3af" />
            </TouchableOpacity>

            {showAttachMenu && (
              <View style={styles.attachMenu}>
                <TouchableOpacity style={styles.attachMenuItem} onPress={pickImage}>
                  <Ionicons name="image-outline" size={18} color="#9ca3af" />
                  <Text style={styles.attachMenuText}>Photo</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.attachMenuItem} onPress={pickDocument}>
                  <Ionicons name="document-text-outline" size={18} color="#9ca3af" />
                  <Text style={styles.attachMenuText}>PDF</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
          <View style={[
            styles.inputWrapper, 
            isListening && styles.inputWrapperListening,
            isFocused && styles.inputWrapperFocused
          ]}>
            <TextInput
              style={[styles.input, Platform.OS === 'web' && { outlineStyle: 'none' } as any]}
              placeholder={isListening ? "Listening..." : "Query traffic laws..."}
              placeholderTextColor="#6b7280"
              value={queryText}
              onChangeText={setQueryText}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              onSubmitEditing={() => handleSend()}
              multiline={false}
              editable={!isListening}
            />
            <View style={styles.inputActions}>
              <TouchableOpacity onPress={handleVoiceInput} style={styles.voiceButton}>
                <Animated.View style={{ transform: [{ scale: isListening ? pulseAnim : 1 }] }}>
                  <Ionicons 
                    name={isListening ? "mic" : "mic-outline"} 
                    size={22} 
                    color={isListening ? "#ef4444" : "#9ca3af"} 
                  />
                </Animated.View>
              </TouchableOpacity>
              <TouchableOpacity 
                onPress={() => handleSend()} 
                style={[styles.sendButton, !queryText.trim() && styles.sendButtonDisabled]}
                disabled={!queryText.trim()}
              >
                <Ionicons name="arrow-up" size={20} color={queryText.trim() ? "#fff" : "#4b5563"} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* Challan Calculator Overlay */}
      {showChallan && (
        <View style={styles.overlay}>
          <TouchableOpacity 
            style={styles.overlayBackground} 
            activeOpacity={1} 
            onPress={() => setShowChallan(false)} 
          />
          <View style={styles.calculatorWrapper}>
            <ChallanCalculator onClose={() => setShowChallan(false)} />
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#1c1c1c',
  },
  mainContent: {
    flex: 1,
  },
  mainHeader: {
    height: 70,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    backgroundColor: '#4ade80',
    borderRadius: 4,
    marginRight: 8,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    fontFamily: Platform.OS === 'web' ? 'Outfit, Inter, sans-serif' : 'System',
    letterSpacing: -0.2,
  },
  headerSubtitle: {
    color: '#6b7280',
    fontSize: 12,
  },
  locationBadge: {
    backgroundColor: '#262626',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#374151',
  },
  locationBadgeText: {
    color: '#9ca3af',
    fontSize: 11,
    fontWeight: '600',
  },
  chatArea: {
    flex: 1,
  },
  chatContent: {
    paddingVertical: 32,
  },
  messageWrapper: {
    flexDirection: 'row',
    marginBottom: 32,
    width: '100%',
  },
  aiWrapper: {
    alignSelf: 'flex-start',
  },
  userWrapper: {
    flexDirection: 'row-reverse',
  },
  avatarCircleMin: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    marginTop: 4,
  },
  avatarTextMin: {
    color: '#fff',
    fontWeight: '700',
  },
  messageBubble: {
    flex: 1,
    maxWidth: '85%',
  },
  aiBubble: {},
  userBubble: {
    backgroundColor: '#262626',
    padding: 16,
    borderRadius: 20,
    borderBottomRightRadius: 4,
    alignSelf: 'flex-end',
  },
  messageText: {
    color: '#f3f4f6',
    fontSize: 16,
    lineHeight: 24,
    fontFamily: Platform.OS === 'web' ? 'Inter, sans-serif' : 'System',
  },
  messageAttachment: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    padding: 8,
    borderRadius: 8,
    marginTop: 8,
    alignSelf: 'flex-start',
    gap: 6,
  },
  messageAttachmentText: {
    color: '#10b981',
    fontSize: 12,
    fontWeight: '500',
  },
  agentBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 4,
  },
  agentBadgeText: {
    color: '#10b981',
    fontSize: 11,
    fontWeight: '500',
    opacity: 0.8,
  },
  suggestionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 20,
    gap: 8,
  },
  suggestionChip: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#374151',
    backgroundColor: 'transparent',
  },
  suggestionText: {
    color: '#9ca3af',
    fontSize: 13,
    fontWeight: '500',
  },
  loadingWrapper: {
    marginLeft: 44,
    marginBottom: 32,
  },
  inputContainer: {
    paddingBottom: 24,
    paddingTop: 8,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 16,
    backgroundColor: '#1c1c1c',
  },
  attachButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#262626',
    borderWidth: 1,
    borderColor: '#374151',
  },
  attachMenu: {
    position: 'absolute',
    bottom: 60,
    left: 0,
    backgroundColor: '#262626',
    borderRadius: 16,
    padding: 8,
    width: 120,
    borderWidth: 1,
    borderColor: '#374151',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 1000,
  },
  attachMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    gap: 10,
    borderRadius: 8,
  },
  attachMenuText: {
    color: '#9ca3af',
    fontSize: 14,
    fontWeight: '500',
  },
  attachmentPreviewContainer: {
    paddingTop: 12,
    backgroundColor: '#1c1c1c',
  },
  attachmentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#262626',
    borderRadius: 12,
    padding: 8,
    paddingRight: 12,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#374151',
    maxWidth: '100%',
  },
  attachmentIconContainer: {
    width: 32,
    height: 32,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  attachmentName: {
    color: '#ececed',
    fontSize: 13,
    fontWeight: '500',
    marginRight: 10,
    flexShrink: 1,
  },
  removeAttachment: {
    padding: 2,
  },
  inputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#262626',
    borderRadius: 28,
    borderWidth: 1.5,
    borderColor: '#374151',
    paddingHorizontal: 20,
    height: 56,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  inputWrapperListening: {
    borderColor: '#ef4444',
    borderWidth: 1.5,
    shadowColor: '#ef4444',
    shadowOpacity: 0.2,
  },
  inputWrapperFocused: {
    borderColor: '#10b981',
    borderWidth: 1.5,
    shadowColor: '#10b981',
    shadowOpacity: 0.2,
  },
  inputActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  voiceButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
    paddingVertical: 12,
    fontFamily: Platform.OS === 'web' ? 'Inter, sans-serif' : 'System',
  },
  sendButton: {
    width: 36,
    height: 36,
    backgroundColor: '#fff',
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  sendButtonDisabled: {
    backgroundColor: '#374151',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 2000,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  overlayBackground: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.8)',
  },
  calculatorWrapper: {
    width: '100%',
    maxWidth: 500,
  }
});


