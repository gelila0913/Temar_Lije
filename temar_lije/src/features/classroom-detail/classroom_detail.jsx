import React, { useState } from 'react';
import Header from '../../components/common/Header/header.jsx';
import ClassroomHeader from '../../components/common/tittle/Tittle.jsx';
import MaterialsTab from './tabs/Material/MaterialsTab.jsx';
import LiveClassTab from './tabs/LiveClassTab/LiveClassTab.jsx';
import AssignmentsTab from './tabs/AssignmentsTab/AssignmentsTab.jsx';
import AttendanceTab from './tabs/Attendance/AttendanceTab.jsx';
import QuizzesTab from './tabs/Quize/QuizzesTab.jsx';
import MembersTab from './tabs/MemberTab/MembersTab.jsx';
import StudyBuddy from '../study-buddy/study-buddy.jsx';

export default function ClassroomDetail({
  classroom = { title: "Flutter", subject: "Widget · widget structure" },
  currentUser = { name: "Gelila Sintayehu", role: "Student" },
  onBackToClassrooms,
  onLogout,
  darkMode,
  setDarkMode
}) {
  const [currentNavTab, setCurrentNavTab] = useState('classrooms');
  const [activeDetailTab, setActiveDetailTab] = useState('materials');

  const avatarInitial = currentUser?.name ? currentUser.name.charAt(0).toUpperCase() : 'GS';

  const handleHeaderTabChange = (tab) => {
    if (tab === 'classrooms' && currentNavTab === 'classrooms') {
      onBackToClassrooms?.();
    } else {
      setCurrentNavTab(tab);
    }
  };

  return (
    <div 
      className="classroom-detail-page" 
      style={{ 
        minHeight: '100vh', 
        backgroundColor: darkMode ? '#121824' : '#f9fafb',
        color: darkMode ? '#f8fafc' : '#111827'
      }}
    >
      {/* Top Header */}
      <Header
        userName={currentUser.name}
        role={currentUser.role}
        userInitials={avatarInitial}
        currentTab={currentNavTab}
        onTabChange={handleHeaderTabChange}
        onLogout={onLogout}
        darkMode={darkMode}
        setDarkMode={setDarkMode}
      />

      {currentNavTab === 'study-buddy' ? (
        <main className="classroom-detail-content" style={{ maxWidth: '1280px', margin: '0 auto', padding: '1.5rem 2rem' }}>
          <StudyBuddy />
        </main>
      ) : (
        <>
          {/* Classroom Title & Navigation Tabs Header */}
          <ClassroomHeader
            title={classroom.title}
            subject={classroom.subject}
            activeTab={activeDetailTab}
            onTabChange={setActiveDetailTab}
            onBack={onBackToClassrooms}
          />

          {/* Detail Tab Contents */}
          <main className="classroom-detail-content" style={{ maxWidth: '1280px', margin: '0 auto', padding: '1.5rem 2rem' }}>
            {activeDetailTab === 'materials' && <MaterialsTab />}
            {activeDetailTab === 'live-class' && <LiveClassTab />}
            {activeDetailTab === 'assignments' && <AssignmentsTab />}
            {activeDetailTab === 'attendance' && <AttendanceTab />}
            {activeDetailTab === 'quizzes' && <QuizzesTab />}
            {activeDetailTab === 'members' && <MembersTab darkMode={darkMode} setDarkMode={setDarkMode} />}
          </main>
        </>
      )}
    </div>
  );
}
