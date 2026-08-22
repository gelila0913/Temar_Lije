import React, { useState, useEffect, useCallback } from 'react';
import { ClipboardCheck, Loader2, CheckCircle2, Clock, XCircle, AlertCircle, Calendar, Users, ShieldCheck } from 'lucide-react';
import { getAttendanceReport, recordCheckIn, createAttendanceSession } from '../../../../services/apiClient';
import './AttendanceTab.css';

export default function AttendanceTab({
  classId = '66666666-6666-4666-8666-666666666666',
  studentId = '33333333-3333-4333-8333-333333333333',
  isTeacher = false,
  currentUser = { name: 'User', role: 'Student' },
}) {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [checkInMessage, setCheckInMessage] = useState('');
  const [checkInError, setCheckInError] = useState('');
  const [sessionTopic, setSessionTopic] = useState('');

  const loadAttendance = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getAttendanceReport(classId);
      setReport(data);
    } catch (err) {
      console.error('Failed to load attendance:', err);
    } finally {
      setLoading(false);
    }
  }, [classId]);

  useEffect(() => {
    loadAttendance();
  }, [loadAttendance]);

  // Teacher action: Start / Log a new attendance session for this class
  const handleCreateSession = async (e) => {
    e?.preventDefault();
    if (isSubmitting) return;

    setIsSubmitting(true);
    setCheckInMessage('');
    setCheckInError('');

    try {
      const topicToUse = sessionTopic.trim() || `Session - ${new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`;
      await createAttendanceSession(classId, topicToUse);
      setCheckInMessage(`Attendance session "${topicToUse}" opened! Students can now check in.`);
      setSessionTopic('');
      await loadAttendance();
    } catch (err) {
      setCheckInError(err.message || 'Failed to start attendance session.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Student action: Record single attendance check-in
  const handleStudentCheckIn = async (e) => {
    e?.preventDefault();
    if (isSubmitting) return;

    if (report?.hasCheckedIn) {
      setCheckInError('Attendance already recorded for this session.');
      return;
    }

    setIsSubmitting(true);
    setCheckInMessage('');
    setCheckInError('');

    try {
      const targetUserId = currentUser?.id || studentId;
      const res = await recordCheckIn(classId, targetUserId);
      setCheckInMessage(`Attendance recorded successfully! Status: ${res.status || 'PRESENT'}`);
      await loadAttendance();
    } catch (err) {
      setCheckInError(err.message || 'Check-in failed. Please ensure you are connected to the classroom Wi-Fi.');
      await loadAttendance();
    } finally {
      setIsSubmitting(false);
    }
  };

  const summary = report?.summary || { PRESENT: 0, LATE: 0, ABSENT: 0, totalEnrolled: 0 };
  const session = report?.session || null;
  const studentsList = report?.students || [];
  const hasAlreadyCheckedIn = Boolean(report?.hasCheckedIn);
  const myRecord = report?.myRecord;

  const sessionDateFormatted = session?.startedAt
    ? new Date(session.startedAt).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
    : new Date().toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });

  const sessionTimeFormatted = session?.startedAt
    ? new Date(session.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : 'Active';

  return (
    <div className="classroom-detail-container">
      {/* Active Session Info Bar */}
      <div
        style={{
          backgroundColor: '#fff',
          border: '1px solid #e3e9e6',
          borderRadius: '12px',
          padding: '16px 20px',
          marginBottom: '18px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '10px',
              backgroundColor: '#ecfdf5',
              color: '#047857',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Calendar size={22} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#16181b', fontWeight: 700 }}>
                {session?.topic || 'Current Attendance Session'}
              </h3>
              <span
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  padding: '2px 8px',
                  borderRadius: '12px',
                  backgroundColor: '#dcfce7',
                  color: '#15803d',
                }}
              >
                Live Session
              </span>
            </div>
            <p style={{ margin: '3px 0 0', fontSize: '0.825rem', color: '#6b7280' }}>
              Date: {sessionDateFormatted} · Started at: {sessionTimeFormatted}
            </p>
          </div>
        </div>

        {isTeacher && (
          <div style={{ fontSize: '0.825rem', color: '#4b5563', fontWeight: 500 }}>
            Teacher View: Live student attendance monitor
          </div>
        )}
      </div>

      {/* Attendance Control Card */}
      <div className="attendance-control-card">
        {isTeacher ? (
          <form onSubmit={handleCreateSession} className="attendance-action-row">
            <input
              type="text"
              className="attendance-input"
              placeholder="Session topic or check-in title (e.g. Session 5 - Live Coding)"
              value={sessionTopic}
              onChange={(e) => setSessionTopic(e.target.value)}
            />
            <button type="submit" className="attendance-btn" disabled={isSubmitting}>
              {isSubmitting ? (
                <Loader2 className="attendance-btn-icon animate-spin" />
              ) : (
                <ClipboardCheck className="attendance-btn-icon" />
              )}
              <span>{isSubmitting ? 'Opening Session...' : 'Log Session Attendance'}</span>
            </button>
          </form>
        ) : hasAlreadyCheckedIn ? (
          /* Student View: Already Checked In State */
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              width: '100%',
              flexWrap: 'wrap',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '50%',
                  backgroundColor: '#dcfce7',
                  color: '#15803d',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <ShieldCheck size={22} />
              </div>
              <div>
                <span style={{ fontSize: '15px', fontWeight: 700, color: '#15803d', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <CheckCircle2 size={16} /> Attendance Recorded
                </span>
                <p style={{ margin: '3px 0 0', fontSize: '13px', color: '#4b5563' }}>
                  Attendance already recorded for this session ({myRecord?.status || 'PRESENT'} · {myRecord?.checkedInAt ? new Date(myRecord.checkedInAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Verified'}).
                </p>
              </div>
            </div>

            <button
              type="button"
              className="attendance-btn"
              disabled={true}
              style={{
                backgroundColor: '#e2e8f0',
                color: '#64748b',
                cursor: 'not-allowed',
                boxShadow: 'none',
              }}
            >
              <CheckCircle2 className="attendance-btn-icon" size={16} />
              <span>Attendance Recorded</span>
            </button>
          </div>
        ) : (
          /* Student View: Ready to Check In */
          <form onSubmit={handleStudentCheckIn} className="attendance-action-row">
            <div style={{ flex: 1 }}>
              <span style={{ fontSize: '14px', fontWeight: 600, color: '#16181b' }}>
                Classroom Wi-Fi Hotspot Attendance Check-In
              </span>
              <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#8b9491' }}>
                Connect to your classroom Wi-Fi network and click below to record your one-time attendance for this session.
              </p>
            </div>
            <button type="submit" className="attendance-btn" disabled={isSubmitting}>
              {isSubmitting ? (
                <Loader2 className="attendance-btn-icon animate-spin" />
              ) : (
                <ClipboardCheck className="attendance-btn-icon" />
              )}
              <span>{isSubmitting ? 'Checking in...' : 'Check-In Now'}</span>
            </button>
          </form>
        )}

        {checkInMessage && (
          <div
            style={{
              marginTop: '14px',
              padding: '10px 14px',
              backgroundColor: '#ecfdf5',
              color: '#047857',
              borderRadius: '8px',
              fontSize: '14px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <CheckCircle2 size={16} /> {checkInMessage}
          </div>
        )}

        {checkInError && (
          <div
            style={{
              marginTop: '14px',
              padding: '10px 14px',
              backgroundColor: '#fef2f2',
              color: '#b91c1c',
              borderRadius: '8px',
              fontSize: '14px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <AlertCircle size={16} /> {checkInError}
          </div>
        )}
      </div>

      {/* Summary Counters */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '16px',
          margin: '24px 0',
        }}
      >
        <div style={{ background: '#fff', border: '1px solid #e3e9e6', borderRadius: '10px', padding: '16px' }}>
          <span style={{ fontSize: '13px', color: '#8b9491', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Users size={14} /> Total Enrolled
          </span>
          <h3 style={{ margin: '4px 0 0', fontSize: '24px', color: '#16181b' }}>{summary.totalEnrolled}</h3>
        </div>
        <div style={{ background: '#fff', border: '1px solid #e3e9e6', borderRadius: '10px', padding: '16px' }}>
          <span style={{ fontSize: '13px', color: '#047857', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <CheckCircle2 size={14} /> Present
          </span>
          <h3 style={{ margin: '4px 0 0', fontSize: '24px', color: '#047857' }}>{summary.PRESENT}</h3>
        </div>
        <div style={{ background: '#fff', border: '1px solid #e3e9e6', borderRadius: '10px', padding: '16px' }}>
          <span style={{ fontSize: '13px', color: '#d97706', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Clock size={14} /> Late
          </span>
          <h3 style={{ margin: '4px 0 0', fontSize: '24px', color: '#d97706' }}>{summary.LATE}</h3>
        </div>
        <div style={{ background: '#fff', border: '1px solid #e3e9e6', borderRadius: '10px', padding: '16px' }}>
          <span style={{ fontSize: '13px', color: '#dc2626', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <XCircle size={14} /> Not Submitted / Absent
          </span>
          <h3 style={{ margin: '4px 0 0', fontSize: '24px', color: '#dc2626' }}>{summary.ABSENT}</h3>
        </div>
      </div>

      {/* Real Enrolled Student Attendance Roster */}
      {loading ? (
        <div className="attendance-empty-state-card">
          <Loader2 className="attendance-btn-icon animate-spin" style={{ margin: '0 auto 1rem' }} />
          <p className="attendance-empty-state-text">Loading attendance roster...</p>
        </div>
      ) : studentsList.length === 0 ? (
        <div className="attendance-empty-state-card">
          <p className="attendance-empty-state-text">
            No students enrolled in this classroom yet.
          </p>
        </div>
      ) : (
        <div style={{ background: '#fff', border: '1px solid #e3e9e6', borderRadius: '12px', padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h4 style={{ margin: 0, color: '#16181b', fontSize: '1.05rem', fontWeight: 700 }}>
              Session Attendance Roster
            </h4>
            <span style={{ fontSize: '0.8rem', color: '#6b7280' }}>
              {summary.PRESENT + summary.LATE} of {summary.totalEnrolled} checked in
            </span>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #e5e7eb', color: '#6b7280', fontSize: '0.8rem', textTransform: 'uppercase' }}>
                  <th style={{ padding: '10px 12px' }}>Student</th>
                  <th style={{ padding: '10px 12px' }}>Email</th>
                  <th style={{ padding: '10px 12px' }}>Status</th>
                  <th style={{ padding: '10px 12px' }}>Check-In Time</th>
                </tr>
              </thead>
              <tbody>
                {studentsList.map((item, idx) => {
                  const studentName = item.student?.fullName || item.student?.name || `Student ${idx + 1}`;
                  const email = item.student?.email || '—';
                  const isPresent = item.status === 'PRESENT';
                  const isLate = item.status === 'LATE';
                  const isNotSubmitted = item.status === 'NOT_SUBMITTED' || item.status === 'ABSENT';

                  const timeStr = item.checkedInAt
                    ? new Date(item.checkedInAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    : '—';

                  return (
                    <tr
                      key={item.id || item.studentId || idx}
                      style={{
                        borderBottom: '1px solid #f3f4f6',
                        backgroundColor: idx % 2 === 0 ? '#fff' : '#fafbfc',
                      }}
                    >
                      <td style={{ padding: '12px', fontWeight: 600, color: '#16181b', fontSize: '14px' }}>
                        {studentName}
                      </td>
                      <td style={{ padding: '12px', color: '#6b7280', fontSize: '13px' }}>
                        {email}
                      </td>
                      <td style={{ padding: '12px' }}>
                        <span
                          style={{
                            padding: '4px 10px',
                            borderRadius: '12px',
                            fontSize: '12px',
                            fontWeight: 600,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            backgroundColor: isPresent ? '#ecfdf5' : isLate ? '#fffbeb' : '#fef2f2',
                            color: isPresent ? '#047857' : isLate ? '#b45309' : '#b91c1c',
                          }}
                        >
                          {isPresent && <CheckCircle2 size={12} />}
                          {isLate && <Clock size={12} />}
                          {isNotSubmitted && <XCircle size={12} />}
                          {isPresent ? 'PRESENT' : isLate ? 'LATE' : 'NOT SUBMITTED'}
                        </span>
                      </td>
                      <td style={{ padding: '12px', color: '#4b5563', fontSize: '13px', fontWeight: 500 }}>
                        {timeStr}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}