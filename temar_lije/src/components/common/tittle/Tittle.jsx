import React from 'react';
import { ArrowLeft, Trash2 } from 'lucide-react';
import styles from './Tittle.module.css';

const TABS = [
  { id: 'materials', label: 'Materials' },
  { id: 'live-class', label: 'Live class' },
  { id: 'assignments', label: 'Assignments' },
  { id: 'attendance', label: 'Attendance' },
  { id: 'quizzes', label: 'Quizzes' },
  { id: 'members', label: 'Members' },
];

export const ClassroomHeader = ({
  title = "Flutter",
  subject = "Widget · widget structure",
  activeTab = "materials",
  onTabChange,
  onBack,
  isTeacher,
  onDelete,
}) => {
  const handleTabClick = (tabId) => {
    if (onTabChange) onTabChange(tabId);
  };

  return (
    <div className={styles.headerContainer}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', marginBottom: '4px' }}>
        {/* Back button */}
        <button className={styles.backButton} onClick={onBack}>
          <ArrowLeft size={16} className={styles.backIcon} /> Classrooms
        </button>

        {isTeacher && onDelete && (
          <button
            type="button"
            onClick={onDelete}
            title="Delete this classroom"
            style={{
              backgroundColor: '#fee2e2',
              color: '#dc2626',
              border: '1px solid #fca5a5',
              borderRadius: '8px',
              padding: '6px 14px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.15s ease'
            }}
          >
            <Trash2 size={14} />
            <span>Delete Classroom</span>
          </button>
        )}
      </div>

      {/* Classroom Title and Subtitle */}
      <h1 className={styles.title}>{title}</h1>
      <p className={styles.subtitle}>{subject}</p>

      {/* Navigation Tabs Pill Container */}
      <div className={styles.tabsContainer}>
        {TABS.map((tab) => (
          <button
            key={tab.id}
            className={`${styles.tabButton} ${
              activeTab === tab.id ? styles.activeTab : ''
            }`}
            onClick={() => handleTabClick(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  );
};

export default ClassroomHeader;