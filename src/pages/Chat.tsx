import React, { useState, useRef, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { IonContent, IonIcon, IonPage } from '@ionic/react';
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
} from 'ionicons/icons';
import './Chat.css';

export interface ChatMessage {
  id: string;
  role: 'ai' | 'user';
  content: string;
  timestamp: string;
}

const MOCK_MESSAGES: ChatMessage[] = [
  {
    id: '1',
    role: 'ai',
    content: "Kumusta! I'm your Filipino AI tutor. How can I help you today? ▶️ 🇵🇭",
    timestamp: '10:30 AM',
  },
  {
    id: '2',
    role: 'user',
    content: 'Hi! Can you translate "Good morning" to Tagalog?',
    timestamp: '10:30 AM',
  },
  {
    id: '3',
    role: 'ai',
    content: '"Good morning" in Tagalog is "Magandang umaga" 🌅',
    timestamp: '10:31 AM',
  },
  {
    id: '4',
    role: 'user',
    content: 'Perfect! How about "Thank you"?',
    timestamp: '10:31 AM',
  },
  {
    id: '5',
    role: 'ai',
    content: '"Thank you" is "Salamat" 🙏 You\'re learning fast!',
    timestamp: '10:32 AM',
  },
];

const ChatPage: React.FC = () => {
  const location = useLocation();
  const isChat = location.pathname === '/chat';
  const [messages, setMessages] = useState<ChatMessage[]>(MOCK_MESSAGES);
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = () => {
    if (!inputValue.trim()) return;
    const newMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: inputValue.trim(),
      timestamp: new Date().toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      }),
    };
    setMessages((prev) => [...prev, newMessage]);
    setInputValue('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <IonPage>
      <IonContent fullscreen className="chat-content">
        <div className="chat-page">
          <header className="chat-header-sticky">
            <div className="chat-header">
              <div className="chat-header__brand">
                <IonIcon
                  icon={chatbubbleOutline}
                  className="chat-header__chat-icon"
                  aria-hidden
                />
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
          </header>

          <section className="chat-messages" aria-label="Chat conversation">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`chat-message chat-message--${msg.role}`}
                data-role={msg.role}
              >
                <div className="chat-message__avatar">
                  {msg.role === 'ai' ? (
                    <IonIcon icon={chatbubbleEllipsesOutline} aria-hidden />
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
                    <p className="chat-message__text">{msg.content}</p>
                  </div>
                  <span className="chat-message__time">{msg.timestamp}</span>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} aria-hidden />
          </section>

          <div className="chat-input-wrap">
            <button
              type="button"
              className="chat-input__attach"
              aria-label="Attach file"
            >
              <IonIcon icon={attachOutline} aria-hidden />
            </button>
            <input
              ref={inputRef}
              type="text"
              className="chat-input__field"
              placeholder="Type your message..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              aria-label="Message input"
            />
            <button
              type="button"
              className="chat-input__mic"
              aria-label="Voice input"
            >
              <IonIcon icon={micOutline} aria-hidden />
            </button>
            <button
              type="button"
              className="chat-input__send"
              onClick={handleSend}
              aria-label="Send message"
            >
              <IonIcon icon={send} aria-hidden />
            </button>
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
            <Link
              to="/chat"
              className={`chat-nav__item ${isChat ? 'chat-nav__item--active' : ''}`}
            >
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
    </IonPage>
  );
};

export default ChatPage;
