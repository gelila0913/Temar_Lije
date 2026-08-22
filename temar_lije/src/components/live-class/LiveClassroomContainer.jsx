import React, { useState, useEffect, useRef, Component } from 'react';
import { JitsiMeeting } from '@jitsi/react-sdk';
import { io } from 'socket.io-client';
import {
  Wifi,
  WifiOff,
  Radio,
  Tv,
  AlertTriangle,
  Zap,
  Loader2,
  Minimize2,
  ExternalLink,
} from 'lucide-react';
import WhiteboardCanvas from './WhiteboardCanvas';
import AudioStreamer from './AudioStreamer';
import { useLiveClass } from '../../context/LiveClassContext';
import styles from './LiveClassroomContainer.module.css';

import { getSocketUrl } from '../../config/constants';

/**
 * React ErrorBoundary wrapper to capture unexpected Jitsi SDK / iframe load errors
 * and fallback gracefully to Whiteboard & Audio mode without blank screening.
 */
class JitsiErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Jitsi SDK encountered an unhandled error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className={styles.errorFallbackContainer}>
          <AlertTriangle className={styles.errorIcon} />
          <h3>Video Session Encountered an Issue</h3>
          <p>
            {this.state.error?.message ||
              'Unable to load the online video room. Switch to local whiteboard mode below.'}
          </p>
          <button
            type="button"
            className={styles.retryButton}
            onClick={this.props.onFallbackTrigger}
          >
            Switch to Local Whiteboard & Audio Mode
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * LiveClassroomContainer
 * Master view wrapping network state detection, automatic switching between
 * Jitsi Meet online video conference and Local WebSocket Whiteboard + Audio fallback mode.
 */
