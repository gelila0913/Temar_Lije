import React, { useState } from 'react';
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
}) => {
  const [currentTab, setCurrentTab] = useState(activeTab);

  const handleTabClick = (tabId) => {
    setCurrentTab(tabId);
    if (onTabChange) onTabChange(tabId);
  };

  return (
    <div className={styles.headerContainer}>
      {/* Back button */}
      <button className={styles.backButton} onClick={onBack}>
        <span className={styles.backIcon}>←</span> Classrooms
      </button>

      {/* Classroom Title and Subtitle */}
      <h1 className={styles.title}>{title}</h1>
      <p className={styles.subtitle}>{subject}</p>

      {/* Navigation Tabs Pill Container */}
      <div className={styles.tabsContainer}>
        {TABS.map((tab) => (
          <button
            key={tab.id}
            className={`${styles.tabButton} ${
              currentTab === tab.id ? styles.activeTab : ''
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