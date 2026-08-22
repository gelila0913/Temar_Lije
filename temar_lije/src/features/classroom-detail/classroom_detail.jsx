import React, { useState, useEffect } from 'react';
import Header from '../../components/common/Header/header.jsx';
import ClassroomHeader from '../../components/common/tittle/Tittle.jsx';
import MaterialsTab from './tabs/Material/MaterialsTab.jsx';
import LiveClassTab from './tabs/LiveClassTab/LiveClassTab.jsx';
import AssignmentsTab from './tabs/AssignmentsTab/AssignmentsTab.jsx';
import AttendanceTab from './tabs/Attendance/AttendanceTab.jsx';
import QuizzesTab from './tabs/Quize/QuizzesTab.jsx';
import MembersTab from './tabs/MemberTab/MembersTab.jsx';
import TeacherMemberTab from './tabs/TeacherMemberTab/TeacherMemberTab.jsx';
import StudyBuddy from '../study-buddy/study-buddy.jsx';
import AssignmentSubmissionsPage from '../../pages/AssignmentSubmissionsPage.jsx';
import { useLiveClass } from '../../context/LiveClassContext.jsx';
import { deleteClassroom } from '../../services/apiClient';

export default function ClassroomDetail({
  classroom = { title: "Flutter", subject: "Widget · widget structure" },
  currentUser = { name: "User", role: "Student" },
  onBackToClassrooms,
  onLogout,
  darkMode,
  setDarkMode
}) {
  const isTeacher = (currentUser?.role || '').toLowerCase() === 'teacher';
  const [currentNavTab, setCurrentNavTab] = useState('classrooms');
  const [activeDetailTab, setActiveDetailTab] = useState('materials');
  const [viewingSubmissionsAssignmentId, setViewingSubmissionsAssignmentId] = useState(null);

  const { isLiveActive, setIsMinimized } = useLiveClass();

  const handleDeleteClassroom = async () => {
    const classTitle = classroom.title || 'this classroom';
    const confirmed = window.confirm(
      `⚠️ Delete Classroom?\n\nAre you sure you want to permanently delete "${classTitle}"?\n\nAll materials, assignments, student records, and chat channels will be deleted. This action cannot be undone.`
    );
    if (!confirmed) return;

    try {
      await deleteClassroom(classroom.id);
      alert(`Classroom "${classTitle}" has been deleted.`);
      onBackToClassrooms?.();
    } catch (err) {
      alert(`Failed to delete classroom: ${err.message || 'Error occurred'}`);
    }
  };

  useEffect(() => {
    const handleNavigateTab = (e) => {
      if (e.detail?.tab) {
        setViewingSubmissionsAssignmentId(null);
        setCurrentNavTab('classrooms');
        setActiveDetailTab(e.detail.tab);
      }
    };
    const handleViewSubmissions = (e) => {
      if (e.detail?.assignmentId) {
        setViewingSubmissionsAssignmentId(e.detail.assignmentId);
      }
    };

    window.addEventListener('navigate-tab', handleNavigateTab);
    window.addEventListener('view-assignment-submissions', handleViewSubmissions);
    return () => {
      window.removeEventListener('navigate-tab', handleNavigateTab);
      window.removeEventListener('view-assignment-submissions', handleViewSubmissions);
    };
  }, []);

  const avatarInitial = currentUser?.name ? currentUser.name.charAt(0).toUpperCase() : 'U';

  const handleHeaderTabChange = (tab) => {
    if (isLiveActive) {
      setIsMinimized(true);
    }
    if (tab === 'classrooms' && currentNavTab === 'classrooms') {
      onBackToClassrooms?.();
    } else {
      setCurrentNavTab(tab);
    }
  };

  const handleDetailTabChange = (tab) => {
    setActiveDetailTab(tab);
    if (isLiveActive && tab !== 'live-class') {
      setIsMinimized(true);
    }
  };

  const defaultClassId = classroom.id || '66666666-6666-4666-8666-666666666666';
  const defaultUserId = currentUser.id || '33333333-3333-4333-8333-333333333333';

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

      {viewingSubmissionsAssignmentId ? (
        <main className="classroom-detail-content">
          <AssignmentSubmissionsPage
            assignmentId={viewingSubmissionsAssignmentId}
            classId={defaultClassId}
            onBack={() => setViewingSubmissionsAssignmentId(null)}
            currentUser={currentUser}
          />
        </main>
      ) : currentNavTab === 'study-buddy' ? (
        <main className="classroom-detail-content" style={{ maxWidth: '1280px', margin: '0 auto', padding: '1.5rem 2rem' }}>
          <StudyBuddy isTeacher={isTeacher} darkMode={darkMode} />
        </main>
      ) : (
        <>
          {/* Classroom Title & Navigation Tabs Header */}
          <ClassroomHeader
            title={classroom.title}
            subject={`${classroom.subject} · ${isTeacher ? 'Teacher View' : 'Student View'}`}
            activeTab={activeDetailTab}
            onTabChange={handleDetailTabChange}
            onBack={onBackToClassrooms}
            isTeacher={isTeacher}
            onDelete={handleDeleteClassroom}
          />

          {/* Detail Tab Contents with Integrated Props */}
          <main className="classroom-detail-content" style={{ maxWidth: '1280px', margin: '0 auto', padding: '1.5rem 2rem' }}>
            {activeDetailTab === 'materials' && (
              <MaterialsTab 
                classId={defaultClassId} 
                isTeacher={isTeacher} 
                currentUser={currentUser} 
              />
            )}
            {activeDetailTab === 'live-class' && (
              <LiveClassTab
                classId={defaultClassId}
                studentId={defaultUserId}
                isTeacher={isTeacher}
                currentUser={currentUser}
              />
            )}
            {activeDetailTab === 'assignments' && (
              <AssignmentsTab
                classId={defaultClassId}
                isTeacher={isTeacher}
                currentUserId={defaultUserId}
                currentUser={currentUser}
              />
            )}
            {activeDetailTab === 'attendance' && (
              <AttendanceTab
                classId={defaultClassId}
                studentId={defaultUserId}
                isTeacher={isTeacher}
                currentUser={currentUser}
              />
            )}
            {activeDetailTab === 'quizzes' && (
              <QuizzesTab 
                classId={defaultClassId}
                isTeacher={isTeacher} 
                currentUser={currentUser} 
                darkMode={darkMode}
              />
            )}
            {activeDetailTab === 'members' && (
              <MembersTab darkMode={darkMode} setDarkMode={setDarkMode} classroom={classroom} currentUser={currentUser} />
            )}
          </main>
        </>
      )}
    </div>
  );
}