export default function LiveClassroomContainer({
  classId = '66666666-6666-4666-8666-666666666666',
  className = 'Flutter & Mobile App Development',
  isTeacher = false,
  currentUser = { name: 'User', role: 'Student' },
  onClose,
  isDocked = false,
}) {
  const liveContext = useLiveClass();
  const contextSocket = liveContext?.liveSocket;

  // ---- Network & Mode States ----
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const [latencyMs, setLatencyMs] = useState(null);

  // 'AUTO' | 'JITSI' | 'FALLBACK'
  const [userModePreference, setUserModePreference] = useState('AUTO');
  const [activeMode, setActiveMode] = useState('JITSI'); // 'JITSI' | 'FALLBACK'
  const [jitsiError, setJitsiError] = useState(false);

  const socketRef = useRef(null);
  const pingIntervalRef = useRef(null);

  // ---- Environment Configs for Jitsi & 8x8 JaaS ----
  const appId = import.meta.env?.VITE_JITSI_APP_ID || '';
  const envDomain = import.meta.env?.VITE_JITSI_DOMAIN || '';

  const safeClassId = String(
    (typeof classId === 'object' && classId !== null ? classId.id || classId._id : classId) || 'general'
  );
  const formattedClassId = safeClassId.replace(/[^a-zA-Z0-9-]/g, '');

  const isJaas = Boolean(appId);
  const jitsiDomain = envDomain || (isJaas ? '8x8.vc' : 'meet.jit.si');
  const baseRoom = `TemarLije-Class-${formattedClassId || 'general'}`;
  const jitsiRoomName = isJaas ? `${appId}/${baseRoom}` : baseRoom;

  // ---- Socket Setup (Consume persistent socket from LiveClassContext if available) ----
  useEffect(() => {
    let socket = contextSocket;
    let createdLocalSocket = false;

    if (!socket) {
      const token = localStorage.getItem('temar_token');
      socket = io(getSocketUrl('/live-class'), {
        transports: ['websocket', 'polling'],
        auth: { token },
        query: { classId },
      });
      createdLocalSocket = true;
    }

    socketRef.current = socket;

    const handleConnect = () => {
      setSocketConnected(true);
      socket.emit('joinRoom', { classId });
    };

    const handleDisconnect = () => {
      setSocketConnected(false);
      setLatencyMs(null);
    };

    if (socket.connected) {
      setSocketConnected(true);
    }

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);

    // Measure latency ping every 5 seconds
    pingIntervalRef.current = setInterval(() => {
      if (socket && socket.connected) {
        const start = Date.now();
        socket.emit('ping', () => {
          setLatencyMs(Date.now() - start);
        });
      }
    }, 5000);

    return () => {
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      if (createdLocalSocket) {
        socket.disconnect();
      }
    };
  }, [classId, contextSocket]);

  // ---- Network Detection ----
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // ---- Mode Evaluation (Auto Switch when connectivity degrades or Jitsi errors) ----
  useEffect(() => {
    if (jitsiError) {
      setActiveMode('FALLBACK');
      return;
    }

    if (userModePreference === 'JITSI') {
      setActiveMode('JITSI');
    } else if (userModePreference === 'FALLBACK') {
      setActiveMode('FALLBACK');
    } else {
      // AUTO mode: If browser is offline or socket latency > 350ms, trigger Local Fallback Mode
      if (!isOnline || (latencyMs !== null && latencyMs > 350)) {
        setActiveMode('FALLBACK');
      } else {
        setActiveMode('JITSI');
      }
    }
  }, [isOnline, latencyMs, userModePreference, jitsiError]);

  return (
    <div className={styles.container}>
      {/* Master Top Bar / Status Dashboard */}
      <header className={styles.header}>
        <div className={styles.headerTitleGroup}>
          <div className={styles.liveIndicator}>
            <Radio className={`${styles.liveDot} animate-pulse`} />
            <span className={styles.liveLabel}>LIVE CLASSROOM</span>
          </div>
          <h1 className={styles.classTitle}>{className}</h1>
        </div>

        <div className={styles.headerControls}>
          {/* Network Health Badge */}
          <div className={styles.healthBadge}>
            {isOnline ? (
              <Wifi className={styles.wifiOnlineIcon} />
            ) : (
              <WifiOff className={styles.wifiOfflineIcon} />
            )}
            <span className={styles.healthText}>
              {isOnline ? 'Internet Connected' : 'Offline / Local Network'}
            </span>
            {latencyMs !== null && (
              <span
                className={`${styles.latencyText} ${
                  latencyMs > 350 ? styles.highLatency : styles.goodLatency
                }`}
              >
                {latencyMs}ms
              </span>
            )}
          </div>

          {/* Active Mode Pill Indicator */}
          <div
            className={`${styles.modeBadge} ${
              activeMode === 'JITSI' ? styles.jitsiMode : styles.fallbackMode
            }`}
          >
            {activeMode === 'JITSI' ? (
              <>
                <Tv className={styles.badgeIcon} />
                <span>Online Video (Jitsi)</span>
              </>
            ) : (
              <>
                <Zap className={styles.badgeIcon} />
                <span>Offline Whiteboard & Audio Fallback</span>
              </>
            )}
          </div>

          {/* Mode Switcher Selector */}
          <div className={styles.modeSelector}>
            <button
              type="button"
              className={`${styles.selectButton} ${
                userModePreference === 'AUTO' ? styles.selectedPref : ''
              }`}
              onClick={() => {
                setJitsiError(false);
                setUserModePreference('AUTO');
              }}
              title="Automatic network detection mode"
            >
              Auto
            </button>
            <button
              type="button"
              className={`${styles.selectButton} ${
                userModePreference === 'JITSI' ? styles.selectedPref : ''
              }`}
              onClick={() => {
                setJitsiError(false);
                setUserModePreference('JITSI');
              }}
              title="Force Jitsi video meeting"
            >
              Jitsi Video
            </button>
            <button
              type="button"
              className={`${styles.selectButton} ${
                userModePreference === 'FALLBACK' ? styles.selectedPref : ''
              }`}
              onClick={() => setUserModePreference('FALLBACK')}
              title="Force Local Whiteboard + Audio"
            >
              Local Fallback
            </button>
            <a
              href={`https://${jitsiDomain}/${jitsiRoomName}`}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.selectButton}
              title="Open video call in full HTTPS window"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', textDecoration: 'none', color: 'inherit' }}
            >
              <ExternalLink size={13} />
              <span>Open Tab</span>
            </a>
          </div>

          {!isDocked && liveContext?.setIsMinimized && (
            <button
              type="button"
              className={styles.dockHeaderBtn}
              onClick={() => liveContext.setIsMinimized(true)}
              title="Dock live stream & continue browsing"
            >
              <Minimize2 className={styles.badgeIcon} />
              <span>Dock & Continue Browsing</span>
            </button>
          )}

          {onClose && (
            <button
              type="button"
              className={styles.closeButton}
              onClick={onClose}
              title="Leave Room"
            >
              Leave Room
            </button>
          )}
        </div>
      </header>

      {/* Warning banner if operating in low bandwidth / local offline mode */}
      {activeMode === 'FALLBACK' && (
        <div className={styles.fallbackBanner}>
          <AlertTriangle className={styles.bannerIcon} />
          <span>
            {!isOnline
              ? 'Offline Mode Active: Streaming via local network WebSockets & Canvas.'
              : jitsiError
              ? 'Video stream unavailable: Switched to Local Whiteboard & Voice channel.'
              : 'Low bandwidth detected: Switched to ultra-fast local WebSockets Whiteboard + Voice stream fallback.'}
          </span>
        </div>
      )}

      {/* Main View Area */}
      <main className={styles.mainView}>
        {activeMode === 'JITSI' && isOnline ? (
          // ONLINE MODE: Jitsi Meeting Embed with Error Boundary & Spinner
          <JitsiErrorBoundary
            onFallbackTrigger={() => {
              setJitsiError(true);
              setActiveMode('FALLBACK');
            }}
          >
            <div className={styles.jitsiContainer}>
              <JitsiMeeting
                domain={jitsiDomain}
                roomName={jitsiRoomName}
                spinner={() => (
                  <div className={styles.jitsiLoadingSpinner}>
                    <Loader2 className={`${styles.spinnerIcon} animate-spin`} />
                    <span>Connecting to Live Video Room ({jitsiDomain})...</span>
                  </div>
                )}
                configOverwrite={{
                  startWithAudioMuted: !isTeacher,
                  disableThirdPartyRequests: true,
                  prejoinPageEnabled: false,
                  toolbarButtons: [
                    'microphone',
                    'camera',
                    'desktop',
                    'chat',
                    'raisehand',
                    'participants-pane',
                    'tileview',
                    'fullscreen',
                    'hangup',
                  ],
                }}
                interfaceConfigOverwrite={{
                  DISABLE_JOIN_LEAVE_NOTIFICATIONS: true,
                  SHOW_JITSI_WATERMARK: false,
                }}
                userInfo={{
                  displayName: currentUser?.name || 'User',
                }}
                onApiReady={(externalApi) => {
                  externalApi.executeCommand('subject', className);
                }}
                getIFrameRef={(iframeRef) => {
                  if (iframeRef) {
                    iframeRef.style.height = '100%';
                    iframeRef.style.minHeight = '100%';
                    iframeRef.style.width = '100%';
                    iframeRef.style.border = 'none';
                    iframeRef.style.borderRadius = '12px';
                    iframeRef.style.display = 'block';
                  }
                }}
              />
            </div>
          </JitsiErrorBoundary>
        ) : (
          // LOCAL / OFFLINE MODE: Interactive Whiteboard + Audio Streamer
          <div className={styles.fallbackContainer}>
            {/* Audio Stream Control Bar */}
            <div className={styles.audioSection}>
              <AudioStreamer
                socket={socketRef.current}
                classId={classId}
                isTeacher={isTeacher}
                currentUser={currentUser}
              />
            </div>

            {/* Interactive HTML5 Canvas Whiteboard */}
            <div className={styles.whiteboardSection}>
              <WhiteboardCanvas
                socket={socketRef.current}
                classId={classId}
                isTeacher={isTeacher}
                readOnly={!isTeacher}
              />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

