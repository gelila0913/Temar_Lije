import React, { useCallback, useState } from 'react';
import { Plus, MessageSquare, BookOpen, Loader2, Sparkles, GraduationCap } from 'lucide-react';
import styles from './study-buddy.module.css';

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
  const [startError, setStartError] = useState('');
  const [chatMessages, setChatMessages] = useState([]);
  const [userInput, setUserInput] = useState('');

  const suggestedPrompts = isTeacher ? TEACHER_PROMPTS : STUDENT_PROMPTS;

  const startChat = useCallback(
    async (prompt) => {
      if (isStartingChat) return;
      setIsStartingChat(true);
      setStartError('');
      try {
        let conversation;
        if (prompt ? onStartChat : onNewChat) {
          conversation = prompt ? await onStartChat(prompt) : await onNewChat();
        } else {
          await new Promise((resolve) => setTimeout(resolve, 800));
        }
        const next = conversation ?? {
          id: `${Date.now()}`,
          title: prompt ? prompt.slice(0, 48) : 'New conversation',
        };
        setConversations((prev) => [next, ...prev]);
        setActiveConversationId(next.id);

        if (prompt) {
          setChatMessages([
            { id: '1', sender: 'user', text: prompt },
            {
              id: '2',
              sender: 'ai',
              text: isTeacher
                ? `Here is the generated response for your teaching plan:\n\n1. Overview: Core concepts structured into 3 digestible modules.\n2. Key Highlights: Real-time synchronization, offline support, and interactive quizzes.\n3. Teaching Tip: Use practical code examples and live polls to boost engagement!`
                : `Here is a simplified explanation:\n\nThink of this concept like a classroom bulletin board. When a teacher posts an update (State change), everyone looking at the board immediately sees the new information without needing to ask repeatedly!`,
            },
          ]);
        }
      } catch (err) {
        setStartError('Could not start a new chat. Try again.');
      } finally {
        setIsStartingChat(false);
      }
    },
    [isStartingChat, isTeacher, onNewChat, onStartChat]
  );

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!userInput.trim()) return;
    const text = userInput.trim();
    setUserInput('');
    setChatMessages((prev) => [
      ...prev,
      { id: `${Date.now()}`, sender: 'user', text },
      {
        id: `${Date.now() + 1}`,
        sender: 'ai',
        text: `I'm analyzing your materials regarding: "${text}". Here is the recommended guidance tailored to your ${isTeacher ? 'curriculum' : 'study plan'}.`,
      },
    ]);
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
                  className={`${styles.conversationItem} ${isActive ? styles.active : ''}`}
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
            <div className={styles.bookBadge}>
              {isTeacher ? <GraduationCap className={styles.bookBadgeIcon} /> : <Sparkles className={styles.bookBadgeIcon} />}
            </div>

            <h2 className={styles.welcomeHeading}>
              {isTeacher ? 'AI Teaching Assistant' : 'AI Student Study Buddy'}
            </h2>
            <p className={styles.welcomeSubtitle}>
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
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '24px' }}>
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '20px' }}>
              {chatMessages.map((msg) => (
                <div
                  key={msg.id}
                  style={{
                    alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start',
                    maxWidth: '75%',
                    padding: '12px 18px',
                    borderRadius: '14px',
                    background: msg.sender === 'user' ? '#14785c' : (darkMode ? '#222b3c' : '#f3f4f6'),
                    color: msg.sender === 'user' ? '#ffffff' : (darkMode ? '#e2e8f0' : '#111827'),
                    lineHeight: '1.5',
                    fontSize: '0.925rem',
                    whiteSpace: 'pre-line',
                  }}
                >
                  {msg.text}
                </div>
              ))}
            </div>

            <form onSubmit={handleSendMessage} style={{ display: 'flex', gap: '10px' }}>
              <input
                type="text"
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                placeholder={`Ask your ${isTeacher ? 'AI Teacher Assistant' : 'Study Buddy'}...`}
                style={{
                  flex: 1,
                  padding: '12px 16px',
                  borderRadius: '999px',
                  border: '1px solid #d1d5db',
                  fontSize: '0.9rem',
                }}
              />
              <button
                type="submit"
                style={{
                  padding: '12px 24px',
                  borderRadius: '999px',
                  border: 'none',
                  background: '#14785c',
                  color: '#ffffff',
                  fontWeight: '600',
                  cursor: 'pointer',
                }}
              >
                Send
              </button>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}