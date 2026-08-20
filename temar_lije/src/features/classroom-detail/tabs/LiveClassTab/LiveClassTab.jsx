import React, { useState, useCallback, useRef } from 'react';
import { Video, UserPlus, Sparkles, Loader2, CheckCircle2, Radio, Maximize2, PhoneOff } from 'lucide-react';
import { recordCheckIn } from '../../../../services/apiClient';
import { useLiveClass } from '../../../../context/LiveClassContext';
import styles from './LiveClassTab.module.css';

/**
 * LiveClassTab
 * Renders the "Live class" tab panel of a classroom: the meeting-room
 * entry card on the left, and the Attendance + Live quiz utilities on the right.
 * Interacts directly with LiveClassContext to start, dock, expand, and end sessions.
 */
export default function LiveClassTab({
  classId = '66666666-6666-4666-8666-666666666666',
  studentId = '33333333-3333-4333-8333-333333333333',
  isTeacher = false,
  currentUser = { name: 'User', role: 'Student' },
  onJoinLiveClass,
  onTakeAttendance,
  onCreateQuiz,
}) {
  const {
    isLiveActive,
    isMinimized,
    startSession,
    endSession,
    setIsMinimized,
    isConnecting,
    sessionError,
  } = useLiveClass();

  const [joinError, setJoinError] = useState('');

  // ---- Attendance ----
  const [checkIns, setCheckIns] = useState([
    { id: '1', name: 'Fiema Yaregal', time: '10:02 AM' },
    { id: '2', name: 'Hana Tesfaye', time: '10:05 AM' },
  ]);
  const [hasCheckedIn, setHasCheckedIn] = useState(false);
  const [isTakingAttendance, setIsTakingAttendance] = useState(false);
  const [attendanceError, setAttendanceError] = useState('');
  const [checkInName, setCheckInName] = useState('');
  const nameInputRef = useRef(null);

  // ---- Live quiz ----
  const [quizzes, setQuizzes] = useState([
    { id: 'q-1', title: 'Quick Poll: State vs Props Understanding' },
  ]);
  const [isCreatingQuiz, setIsCreatingQuiz] = useState(false);
  const [quizError, setQuizError] = useState('');

  const handleToggleLiveSession = useCallback(async () => {
    if (isConnecting) return;
    setJoinError('');
    try {
      if (onJoinLiveClass) {
        await onJoinLiveClass();
      }
      if (!isLiveActive) {
        await startSession({
          classId,
          className: 'Live Classroom',
          teacher: isTeacher,
          user: currentUser,
        });
      } else {
        await endSession();
      }
    } catch (err) {
      setJoinError(err.message || 'Could not connect to the live room. Try again.');
    }
  }, [isConnecting, isLiveActive, isTeacher, classId, currentUser, onJoinLiveClass, startSession, endSession]);

  const handleStudentCheckIn = useCallback(async () => {
    if (hasCheckedIn || isTakingAttendance) return;
    setIsTakingAttendance(true);
    setAttendanceError('');
    try {
      const activeUserId = currentUser?.id || studentId;
      if (onTakeAttendance) {
        await onTakeAttendance(currentUser?.name || 'Student');
      } else {
        await recordCheckIn(classId, activeUserId);
      }
      const myName = currentUser?.name || 'Student';
      setCheckIns((prev) => [
        {
          id: `${Date.now()}`,
          name: myName,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
        ...prev,
      ]);
      setHasCheckedIn(true);
    } catch (err) {
      setAttendanceError(err.message || 'Could not record your attendance. Try again.');
    } finally {
      setIsTakingAttendance(false);
    }
  }, [hasCheckedIn, isTakingAttendance, currentUser, classId, studentId, onTakeAttendance]);

  const handleTeacherTakeAttendance = useCallback(async () => {
    if (isTakingAttendance) return;
    setIsTakingAttendance(true);
    setAttendanceError('');
    const name = checkInName.trim();
    try {
      if (onTakeAttendance) {
        await onTakeAttendance(name);
      } else {
        await recordCheckIn(classId, studentId);
      }
      if (name) {
        setCheckIns((prev) => [
          {
            id: `${Date.now()}`,
            name,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
          ...prev,
        ]);
        setCheckInName('');
      } else {
        alert('Attendance session broadcasted to all online students!');
      }
    } catch (err) {
      setAttendanceError(err.message || 'Action failed. Please try again.');
    } finally {
      setIsTakingAttendance(false);
    }
  }, [checkInName, isTakingAttendance, onTakeAttendance, classId, studentId]);

  const handleCreateQuiz = useCallback(async () => {
    if (!isTeacher || isCreatingQuiz) return;
    setIsCreatingQuiz(true);
    setQuizError('');
    try {
      const quizTitle = prompt('Enter live quiz question/title:');
      if (quizTitle && quizTitle.trim()) {
        setQuizzes((prev) => [
          { id: `q-${Date.now()}`, title: quizTitle.trim() },
          ...prev,
        ]);
      }
    } catch (err) {
      setQuizError('Could not create the quiz. Try again.');
    } finally {
      setIsCreatingQuiz(false);
    }
  }, [isTeacher, isCreatingQuiz]);

  return (
    <div className={styles.container}>
      {/* Left: live meeting room card */}
      <section className={styles.mainCard} aria-label="Live class room">
        <div className={styles.mainCardInner}>
          <div className={styles.videoBadge}>
            {isLiveActive ? <Radio className={`${styles.videoBadgeIcon} animate-pulse`} /> : <Video className={styles.videoBadgeIcon} />}
          </div>
          <h2 className={styles.roomTitle}>
            {isLiveActive
              ? 'Live Classroom Session Active'
              : isTeacher
              ? 'Host Live Classroom'
              : 'Live Classroom'}
          </h2>
          <p className={styles.roomDescription}>
            {isLiveActive
              ? isMinimized
                ? 'Your live stream is currently active and docked in Picture-in-Picture mode. Click expand to return to full screen.'
                : 'Live video broadcasting & whiteboard active.'
              : isTeacher
              ? 'Start interactive live teaching with video, audio, whiteboard sharing, and automated attendance logging.'
              : 'Join your teacher’s live session to watch whiteboard presentations, participate in discussions, and ask questions.'}
          </p>

          {isLiveActive ? (
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '8px' }}>
              <button
                type="button"
                className={styles.joinButton}
                onClick={() => setIsMinimized(false)}
                style={{ backgroundColor: '#2563eb' }}
              >
                <Maximize2 className={styles.buttonIcon} style={{ width: '16px', height: '16px' }} />
                <span>Expand Full Screen</span>
              </button>
              <button
                type="button"
                className={styles.joinButton}
                onClick={endSession}
                style={{ backgroundColor: '#dc2626' }}
              >
                <PhoneOff className={styles.buttonIcon} style={{ width: '16px', height: '16px' }} />
                <span>End Live Session</span>
              </button>
            </div>
          ) : (
            <button
              type="button"
              className={styles.joinButton}
              onClick={handleToggleLiveSession}
              disabled={isConnecting}
              aria-busy={isConnecting}
            >
              {isConnecting ? (
                <>
                  <Loader2 className={`${styles.spinner} animate-spin`} />
                  Connecting&hellip;
                </>
              ) : isTeacher ? (
                'Start Live Class (Host)'
              ) : (
                'Join Live Class'
              )}
            </button>
          )}

          {(joinError || sessionError) && (
            <p className={styles.inlineError} role="alert">
              {joinError || sessionError}
            </p>
          )}
        </div>
      </section>

      {/* Right: attendance + live quiz */}
      <aside className={styles.sidebar}>
        <section className={styles.panel} aria-labelledby="attendance-heading">
          <h3 id="attendance-heading" className={styles.panelHeading}>
            {isTeacher ? 'Attendance Log (Teacher)' : 'My Attendance (Student)'}
          </h3>

          {isTeacher ? (
            <div className={styles.attendanceRow}>
              <input
                ref={nameInputRef}
                type="text"
                className={styles.textInput}
                placeholder="Student name (optional)"
                value={checkInName}
                onChange={(e) => setCheckInName(e.target.value)}
                disabled={isTakingAttendance}
              />
              <button
                type="button"
                className={styles.primaryButton}
                onClick={handleTeacherTakeAttendance}
                disabled={isTakingAttendance}
                aria-busy={isTakingAttendance}
              >
                {isTakingAttendance ? (
                  <Loader2 className={`${styles.spinner} animate-spin`} />
                ) : (
                  <UserPlus className={styles.buttonIcon} />
                )}
                <span>{checkInName ? 'Add' : 'Trigger Log'}</span>
              </button>
            </div>
          ) : (
            <div style={{ marginBottom: '14px' }}>
              <button
                type="button"
                className={styles.primaryButton}
                onClick={handleStudentCheckIn}
                disabled={hasCheckedIn || isTakingAttendance}
                style={hasCheckedIn ? { backgroundColor: '#059669', width: '100%' } : { width: '100%' }}
              >
                {isTakingAttendance ? (
                  <Loader2 className={`${styles.spinner} animate-spin`} />
                ) : hasCheckedIn ? (
                  <CheckCircle2 className={styles.buttonIcon} />
                ) : (
                  <UserPlus className={styles.buttonIcon} />
                )}
                <span>{hasCheckedIn ? 'Marked Present ✓' : 'Mark Attendance for Today'}</span>
              </button>
            </div>
          )}

          {attendanceError && (
            <p className={styles.inlineError} role="alert">
              {attendanceError}
            </p>
          )}

          <div className={styles.emptyOrList}>
            {checkIns.length === 0 ? (
              <p className={styles.emptyState}>No check-ins recorded yet.</p>
            ) : (
              <ul className={styles.checkInList}>
                {checkIns.map((c) => (
                  <li key={c.id} className={styles.checkInItem}>
                    <span className={styles.checkInName}>{c.name}</span>
                    <span className={styles.checkInTime}>{c.time}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section className={styles.panel} aria-labelledby="live-quiz-heading">
          <h3 id="live-quiz-heading" className={styles.panelHeading}>
            Live Quizzes & Polls
          </h3>

          {isTeacher && (
            <button
              type="button"
              className={styles.newQuizButton}
              onClick={handleCreateQuiz}
              disabled={isCreatingQuiz}
              aria-busy={isCreatingQuiz}
            >
              {isCreatingQuiz ? (
                <Loader2 className={`${styles.spinner} animate-spin`} />
              ) : (
                <Sparkles className={styles.buttonIcon} />
              )}
              <span>{isCreatingQuiz ? 'Creating…' : 'New Live Quiz'}</span>
            </button>
          )}

          {quizError && (
            <p className={styles.inlineError} role="alert">
              {quizError}
            </p>
          )}

          <div className={styles.emptyOrList}>
            {quizzes.length === 0 ? (
              <p className={styles.emptyState}>No live quizzes active right now.</p>
            ) : (
              <ul className={styles.quizList}>
                {quizzes.map((q) => (
                  <li key={q.id} className={styles.quizItem} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>{q.title}</span>
                    {!isTeacher && (
                      <button
                        type="button"
                        style={{
                          fontSize: '0.75rem',
                          padding: '4px 8px',
                          borderRadius: '6px',
                          background: '#14785c',
                          color: '#fff',
                          border: 'none',
                          cursor: 'pointer',
                        }}
                        onClick={() => alert(`Opening ${q.title}...`)}
                      >
                        Answer
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </aside>
    </div>
  );
}