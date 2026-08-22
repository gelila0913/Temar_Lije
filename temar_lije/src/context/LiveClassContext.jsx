import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { io } from 'socket.io-client';
import { startLiveSession as apiStartSession, endLiveSession as apiEndSession, getLiveToken } from '../services/apiClient';
import { getSocketUrl } from '../config/constants';

const LiveClassContext = createContext(null);

export function LiveClassProvider({ children }) {
  const [isLiveActive, setIsLiveActive] = useState(false);
  const [activeClassId, setActiveClassId] = useState(null);
  const [activeClassName, setActiveClassName] = useState('Live Classroom');
  const [isTeacher, setIsTeacher] = useState(false);
  const [currentUser, setCurrentUser] = useState({ name: 'User', role: 'Student' });
  const [sessionToken, setSessionToken] = useState(null);
  const [isMinimized, setIsMinimized] = useState(false);
  const [quickModal, setQuickModal] = useState(null); // null | 'quiz' | 'materials' | 'attendance'
  const [isConnecting, setIsConnecting] = useState(false);
  const [sessionError, setSessionError] = useState('');
  const [liveSocket, setLiveSocket] = useState(null);
  const [liveClassNotification, setLiveClassNotification] = useState(null);

  const socketRef = useRef(null);
  const activeClassIdRef = useRef(activeClassId);
  activeClassIdRef.current = activeClassId;
  const isLiveActiveRef = useRef(isLiveActive);
  isLiveActiveRef.current = isLiveActive;

  // Global socket listener to alert students when a teacher starts any live class
  useEffect(() => {
    const playNotificationChime = () => {
      try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.connect(gain);
        gain.connect(ctx.destination);
        const now = ctx.currentTime;
        osc.frequency.setValueAtTime(587.33, now); // D5
        osc.frequency.setValueAtTime(880, now + 0.12); // A5
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
        osc.start(now);
        osc.stop(now + 0.6);
      } catch (e) {
        // audio context blocked by browser autoplay policy until user gesture
      }
    };

    const localToken = localStorage.getItem('temar_token');
    const globalSocket = io(getSocketUrl(), {
      transports: ['websocket', 'polling'],
      auth: { token: localToken },
    });

    const liveNamespaceSocket = io(getSocketUrl('/live-class'), {
      transports: ['websocket', 'polling'],
      auth: { token: localToken },
    });

    const handleStarted = (data) => {
      if (!isLiveActiveRef.current || activeClassIdRef.current !== data.classId) {
        setLiveClassNotification({
          classId: data.classId,
          className: data.className || 'Live Classroom',
          teacherName: data.teacherName || 'Instructor',
          startedAt: data.startedAt || Date.now(),
        });
        playNotificationChime();
      }
    };

    const handleEnded = (data) => {
      setLiveClassNotification((prev) => (prev?.classId === data.classId ? null : prev));
    };

    globalSocket.on('liveClassStarted', handleStarted);
    globalSocket.on('liveClassEnded', handleEnded);

    liveNamespaceSocket.on('liveClassStarted', handleStarted);
    liveNamespaceSocket.on('liveClassEnded', handleEnded);

    return () => {
      globalSocket.disconnect();
      liveNamespaceSocket.disconnect();
    };
  }, []);

  // Clean up socket when active session ends or component unmounts
  const disconnectSocket = useCallback(() => {
    if (socketRef.current) {
      try {
        if (activeClassIdRef.current) {
          socketRef.current.emit('leaveLiveClass', { classId: activeClassIdRef.current });
        }
        socketRef.current.disconnect();
      } catch (e) {
        console.warn('Socket disconnect notice:', e);
      }
      socketRef.current = null;
      setLiveSocket(null);
    }
  }, []);

  const startSession = useCallback(
    async ({ classId, className = 'Live Classroom', teacher = false, user = { name: 'User' } }) => {
      if (isConnecting) return;
      setIsConnecting(true);
      setSessionError('');
      try {
        const cleanClassId = String(classId || '66666666-6666-4666-8666-666666666666');

        if (teacher) {
          try {
            await apiStartSession(cleanClassId);
          } catch (e) {
            console.warn('Backend start session notice:', e);
          }
        }

        const tokenRes = await getLiveToken(cleanClassId, user?.id || 'user-id');
        const token = tokenRes?.token || 'active-live-token';
        setSessionToken(token);

        // Initialize persistent WebSocket connection for live-class namespace
        const localToken = localStorage.getItem('temar_token');
        const socket = io(getSocketUrl('/live-class'), {
          transports: ['websocket', 'polling'],
          auth: { token: localToken },
          query: { classId: cleanClassId },
        });

        socketRef.current = socket;
        setLiveSocket(socket);

        socket.on('connect', () => {
          socket.emit('joinRoom', { classId: cleanClassId });
          socket.emit('joinLiveSession', { classId: cleanClassId });

          if (teacher) {
            const payload = {
              classId: cleanClassId,
              className,
              teacherName: user?.fullName || user?.name || 'Instructor',
            };
            socket.emit('teacherJoinedLive', payload);

            // Also broadcast on root chat namespace for immediate platform-wide student alert
            try {
              const rootSocket = io(getSocketUrl(), {
                transports: ['websocket', 'polling'],
                auth: { token: localToken },
              });
              rootSocket.emit('teacherJoinedLive', payload);
              setTimeout(() => rootSocket.disconnect(), 2000);
            } catch (e) {
              console.warn('Broadcast root notice:', e);
            }
          }
        });

        setActiveClassId(cleanClassId);
        setActiveClassName(className);
        setIsTeacher(teacher);
        setCurrentUser(user);
        setIsLiveActive(true);
        setIsMinimized(false);
        setLiveClassNotification(null);
      } catch (err) {
        console.error('Failed to initialize persistent live class session:', err);
        setSessionError(err.message || 'Could not start live session. Try again.');
        throw err;
      } finally {
        setIsConnecting(false);
      }
    },
    [isConnecting]
  );

  const endSession = useCallback(async () => {
    if (!activeClassId) return;
    try {
      if (isTeacher) {
        try {
          socketRef.current?.emit('teacherEndedLive', { classId: activeClassId });
          await apiEndSession(activeClassId);
        } catch (e) {
          console.warn('Backend end session notice:', e);
        }
      }
    } finally {
      disconnectSocket();
      setIsLiveActive(false);
      setActiveClassId(null);
      setSessionToken(null);
      setIsMinimized(false);
      setQuickModal(null);
      setSessionError('');
    }
  }, [activeClassId, isTeacher, disconnectSocket]);

  // Disconnect only on actual component unmount
  useEffect(() => {
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, []);

  const toggleMinimize = useCallback(() => {
    setIsMinimized((prev) => !prev);
  }, []);

  const openQuickModal = useCallback((type) => {
    setQuickModal(type);
  }, []);

  const closeQuickModal = useCallback(() => {
    setQuickModal(null);
  }, []);

  const dismissLiveNotification = useCallback(() => {
    setLiveClassNotification(null);
  }, []);

  const joinLiveNotification = useCallback(() => {
    if (liveClassNotification) {
      startSession({
        classId: liveClassNotification.classId,
        className: liveClassNotification.className,
        teacher: false,
        user: currentUser,
      });
      setLiveClassNotification(null);
    }
  }, [liveClassNotification, currentUser, startSession]);

  const value = {
    isLiveActive,
    activeClassId,
    activeClassName,
    isTeacher,
    currentUser,
    sessionToken,
    isMinimized,
    isConnecting,
    sessionError,
    quickModal,
    liveSocket,
    liveClassNotification,
    startSession,
    endSession,
    toggleMinimize,
    setIsMinimized,
    openQuickModal,
    closeQuickModal,
    setQuickModal,
    dismissLiveNotification,
    joinLiveNotification,
  };

  return <LiveClassContext.Provider value={value}>{children}</LiveClassContext.Provider>;
}

export function useLiveClass() {
  const context = useContext(LiveClassContext);
  if (!context) {
    throw new Error('useLiveClass must be used within a LiveClassProvider');
  }
  return context;
}

