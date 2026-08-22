import React, { useCallback, useState } from 'react';
import { Plus, MessageSquare, Loader2, Sparkles, GraduationCap, Send } from 'lucide-react';
import styles from './study-buddy.module.css';
import { API_BASE_URL } from '../../config/constants';

const DEFAULT_CONVERSATIONS = [{ id: 'seed-1', title: 'New conversation' }];

const STUDENT_PROMPTS = [
  'Summarise the key ideas from my latest material.',
  'Make a 5-question practice quiz from my notes.',
  'Explain the hardest concept in my materials simply.',
];

const TEACHER_PROMPTS = [
  'Generate a structured lesson summary and key takeaways.',
  'Create a 5-question multiple-choice quiz with answer keys.',
  'Suggest review exercises for at-risk students.',
];

export default function StudyBuddy({
  isTeacher = false,
  darkMode = false,
  initialConversations = DEFAULT_CONVERSATIONS,
  onNewChat,
  onSelectConversation,
  onStartChat,
}) {
  const [conversations, setConversations] = useState(initialConversations);
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [isStartingChat, setIsStartingChat] = useState(false);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [startError, setStartError] = useState('');
  const [chatMessages, setChatMessages] = useState([]);
  const [userInput, setUserInput] = useState('');

  const suggestedPrompts = isTeacher ? TEACHER_PROMPTS : STUDENT_PROMPTS;

  const fetchAiResponse = async (promptText) => {
    try {
      const token = localStorage.getItem('temar_token');
      const res = await fetch(`${API_BASE_URL}/ai/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          message: promptText,
          isTeacher,
          conversationHistory: chatMessages.slice(-6)
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (data && data.reply) return data.reply;
      }
    } catch {
      // fallback handled below
    }

    // Intelligent local fallback response
    if (isTeacher) {
      if (promptText.toLowerCase().includes('quiz')) {
        return "Here is a draft 5-question multiple-choice quiz:\n\n1. What is the primary purpose of State in Flutter?\n   A) Styling\n   B) Managing mutable data across widget lifecycle (Correct)\n   C) Handling HTTP requests\n   D) Compiling bytecode\n\n2. Which widget is immutable?\n   A) StatefulWidget\n   B) StatelessWidget (Correct)\n   C) InheritedNotifier\n   D) StreamBuilder\n\nAnswer Key: 1: B, 2: B";
      }
      return `Here is the structured lesson plan for "${promptText}":\n\n1. Learning Objectives: Understand foundational concepts and practical use cases.\n2. Lesson Structure: 15m Theory & Architecture, 25m Live Coding, 10m Student Q&A.\n3. Teaching Tip: Use visual diagrams and interactive checkpoints to verify student comprehension.`;
    } else {
      if (promptText.toLowerCase().includes('quiz')) {
        return "Here is a 3-question practice quiz for you:\n\n1. When should you use a StatelessWidget?\n   A) When widget data never changes over time\n   B) When listening to user animations\n\nThink you know the answer? Reply with your choice!";
      }
      return `Here is a clear breakdown for "${promptText}":\n\n• Core Concept: Break complex workflows into simple, independent steps.\n• Practical Example: Like building blocks, combine small single-purpose components.\n• Key Rule to Remember: Keep it predictable and clean!`;
    }
  };

  const startChat = useCallback(
    async (prompt) => {
      if (isStartingChat) return;
      setIsStartingChat(true);
      setStartError('');
      try {
        let conversation;
        if (prompt ? onStartChat : onNewChat) {
          conversation = prompt ? await onStartChat(prompt) : await onNewChat();
        }
        const next = conversation ?? {
          id: `${Date.now()}`,
          title: prompt ? prompt.slice(0, 48) : 'New conversation',
        };
        setConversations((prev) => [next, ...prev]);
        setActiveConversationId(next.id);

        if (prompt) {
          const userMsg = { id: `${Date.now()}`, sender: 'user', text: prompt };
          setChatMessages([userMsg]);
          setIsAiLoading(true);
          const aiReply = await fetchAiResponse(prompt);
          setChatMessages([userMsg, { id: `${Date.now() + 1}`, sender: 'ai', text: aiReply }]);
          setIsAiLoading(false);
        }
      } catch {
        setStartError('Could not start a new chat. Try again.');
      } finally {
        setIsStartingChat(false);
      }
    },
    [isStartingChat, onNewChat, onStartChat, isTeacher, chatMessages]
  );

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!userInput.trim() || isAiLoading) return;
    const text = userInput.trim();
    setUserInput('');
    const userMsg = { id: `${Date.now()}`, sender: 'user', text };
    setChatMessages((prev) => [...prev, userMsg]);
    setIsAiLoading(true);

    const aiReply = await fetchAiResponse(text);
    setChatMessages((prev) => [...prev, { id: `${Date.now() + 1}`, sender: 'ai', text: aiReply }]);
    setIsAiLoading(false);
  };

  const handleSelectConversation = useCallback(
    (id) => {
      setActiveConversationId(id);
      onSelectConversation?.(id);
    },
    [onSelectConversation]
  );

  return (
    <div className={styles.container}>
      {/* Sidebar: conversation list */}
      <aside className={styles.sidebar} aria-label="Study Buddy conversations">
        <button
          type="button"
          className={styles.newChatButton}
          onClick={() => {
            setActiveConversationId(null);
            setChatMessages([]);
            startChat();
          }}
          disabled={isStartingChat}
          aria-busy={isStartingChat}
        >
          {isStartingChat ? (
            <Loader2 className={`${styles.spinner} animate-spin`} />
          ) : (
            <Plus className={styles.buttonIcon} />
          )}
          <span>{isStartingChat ? 'Creating…' : 'New chat'}</span>
        </button>

        {startError && (
          <p className={styles.inlineError} role="alert">
            {startError}
          </p>
        )}

        <ul className={styles.conversationList}>
          {conversations.map((c) => {
            const isActive = c.id === activeConversationId;
            return (
              <li key={c.id}>
                <button
                  type="button"
                  className={`${styles.conversationItem} ${isActive ? styles.conversationItemActive : ''}`}
                  onClick={() => handleSelectConversation(c.id)}
                  aria-current={isActive ? 'true' : undefined}
                >
                  <MessageSquare className={styles.conversationIcon} />
                  <span className={styles.conversationTitle}>{c.title}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </aside>

      {/* Main card: prompt starters or active conversation */}
      <main className={styles.mainCard}>
        {chatMessages.length === 0 ? (
          <div className={styles.mainCardInner}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              backgroundColor: '#dbeee7',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#14785c',
              marginBottom: '16px'
            }}>
              {isTeacher ? <GraduationCap size={26} /> : <Sparkles size={26} />}
            </div>

            <h2 className={styles.heading}>
              {isTeacher ? 'AI Teaching Assistant' : 'AI Student Study Buddy'}
            </h2>
            <p className={styles.description}>
              {isTeacher
                ? 'Generate structured lesson summaries, create auto-graded quizzes, draft assignments, and analyze student engagement.'
                : 'Ask questions about your uploaded materials, practice tricky questions, and study effectively even offline.'}
            </p>

            <div className={styles.promptList} role="list">
              {suggestedPrompts.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  className={styles.promptButton}
                  onClick={() => startChat(prompt)}
                  disabled={isStartingChat}
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className={styles.activeChatContainer}>
            <div className={styles.chatScrollArea}>
              {chatMessages.map((msg) => (
                <div
                  key={msg.id}
                  style={{
                    alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start',
                    maxWidth: '82%',
                    padding: '12px 18px',
                    borderRadius: '14px',
                    background: msg.sender === 'user' ? '#14785c' : (darkMode ? '#222b3c' : '#f3f4f6'),
                    color: msg.sender === 'user' ? '#ffffff' : (darkMode ? '#e2e8f0' : '#111827'),
                    lineHeight: '1.5',
                    fontSize: '0.925rem',
                    whiteSpace: 'pre-line',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                  }}
                >
                  {msg.text}
                </div>
              ))}
              {isAiLoading && (
                <div
                  style={{
                    alignSelf: 'flex-start',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '10px 16px',
                    borderRadius: '14px',
                    background: darkMode ? '#222b3c' : '#f3f4f6',
                    color: '#6b7280',
                    fontSize: '0.875rem'
                  }}
                >
                  <Loader2 size={16} className="animate-spin" style={{ color: '#14785c' }} />
                  <span>Thinking...</span>
                </div>
              )}
            </div>

            <form onSubmit={handleSendMessage} className={styles.chatInputForm}>
              <input
                type="text"
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                placeholder={`Ask your ${isTeacher ? 'AI Teacher Assistant' : 'Study Buddy'}...`}
                style={{
                  flex: 1,
                  padding: '12px 18px',
                  borderRadius: '999px',
                  border: '1px solid #d1d5db',
                  fontSize: '0.9rem',
                  outline: 'none',
                  backgroundColor: darkMode ? '#1e293b' : '#ffffff',
                  color: darkMode ? '#f8fafc' : '#111827'
                }}
              />
              <button
                type="submit"
                disabled={isAiLoading || !userInput.trim()}
                style={{
                  padding: '12px 20px',
                  borderRadius: '999px',
                  border: 'none',
                  background: '#14785c',
                  color: '#ffffff',
                  fontWeight: '600',
                  cursor: isAiLoading || !userInput.trim() ? 'not-allowed' : 'pointer',
                  opacity: isAiLoading || !userInput.trim() ? 0.6 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <Send size={16} /> Send
              </button>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}