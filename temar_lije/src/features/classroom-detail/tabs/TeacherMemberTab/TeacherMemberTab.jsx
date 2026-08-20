import React, { useCallback, useState } from 'react';
import { User, Loader2 } from 'lucide-react';
import styles from './TeacherMemberTab.module.css';

const DEFAULT_MEMBERS = [
  { id: 'seed-fiema', name: 'Fiema Yaregal', joinedAt: '2026-08-06' },
  { id: 'seed-fani', name: 'Fani', joinedAt: '2026-08-06' },
  { id: 'seed-hana', name: 'Hana Tesfaye', joinedAt: '2026-08-07' },
];

function formatJoined(dateString) {
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
 * Renders the "Members" tab panel of a classroom for the teacher:
 * a roster list with each student's name, join date, and a Remove
 * action. Fully self-contained state — wire onRemoveMember to a real
 * API call when integrating.
 */
export default function TeacherMemberTab({ initialMembers = DEFAULT_MEMBERS, onRemoveMember }) {
  const [members, setMembers] = useState(initialMembers);
  const [removingId, setRemovingId] = useState(null);
  const [removeError, setRemoveError] = useState('');

  const handleRemoveMember = useCallback(
    async (id) => {
      if (removingId) return;
      setRemovingId(id);
      setRemoveError('');
      try {
        if (onRemoveMember) {
          await onRemoveMember(id);
        } else {
          await new Promise((resolve) => setTimeout(resolve, 700));
        }
        setMembers((prev) => prev.filter((m) => m.id !== id));
      } catch (err) {
        setRemoveError('Could not remove this member. Try again.');
      } finally {
        setRemovingId(null);
      }
    },
    [removingId, onRemoveMember]
  );

  return (
    <div className={styles.container}>
      {removeError && (
        <p className={styles.inlineError} role="alert">
          {removeError}
        </p>
      )}

      {members.length === 0 ? (
        <div className={styles.emptyCard}>
          <p className={styles.emptyState}>No members yet. Share the invitation code to invite students.</p>
        </div>
      ) : (
        <ul className={styles.memberList}>
          {members.map((member) => {
            const isRemoving = removingId === member.id;
            return (
              <li key={member.id} className={styles.memberRow}>
                <div className={styles.memberInfo}>
                  <span className={styles.avatar}>
                    <User className={styles.avatarIcon} />
                  </span>
                  <div className={styles.memberText}>
                    <span className={styles.memberName}>{member.name}</span>
                    <span className={styles.memberJoined}>{formatJoined(member.joinedAt)}</span>
                  </div>
                </div>

                <button
                  type="button"
                  className={styles.removeButton}
                  onClick={() => handleRemoveMember(member.id)}
                  disabled={removingId !== null}
                  aria-busy={isRemoving}
                  aria-label={`Remove ${member.name}`}
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