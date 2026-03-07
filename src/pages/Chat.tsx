import React, { useState, useRef, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { IonContent, IonIcon, IonPage, useIonViewDidEnter } from '@ionic/react';
import {
  bookOutline,
  documentTextOutline,
  homeOutline,
  chatbubbleOutline,
  personCircleOutline,
  documentOutline,
  attachOutline,
  micOutline,
  send,
  settingsOutline,
  chatbubbleEllipsesOutline,
  playOutline,
  pauseOutline,
  volumeHighOutline,
  imageOutline,
  trashOutline,
  close,
  add,
  cameraOutline,
  imagesOutline,
  checkmark,
  chevronBack,
  chevronForward,
} from 'ionicons/icons';
import AttachmentModal from './AttachmentModal';
import VoiceRecordModal from './VoiceRecordModal';
import CameraModal from './CameraModal';
import QuickChatBubble from './QuickChatBubble';
import './Chat.css';

// Type definitions for Emergency Mode (from EmergencyDialectBubble)
interface Dialect {
  name: string;
  nativeName: string;
  flag: string;
}

interface EmergencyPhrase {
  label: string;
  text: string;
}

// OpenRouter API configuration
const OPENROUTER_API_KEY = import.meta.env.VITE_OPENROUTER_API_KEY;
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

// Quick Chat language definitions (matching QuickChatBubble)
const QUICK_CHAT_LANGUAGES: { [key: string]: { label: string; flag: string } } = {
  tagalog: { label: 'Tagalog', flag: '🇵🇭' },
  cebuano: { label: 'Cebuano', flag: '🌴' },
  ilocano: { label: 'Ilocano', flag: '🏝️' },
  hiligaynon: { label: 'Hiligaynon', flag: '🌸' },
  bicolano: { label: 'Bicolano', flag: '🌋' },
};

// System prompt for the AI
const SYSTEM_PROMPT = `You are SalinTayo AI, a Filipino language tutor and translator. 
Your role is to help users learn Filipino/Tagalog by:
- Translating English to Filipino and vice versa
- Explaining Filipino words, phrases, and grammar
- Providing example sentences
- Being friendly, patient, and encouraging

Always respond in a helpful and educational manner. If asked about images, analyze them and provide translations of any text you see.`;

// Function to call OpenRouter API
async function askOpenRouter(messages: { role: 'system' | 'user' | 'assistant'; content: string }[], customSystemPrompt?: string): Promise<string> {
  if (!OPENROUTER_API_KEY || OPENROUTER_API_KEY === 'your_openrouter_api_key_here') {
    throw new Error('OpenRouter API key not configured. Please add VITE_OPENROUTER_API_KEY to your .env file.');
  }

  console.log('OpenRouter API Key loaded:', OPENROUTER_API_KEY ? `${OPENROUTER_API_KEY.substring(0, 10)}...` : 'NOT LOADED');
  console.log('Request URL:', OPENROUTER_API_URL);

  const systemPrompt = customSystemPrompt || SYSTEM_PROMPT;

  const response = await fetch(OPENROUTER_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'HTTP-Referer': window.location.origin || 'http://localhost:5173',
      'X-Title': 'SalinTayo AI',
    },
    body: JSON.stringify({
      model: 'arcee-ai/trinity-large-preview:free',
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages
      ],
      max_tokens: 1000,
      temperature: 0.7,
      reasoning: { enabled: true }
    }),
  });

  console.log('OpenRouter Response Status:', response.status);
  console.log('OpenRouter Response OK:', response.ok);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error('OpenRouter Error Response:', errorData);
    throw new Error(errorData.error?.message || `API request failed: ${response.status} - ${JSON.stringify(errorData)}`);
  }

  const data = await response.json();
  console.log('OpenRouter Response Data:', JSON.stringify(data, null, 2));
  
  const message = data.choices?.[0]?.message;
  const content = message?.content || message?.reasoning_details || 'Sorry, I could not generate a response.';
  
  return content;
}

