import React, { useCallback, useState, useEffect } from 'react';
import { User, Loader2 } from 'lucide-react';
import styles from './TeacherMemberTab.module.css';
import { getClassroomMembers, removeClassroomMember } from '../../../../services/apiClient';
import { usePresence } from '../../../../hooks/usePresence';

function formatJoined(dateString) {
  if (!dateString) return 'Joined recently';
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return 'Joined recently';
  return `Joined ${date.toLocaleDateString(undefined, {
    month: 'numeric',
    day: 'numeric',
    year: 'numeric',
  })}`;
}

/**
 * TeacherMemberTab
 * Renders the real student roster list of a classroom for the teacher from the PostgreSQL database.
 */
export default function TeacherMemberTab({ classroom, currentUser }) {
  const classId = classroom?.id || '66666666-6666-4666-8666-666666666666';
  const { isUserOnline } = usePresence(null, currentUser?.id, currentUser?.email);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [removingId, setRemovingId] = useState(null);
  const [removeError, setRemoveError] = useState('');

  const loadMembers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getClassroomMembers(classId);
      const studentOnly = (Array.isArray(data) ? data : []).filter(
        (m) => (m.role || '').toUpperCase() !== 'TEACHER'
      );
      setMembers(studentOnly);
    } catch (err) {
      console.warn('Failed to load members:', err);
      setMembers([]);
    } finally {
      setLoading(false);
    }
  }, [classId]);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  const handleRemove = useCallback(
    async (member) => {
      const studentId = member.id;
      const studentName = member.name || member.email || 'this student';
      const confirmed = window.confirm(
        `⚠️ Remove Student & Revoke Account?\n\nAre you sure you want to remove "${studentName}" from this classroom?\n\nOnce removed, their student account and classroom enrollment will be completely revoked, and they will need to register as a new student.`
      );
      if (!confirmed) return;

      if (removingId) return;
      setRemovingId(studentId);
      setRemoveError('');
      try {
        await removeClassroomMember(classId, studentId);
        setMembers((prev) => prev.filter((m) => m.id !== studentId));
        alert(`Student "${studentName}" has been removed and their student account was revoked.`);
      } catch (err) {
        setRemoveError('Could not remove this member. Try again.');
      } finally {
        setRemovingId(null);
      }
    },
    [removingId, classId]
  );

  return (
    <div className={styles.container}>
      {removeError && (
        <p className={styles.inlineError} role="alert">
          {removeError}
        </p>
      )}

      {loading ? (
        <div className={styles.emptyCard} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px' }}>
          <Loader2 className="animate-spin" size={24} style={{ color: '#14785c' }} />
          <span style={{ marginLeft: '10px', color: '#6b7280' }}>Loading classroom members...</span>
        </div>
      ) : members.length === 0 ? (
        <div className={styles.emptyCard}>
          <p className={styles.emptyState}>No students enrolled yet. Share your classroom code to invite students.</p>
        </div>
      ) : (
        <ul className={styles.memberList}>
          {members.map((member) => {
            const isRemoving = removingId === member.id;
            const online = isUserOnline(member.id, member.email);
            return (
              <li key={member.id} className={styles.memberRow}>
                <div className={styles.memberInfo}>
                  <span className={styles.avatar}>
                    <User className={styles.avatarIcon} />
                  </span>
                  <div className={styles.memberText}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className={styles.memberName}>{member.name || member.email}</span>
                      <span style={{
                        fontSize: '11px',
                        padding: '2px 7px',
                        borderRadius: '10px',
                        fontWeight: 600,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        backgroundColor: online ? '#dcfce7' : '#f1f5f9',
                        color: online ? '#15803d' : '#64748b'
                      }}>
                        <span style={{
                          width: '6px',
                          height: '6px',
                          borderRadius: '50%',
                          backgroundColor: online ? '#22c55e' : '#94a3b8'
                        }} />
                        {online ? 'online' : 'offline'}
                      </span>
                    </div>
                    <span className={styles.memberJoined}>{formatJoined(member.joinedAt)}</span>
                  </div>
                </div>

                <button
                  type="button"
                  className={styles.removeButton}
                  onClick={() => handleRemove(member)}
                  disabled={removingId !== null}
                  aria-busy={isRemoving}
                  aria-label={`Remove ${member.name || 'member'}`}
                >
                  {isRemoving ? (
                    <>
                      <Loader2 className={`${styles.spinner} animate-spin`} />
                      <span>Removing…</span>
                    </>
                  ) : (
                    <span>Remove</span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}