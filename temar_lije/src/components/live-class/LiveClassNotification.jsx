import React from 'react';
import { Video, X, ArrowRight } from 'lucide-react';
import { useLiveClass } from '../../context/LiveClassContext';
import styles from './LiveClassNotification.module.css';

export default function LiveClassNotification() {
  const {
    liveClassNotification,
    dismissLiveNotification,
    joinLiveNotification,
  } = useLiveClass();

  if (!liveClassNotification) return null;

  return (
    <div className={styles.notificationContainer} role="alert" aria-live="assertive">
      <div className={styles.topRow}>
        <div className={styles.badge}>
          <span className={styles.pulseDot} />
          LIVE NOW
        </div>
        <button
          type="button"
          className={styles.closeBtn}
          onClick={dismissLiveNotification}
          aria-label="Dismiss notification"
        >
          <X size={16} />
        </button>
      </div>

      <div className={styles.bodyRow}>
        <div className={styles.iconCircle}>
          <Video size={22} />
        </div>
        <div className={styles.textContent}>
          <h4 className={styles.title}>Live Class Started!</h4>
          <p className={styles.desc}>
            <span className={styles.teacherHighlight}>{liveClassNotification.teacherName}</span> is now streaming in{' '}
            <strong>{liveClassNotification.className}</strong>.
          </p>
        </div>
      </div>

      <div className={styles.actionButtons}>
        <button
          type="button"
          className={styles.dismissBtn}
          onClick={dismissLiveNotification}
        >
          Later
        </button>
        <button
          type="button"
          className={styles.joinBtn}
          onClick={joinLiveNotification}
        >
          Join Class Now <ArrowRight size={15} />
        </button>
      </div>
    </div>
  );
}