// Function to analyze images with OpenRouter vision
async function analyzeImageWithVision(imageBase64: string, userPrompt: string): Promise<string> {
  if (!OPENROUTER_API_KEY || OPENROUTER_API_KEY === 'your_openrouter_api_key_here') {
    throw new Error('OpenRouter API key not configured. Please add VITE_OPENROUTER_API_KEY to your .env file.');
  }

  const response = await fetch(OPENROUTER_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'HTTP-Referer': window.location.origin,
      'X-Title': 'SalinTayo AI',
    },
    body: JSON.stringify({
      model: 'arcee-ai/trinity-large-preview:free',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: [
            { type: 'text', text: userPrompt || 'Analyze this image and translate any text you see to Filipino/Tagalog. Provide the translation.' },
            { type: 'image_url', image_url: { url: imageBase64 } }
          ]
        }
      ],
      max_tokens: 1000,
      temperature: 0.7,
      reasoning: { enabled: true }
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `API request failed: ${response.status}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || 'Sorry, I could not analyze the image.';
}

export interface ChatMessage {
  id: string;
  role: 'ai' | 'user';
  content: string;
  timestamp: string;
  type?: 'text' | 'voice' | 'image';
  audioUrl?: string;
  audioDuration?: number;
  imageUrl?: string;
  translationMode?: 'ocr' | 'describe' | 'ask';
}

interface PendingImage {
  id: string;
  data: string;
  caption: string;
  selected: boolean;
}

interface LocationState {
  emergencyDialect?: Dialect;
  emergencyPhrases?: EmergencyPhrase[];
}

const formatTime = () =>
  new Date().toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

const formatDuration = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const ChatPage: React.FC = () => {
  const location = useLocation<LocationState>();
  const isChat = location.pathname === '/chat';
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isAttachmentModalOpen, setIsAttachmentModalOpen] = useState(false);
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);
  const [isCameraModalOpen, setIsCameraModalOpen] = useState(false);
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  
  // Image attachment state - Messenger/DeepSeek style
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([]);
  const [isImageTrayOpen, setIsImageTrayOpen] = useState(false);
  const [isFullscreenPreview, setIsFullscreenPreview] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [selectMode, setSelectMode] = useState(false);
  
  // ── Emergency mode state ──────────────────────────────────────────────
  const [isEmergencyMode, setIsEmergencyMode] = useState(false);
  const [emergencyDialect, setEmergencyDialect] = useState<Dialect | null>(null);
  const [emergencyPhrases, setEmergencyPhrases] = useState<EmergencyPhrase[]>([]);
  
  // ── Quick Chat mode state ─────────────────────────────────────────────
  const [isQuickChatMode, setIsQuickChatMode] = useState(false);
  const [quickChatLanguage, setQuickChatLanguage] = useState<string | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const filePickerRef = useRef<HTMLInputElement>(null);
  const audioRefs = useRef<{ [key: string]: HTMLAudioElement }>({});

  // ── Handle emergency dialect injection on mount ──
  useEffect(() => {
    const { emergencyDialect: dial, emergencyPhrases: phrases } = location.state ?? {};
    if (!dial || !phrases) return;

    setEmergencyDialect(dial);
    setEmergencyPhrases(phrases);
    setIsEmergencyMode(true);

    window.history.replaceState({}, document.title);
  }, []);

  // ── Handle Quick Chat mode from query parameters ───────────────────────
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const lang = searchParams.get('lang');
    const quickmode = searchParams.get('quickmode');

    if (lang && quickmode === 'true' && QUICK_CHAT_LANGUAGES[lang]) {
      setQuickChatLanguage(lang);
      setIsQuickChatMode(true);
      try {
        localStorage.setItem('salintayo_quickchat_lang', lang);
      } catch {}
    } else {
      try {
        const savedLang = localStorage.getItem('salintayo_quickchat_lang');
        if (savedLang && QUICK_CHAT_LANGUAGES[savedLang]) {
          setQuickChatLanguage(savedLang);
          setIsQuickChatMode(true);
        }
      } catch {}
    }
  }, [location.search]);

  // ── Generate language-specific system prompt ───────────────────────────
  const getLanguageSystemPrompt = (langCode: string | null): string => {
    if (!langCode || !QUICK_CHAT_LANGUAGES[langCode]) {
      return SYSTEM_PROMPT;
    }
    const lang = QUICK_CHAT_LANGUAGES[langCode];
    return `You are SalinTayo AI, a Filipino language tutor and translator specializing in ${lang.label}.
Your role is to help users learn ${lang.label} by:
- Translating English to ${lang.label} and vice versa
- Explaining ${lang.label} words, phrases, and grammar
- Providing example sentences in ${lang.label}
- Being friendly, patient, and encouraging

Always respond primarily in ${lang.label} when the user communicates in English. If asked about images, analyze them and provide translations in ${lang.label}.`;
  };

  // ── Handle quick phrase click ─────────────────────────────────────────
  const handleQuickPhraseClick = (phrase: EmergencyPhrase) => {
    setInputValue(phrase.text);
    inputRef.current?.focus();
  };

  // ── Dismiss emergency mode ───────────────────────────────────────────
  const handleDismissEmergency = () => {
    setIsEmergencyMode(false);
    setEmergencyDialect(null);
    setEmergencyPhrases([]);
  };

  // ── Dismiss Quick Chat mode ─────────────────────────────────────────────
  const handleDismissQuickChat = () => {
    setIsQuickChatMode(false);
    setQuickChatLanguage(null);
    try {
      localStorage.removeItem('salintayo_quickchat_lang');
    } catch {}
  };

  useEffect(() => {
    return () => {
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
    };
  }, []);

  useIonViewDidEnter(() => {
    const firstFocusable = document.querySelector<HTMLElement>('.chat-input__field');
    if (firstFocusable) {
      firstFocusable.focus();
    }
  });

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    return () => {
      Object.values(audioRefs.current).forEach(audio => {
        audio.pause();
        audio.src = '';
      });
    };
  }, []);

  const handleSend = async () => {
    const text = inputValue.trim();
    if (!text || isLoading) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: formatTime(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      const conversationHistory = messages.slice(-10).map(msg => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content
      }));
      conversationHistory.push({ role: 'user', content: text });
      
      const systemPrompt = getLanguageSystemPrompt(quickChatLanguage);
      const reply = await askOpenRouter(conversationHistory, systemPrompt);
      
      const aiMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'ai',
        content: reply || 'Sorry, I could not generate a response. Please try again.',
        timestamp: formatTime(),
      };
      setMessages((prev) => [...prev, aiMessage]);
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : 'Failed to get response';
      const fallbackMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'ai',
        content: `Sorry, something went wrong: ${errMsg}. Please check your API key configuration.`,
        timestamp: formatTime(),
      };
      setMessages((prev) => [...prev, fallbackMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleAttachmentClick = () => {
    setIsAttachmentModalOpen(true);
  };

  const handleVoiceClick = () => {
    setIsVoiceModalOpen(true);
  };

  const handleAttachmentSelect = (type: 'camera' | 'gallery' | 'document' | 'voice' | 'location') => {
    if (type === 'camera') {
      setIsAttachmentModalOpen(false);
      setIsCameraModalOpen(true);
      return;
    }
    if (type === 'gallery') {
      filePickerRef.current?.click();
      setIsAttachmentModalOpen(false);
      return;
    }
    const featureMessages: Record<string, string> = {
      document: '📄 Document attachment coming soon!',
      voice: '🎤 Voice recording coming soon!',
      location: '📍 Location sharing coming soon!',
    };
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: featureMessages[type],
      timestamp: formatTime(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setIsAttachmentModalOpen(false);
  };

  const handleCameraCapture = (imageData: string) => {
    const newImage: PendingImage = {
      id: Date.now().toString(),
      data: imageData,
      caption: '',
      selected: false,
    };
    setPendingImages(prev => [...prev, newImage]);
    setIsImageTrayOpen(true);
    setIsCameraModalOpen(false);
  };

  const handleFilePickerChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        const newImage: PendingImage = {
          id: Date.now().toString() + i + Math.random().toString(),
          data: base64,
          caption: '',
          selected: false,
        };
        setPendingImages(prev => [...prev, newImage]);
      };
      reader.readAsDataURL(file);
    }
    setIsImageTrayOpen(true);
    e.target.value = '';
  };

  const handleRemoveImage = (id: string) => {
    setPendingImages(prev => prev.filter(img => img.id !== id));
    if (pendingImages.length <= 1) {
      setIsImageTrayOpen(false);
      setIsFullscreenPreview(false);
    } else if (previewIndex >= pendingImages.length - 1) {
      setPreviewIndex(Math.max(0, pendingImages.length - 2));
    }
  };

  const handleToggleSelect = (id: string) => {
    setPendingImages(prev => prev.map(img => 
      img.id === id ? { ...img, selected: !img.selected } : img
    ));
  };

  const handleSelectAll = () => {
    const allSelected = pendingImages.every(img => img.selected);
    setPendingImages(prev => prev.map(img => ({ ...img, selected: !allSelected })));
  };

  const handleDeleteSelected = () => {
    setPendingImages(prev => prev.filter(img => !img.selected));
    setSelectMode(false);
    if (pendingImages.filter(img => !img.selected).length === 0) {
      setIsImageTrayOpen(false);
      setIsFullscreenPreview(false);
    }
  };

  const handleUpdateCaption = (id: string, caption: string) => {
    setPendingImages(prev => prev.map(img => 
      img.id === id ? { ...img, caption } : img
    ));
  };

  const handleOpenFullscreen = (index: number) => {
    setPreviewIndex(index);
    setIsFullscreenPreview(true);
  };

  const handleCloseFullscreen = () => {
    setIsFullscreenPreview(false);
  };

  const handlePrevImage = () => {
    setPreviewIndex(prev => Math.max(0, prev - 1));
  };

  const handleNextImage = () => {
    setPreviewIndex(prev => Math.min(pendingImages.length - 1, prev + 1));
  };

  const handleAddMoreFromPreview = () => {
    filePickerRef.current?.click();
  };

  const handleSendImages = async () => {
    if (pendingImages.length === 0) return;
    
    const imagesToSend = [...pendingImages];
    const caption = inputValue.trim();
    
    imagesToSend.forEach((img, index) => {
      const userMessage: ChatMessage = {
        id: (Date.now() + index).toString(),
        role: 'user',
        content: caption || `📷 Image ${index + 1}`,
        timestamp: formatTime(),
        type: 'image',
        imageUrl: img.data,
        translationMode: 'ocr',
      };
      setMessages(prev => [...prev, userMessage]);
    });
    
    setPendingImages([]);
    setIsImageTrayOpen(false);
    setIsFullscreenPreview(false);
    setSelectMode(false);
    setInputValue('');
    setIsLoading(true);
    
    const aiMessage: ChatMessage = {
      id: (Date.now() + 1000).toString(),
      role: 'ai',
      content: `🔍 I've analyzed your ${imagesToSend.length} image${imagesToSend.length > 1 ? 's' : ''}! (Vision analysis with OpenRouter coming soon)`,
      timestamp: formatTime(),
    };
    setMessages(prev => [...prev, aiMessage]);
    setIsLoading(false);
  };

  const handleTrayClose = () => {
    setIsImageTrayOpen(false);
    setIsFullscreenPreview(false);
    setSelectMode(false);
    setPendingImages([]);
  };

  const handleVoiceSend = (audioBlob: Blob, caption: string) => {
    const audioUrl = URL.createObjectURL(audioBlob);
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: caption || '🎤 Voice message',
      timestamp: formatTime(),
      type: 'voice',
      audioUrl,
      audioDuration: 0,
    };
    setMessages((prev) => [...prev, userMessage]);
  };

  const toggleVoicePlayback = (messageId: string, audioUrl: string) => {
    if (playingVoiceId === messageId) {
      audioRefs.current[messageId]?.pause();
      setPlayingVoiceId(null);
    } else {
      if (audioRefs.current[messageId]) {
        audioRefs.current[messageId].play();
      } else {
        const audio = new Audio(audioUrl);
        audioRefs.current[messageId] = audio;
        audio.onended = () => setPlayingVoiceId(null);
        audio.play();
      }
      setPlayingVoiceId(messageId);
    }
  };

  const renderMessageContent = (msg: ChatMessage) => {
    if (msg.type === 'voice') {
      return (
        <div className="chat-voice-message">
          <button 
            className="chat-voice-play-btn"
            onClick={() => msg.audioUrl && toggleVoicePlayback(msg.id, msg.audioUrl)}
          >
            <IonIcon icon={playingVoiceId === msg.id ? pauseOutline : playOutline} />
          </button>
          <div className="chat-voice-waveform">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="chat-voice-waveform-bar"></div>
            ))}
          </div>
          {msg.audioDuration && (
            <span className="chat-voice-duration">{formatDuration(msg.audioDuration)}</span>
          )}
          {msg.content !== '🎤 Voice message' && (
            <p className="chat-voice-caption">{msg.content}</p>
          )}
        </div>
      );
    }
    
    if (msg.type === 'image') {
      return (
        <div className="chat-image-message">
          {msg.imageUrl && (
            <div className="chat-image-thumbnail">
              <img src={msg.imageUrl} alt="User upload" />
            </div>
          )}
          {msg.content && msg.content !== `📷 Image` && (
            <p className="chat-image-caption">{msg.content}</p>
          )}
        </div>
      );
    }
    
    return <p className="chat-message__text">{msg.content}</p>;
  };

  const selectedCount = pendingImages.filter(img => img.selected).length;

  return (
    <>
    <QuickChatBubble />
    <IonPage>
      <IonContent fullscreen className="chat-content">
        <div className="chat-page">
          <header className="chat-header-sticky">
            <div className="chat-header">
              <div className="chat-header__brand">
                <IonIcon icon={chatbubbleOutline} className="chat-header__chat-icon" aria-hidden />
                <div className="chat-header__text">
                  <h1 className="chat-header__title">SalinTayo AI</h1>
                  <p className="chat-header__tagline">Translate. Learn. Converse.</p>
                </div>
              </div>
              <button
                type="button"
                className="chat-header__action-btn"
                aria-label="Open chat history or options"
              >
                <IonIcon icon={documentOutline} aria-hidden />
              </button>
            </div>
            <div className="chat-header__dots" role="tablist" aria-label="Page indicator">
              <span className="chat-header__dot" aria-hidden />
              <span className="chat-header__dot chat-header__dot--active" aria-hidden />
              <span className="chat-header__dot" aria-hidden />
            </div>
            <hr className="chat-header__divider" />

            {/* Emergency Mode Banner */}
            {isEmergencyMode && emergencyDialect && (
              <div className="chat-emergency-banner" role="alert" aria-live="assertive">
                <div className="chat-emergency-banner__left">
                  <span className="chat-emergency-banner__icon">🚨</span>
                  <div>
                    <span className="chat-emergency-banner__title">EMERGENCY MODE</span>
                    <span className="chat-emergency-banner__dialect">
                      {emergencyDialect.flag} {emergencyDialect.name} · {emergencyDialect.nativeName}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  className="chat-emergency-banner__dismiss"
                  onClick={handleDismissEmergency}
                  aria-label="Dismiss emergency mode"
                >
                  ✕
                </button>
              </div>
            )}

            {/* Quick Chat Mode Banner */}
            {isQuickChatMode && quickChatLanguage && QUICK_CHAT_LANGUAGES[quickChatLanguage] && !isEmergencyMode && (
              <div className="chat-quickchat-banner" role="status" aria-live="polite">
                <div className="chat-quickchat-banner__left">
                  <span className="chat-quickchat-banner__icon">⚡</span>
                  <div>
                    <span className="chat-quickchat-banner__title">Quick Chat</span>
                    <span className="chat-quickchat-banner__language">
                      {QUICK_CHAT_LANGUAGES[quickChatLanguage].flag} {QUICK_CHAT_LANGUAGES[quickChatLanguage].label}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  className="chat-quickchat-banner__dismiss"
                  onClick={handleDismissQuickChat}
                  aria-label="Exit Quick Chat mode"
                >
                  ✕
                </button>
              </div>
            )}

            {/* Emergency Quick Phrases */}
            {isEmergencyMode && emergencyPhrases.length > 0 && (
              <div className="chat-emergency-phrases" role="group" aria-label="Emergency phrases">
                <p className="chat-emergency-phrases__label">Quick Phrases:</p>
                <div className="chat-emergency-phrases__list">
                  {emergencyPhrases.map((phrase, i) => (
                    <button
                      key={i}
                      type="button"
                      className="chat-emergency-phrase-btn"
                      onClick={() => handleQuickPhraseClick(phrase)}
                      title={phrase.text}
                    >
                      <span className="chat-emergency-phrase-btn__label">{phrase.label}</span>
                      <span className="chat-emergency-phrase-btn__text">{phrase.text}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </header>

          <section className="chat-messages" aria-label="Chat conversation">
            {messages.length === 0 && !isEmergencyMode && (
              <div className="chat-empty-state">
                {isQuickChatMode && quickChatLanguage && QUICK_CHAT_LANGUAGES[quickChatLanguage] ? (
                  <>
                    <p>⚡ Quick Chat Mode: {QUICK_CHAT_LANGUAGES[quickChatLanguage].flag} {QUICK_CHAT_LANGUAGES[quickChatLanguage].label}</p>
                    <p>Start chatting and I&apos;ll respond in {QUICK_CHAT_LANGUAGES[quickChatLanguage].label}!</p>
                  </>
                ) : (
                  <>
                    <p>Kumusta! I&apos;m your Filipino AI tutor.</p>
                    <p>Type a message or attach an image to translate.</p>
                  </>
                )}
              </div>
            )}
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`chat-message chat-message--${msg.role} ${msg.type === 'image' ? 'chat-message--image' : ''}`}
                data-role={msg.role}
              >
                <div className="chat-message__avatar">
                  {msg.role === 'ai' ? (
                    <IonIcon icon={chatbubbleEllipsesOutline} aria-hidden />
                  ) : msg.type === 'voice' ? (
                    <IonIcon icon={volumeHighOutline} aria-hidden />
                  ) : msg.type === 'image' ? (
                    <IonIcon icon={imageOutline} aria-hidden />
                  ) : (
                    <IonIcon icon={personCircleOutline} aria-hidden />
                  )}
                </div>
                <div className="chat-message__bubble-wrap">
                  <div className="chat-message__bubble">
                    {msg.role === 'ai' && (
                      <button
                        type="button"
                        className="chat-message__settings"
                        aria-label="Message options"
                      >
                        <IonIcon icon={settingsOutline} aria-hidden />
                      </button>
                    )}
                    {renderMessageContent(msg)}
                  </div>
                  <span className="chat-message__time">{msg.timestamp}</span>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="chat-message chat-message--ai chat-message--loading" data-role="ai">
                <div className="chat-message__avatar">
                  <IonIcon icon={chatbubbleEllipsesOutline} aria-hidden />
                </div>
                <div className="chat-message__bubble-wrap">
                  <div className="chat-message__bubble">
                    <p className="chat-message__text chat-message__typing">Thinking...</p>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} aria-hidden />
          </section>

          {/* Hidden file input */}
          <input
            ref={filePickerRef}
            type="file"
            accept="image/*"
            multiple
            style={{ display: 'none' }}
            onChange={handleFilePickerChange}
          />

          {/* Inline Image Preview — attached above input bar */}
          {isImageTrayOpen && pendingImages.length > 0 && (
            <div className="chat-inline-preview">
              <div className="chat-inline-preview__strip">
                {pendingImages.map((img, index) => (
                  <div key={img.id} className="chat-inline-preview__thumb">
                    <img src={img.data} alt={`Preview ${index + 1}`} />
                    <button
                      type="button"
                      className="chat-inline-preview__remove"
                      onClick={() => handleRemoveImage(img.id)}
                      aria-label="Remove image"
                    >
                      <IonIcon icon={close} aria-hidden />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  className="chat-inline-preview__add"
                  onClick={() => filePickerRef.current?.click()}
                  aria-label="Add more images"
                >
                  <IonIcon icon={add} aria-hidden />
                </button>
              </div>
            </div>
          )}

          {/* Input Bar */}
          <div className={`chat-input-wrap ${isImageTrayOpen ? 'chat-input-wrap--with-preview' : ''}`}>
            <button
              type="button"
              className="chat-input__attach"
              onClick={handleAttachmentClick}
              aria-label="Attach file"
            >
              <IonIcon icon={attachOutline} aria-hidden />
            </button>
            <input
              ref={inputRef}
              type="text"
              className="chat-input__field"
              placeholder={isImageTrayOpen ? 'Add a caption or question...' : 'Type your message...'}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  isImageTrayOpen ? handleSendImages() : handleSend();
                }
              }}
              aria-label="Message input"
            />
            <button
              type="button"
              className="chat-input__mic"
              onClick={isImageTrayOpen ? () => filePickerRef.current?.click() : handleVoiceClick}
              aria-label={isImageTrayOpen ? 'Add more images' : 'Voice input'}
            >
              <IonIcon icon={isImageTrayOpen ? imagesOutline : micOutline} aria-hidden />
            </button>
            {isImageTrayOpen ? (
              <button
                type="button"
                className="chat-input__send chat-input__send--image"
                onClick={handleSendImages}
                disabled={isLoading || pendingImages.length === 0}
                aria-label="Send images"
              >
                <IonIcon icon={send} aria-hidden />
                {pendingImages.length > 1 && <span className="chat-input__send-badge">{pendingImages.length}</span>}
              </button>
            ) : (
              <button
                type="button"
                className="chat-input__send"
                onClick={handleSend}
                disabled={isLoading || !inputValue.trim()}
                aria-label="Send message"
              >
                <IonIcon icon={send} aria-hidden />
              </button>
            )}
          </div>
        </div>

        <footer className="chat-footer">
          <nav className="chat-nav" aria-label="Main">
            <Link to="/learn" className="chat-nav__item">
              <IonIcon icon={bookOutline} className="chat-nav__icon" />
              <span className="chat-nav__label">Learn</span>
            </Link>
            <Link to="/quiz" className="chat-nav__item">
              <IonIcon icon={documentTextOutline} className="chat-nav__icon" />
              <span className="chat-nav__label">Quiz</span>
            </Link>
            <Link to="/home" className="chat-nav__item">
              <IonIcon icon={homeOutline} className="chat-nav__icon" />
              <span className="chat-nav__label">Home</span>
            </Link>
            <Link to="/chat" className={`chat-nav__item ${isChat ? 'chat-nav__item--active' : ''}`}>
              <IonIcon icon={chatbubbleOutline} className="chat-nav__icon" />
              <span className="chat-nav__label">Chat</span>
            </Link>
            <Link to="/profile" className="chat-nav__item">
              <IonIcon icon={personCircleOutline} className="chat-nav__icon" />
              <span className="chat-nav__label">Profile</span>
            </Link>
          </nav>
        </footer>
      </IonContent>

      <AttachmentModal
        isOpen={isAttachmentModalOpen}
        onClose={() => setIsAttachmentModalOpen(false)}
        onAttachmentSelect={handleAttachmentSelect}
      />

      <VoiceRecordModal
        isOpen={isVoiceModalOpen}
        onClose={() => setIsVoiceModalOpen(false)}
        onSendVoice={handleVoiceSend}
      />

      <CameraModal
        isOpen={isCameraModalOpen}
        onClose={() => setIsCameraModalOpen(false)}
        onCapture={handleCameraCapture}
        onOpenGallery={() => filePickerRef.current?.click()}
      />
    </IonPage>
    </>
  );
};

export default ChatPage;
