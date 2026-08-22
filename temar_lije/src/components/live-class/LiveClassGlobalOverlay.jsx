import React from 'react';
import { useLiveClass } from '../../context/LiveClassContext';
import LiveClassroomContainer from './LiveClassroomContainer';
import {
  Maximize2,
  PhoneOff,
  Radio,
  HelpCircle,
  FileText,
  Users,
} from 'lucide-react';
import styles from './LiveClassGlobalOverlay.module.css';

export default function LiveClassGlobalOverlay() {
  const {
    isLiveActive,
    activeClassId,
    activeClassName,
    isTeacher,
    currentUser,
    isMinimized,
    endSession,
    toggleMinimize,
    setIsMinimized,
  } = useLiveClass();

  if (!isLiveActive || !activeClassId) return null;

  const navigateToTab = (tabName) => {
    setIsMinimized(true);
    const targetPath = `/classrooms/${activeClassId}/${tabName}`;
    window.history.pushState({}, '', targetPath);
    window.dispatchEvent(
      new CustomEvent('navigate-tab', {
        detail: { tab: tabName, classId: activeClassId },
      })
    );
  };

  return (
    <div className={isMinimized ? styles.minimizedDock : styles.fullScreenOverlay}>
      <div className={isMinimized ? styles.dockInner : styles.fullScreenWrapper}>
        {/* DOCKED PIP HEADER */}
        {isMinimized && (
          <div className={styles.dockHeader}>
            <div className={styles.dockTitleGroup}>
              <Radio className={`${styles.liveRadioIcon} animate-pulse`} />
              <span className={styles.dockLiveText}>LIVE SESSION</span>
              <span className={styles.dockClassTitleInline}>- {activeClassName}</span>
            </div>

            <div className={styles.dockHeaderControls}>
              <button
                type="button"
                className={styles.dockIconBtn}
                onClick={toggleMinimize}
                title="Expand to full screen"
              >
                <Maximize2 className={styles.btnIconSmall} />
              </button>
              <button
                type="button"
                className={styles.dockEndBtn}
                onClick={endSession}
                title="End session"
              >
                <PhoneOff className={styles.btnIconSmall} />
              </button>
            </div>
          </div>
        )}

        {/* LIVE STREAMING CONTAINER (PRESERVED IN DOM FOR CONTINUOUS WEBRTC / SOCKET CONNECTION) */}
        <div className={isMinimized ? styles.dockedStreamViewport : styles.fullStreamViewport}>
          <LiveClassroomContainer
            classId={activeClassId}
            className={activeClassName}
            isTeacher={isTeacher}
            currentUser={currentUser}
            onClose={endSession}
            isDocked={isMinimized}
          />
        </div>

        {/* TEACHER IN-CLASS ACTION BAR (VISIBLE IN DOCKED MODE WITH DIRECT ROUTE NAVIGATION) */}
        {isMinimized && isTeacher && (
          <div className={styles.teacherActionBar}>
            <button
              type="button"
              className={styles.actionBtn}
              onClick={() => navigateToTab('quizzes')}
              title="Navigate directly to Quizzes"
            >
              <HelpCircle className={styles.actionIcon} />
              <span>Quizzes</span>
            </button>

            <button
              type="button"
              className={styles.actionBtn}
              onClick={() => navigateToTab('materials')}
              title="Navigate directly to Materials"
            >
              <FileText className={styles.actionIcon} />
              <span>Materials</span>
            </button>

            <button
              type="button"
              className={styles.actionBtn}
              onClick={() => navigateToTab('attendance')}
              title="Navigate directly to Attendance"
            >
              <Users className={styles.actionIcon} />
              <span>Attendance</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}


