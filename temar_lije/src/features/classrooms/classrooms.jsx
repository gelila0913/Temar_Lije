import React, { useState, useEffect } from 'react';
import { LayoutGrid, Sparkles, LogOut, Plus, Users, KeyRound, CheckCircle2 } from 'lucide-react';
import './classrooms.css';
import CreateClassRoom from '../../components/layout/create_class_room/create_class_room';
import JoinClassRoom from '../../components/layout/join_class_room/join_class_room';
import Header from '../../components/common/Header/header.jsx';
import StudyBuddy from '../study-buddy/study-buddy.jsx';

const DEFAULT_CLASSROOMS = [
  {
    id: 1,
    title: 'React',
    subject: 'Modern Frontend Architecture',
    description: 'Component lifecycles, state management, and real-time sockets',
    code: 'RRWC3C',
    instructor: 'Instructor Gelila',
  },
  {
    id: 2,
    title: 'Flutter',
    subject: 'Widget · Widget Structure',
    description: 'Cross-platform mobile and hybrid UI development',
    code: 'DB7GLU',
    instructor: 'Instructor Fuad',
  }
];

export default function Classrooms({ 
  currentUser = { name: 'User', role: 'Teacher' }, 
  initialClassrooms = DEFAULT_CLASSROOMS,
  onLogout = () => alert('Signing out...'),
  onSelectClassroom,
  darkMode,
  setDarkMode
}) {
  const isTeacher = (currentUser?.role || '').toLowerCase() === 'teacher';
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('classrooms');
  const [copiedCode, setCopiedCode] = useState('');
  
  const [classroomsList, setClassroomsList] = useState(() => {
    const saved = localStorage.getItem('temar_classrooms');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {}
    }
    return DEFAULT_CLASSROOMS;
  });

  useEffect(() => {
    localStorage.setItem('temar_classrooms', JSON.stringify(classroomsList));
  }, [classroomsList]);

  const avatarInitial = currentUser?.name ? currentUser.name.charAt(0).toUpperCase() : 'U';

  const handleCreateClassroom = (newClassroomData) => {
    const randomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    
    const newClass = {
      id: Date.now(),
      title: newClassroomData.title,
      subject: newClassroomData.subject,
      description: newClassroomData.description,
      code: randomCode,
      instructor: currentUser.name,
    };

    setClassroomsList((prev) => [newClass, ...prev]);
  };

  const handleJoinClassroom = (codeToJoin) => {
    // Look up class in classrooms list
    const foundClass = classroomsList.find(
      (c) => (c.code || '').toUpperCase() === codeToJoin.toUpperCase()
    );

    if (!foundClass) {
      // Check if it's one of default classrooms
      const fallback = DEFAULT_CLASSROOMS.find(
        (c) => (c.code || '').toUpperCase() === codeToJoin.toUpperCase()
      );
      if (!fallback) {
        return { error: `No classroom found with code "${codeToJoin}". Please check with your teacher.` };
      }
    }

    alert(`Successfully enrolled in ${foundClass?.title || codeToJoin}!`);
    return { success: true };
  };

  const handleCopyCode = (e, code) => {
    e.stopPropagation();
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(''), 2000);
  };

  return (
    <div className="classrooms-container">
      {/* Top Navbar */}
      <Header 
        userName={currentUser.name} 
        role={currentUser.role} 
        userInitials={avatarInitial} 
        currentTab={activeTab} 
        onTabChange={setActiveTab} 
        onLogout={onLogout} 
        darkMode={darkMode}
        setDarkMode={setDarkMode}
      />

      {/* Main Content Area */}
      <main className="classrooms-main">
        {activeTab === 'classrooms' && (
          <>
            <div className="main-top-bar">
              <div>
                <h1 className="page-title">
                  {isTeacher ? 'Your classrooms (Teacher Portal)' : 'Enrolled classrooms (Student Portal)'}
                </h1>
                <p className="page-subtitle">
                  {isTeacher
                    ? 'Create classrooms, share invitation codes, and manage your lesson materials.'
                    : 'Join classrooms using your invitation code to access live sessions and learning materials.'}
                </p>
              </div>

              {isTeacher ? (
                <button 
                  className="btn-new-classroom"
                  onClick={() => setIsCreateModalOpen(true)}
                  id="teacher-new-classroom-btn"
                >
                  <Plus size={16} /> New classroom
                </button>
              ) : (
                <button 
                  className="btn-new-classroom"
                  onClick={() => setIsJoinModalOpen(true)}
                  id="student-join-classroom-btn"
                  style={{ backgroundColor: '#14785c' }}
                >
                  <KeyRound size={16} /> Join classroom
                </button>
              )}
            </div>

            {/* Empty State vs Classroom Cards */}
            {classroomsList.length === 0 ? (
              <div className="empty-state">
                <Users size={48} className="empty-icon" />
                <h3>No classrooms yet</h3>
                <p>
                  {isTeacher
                    ? 'Create your first classroom to get started with live teaching and materials.'
                    : 'Enter an invitation code from your teacher to join your first class.'}
                </p>
              </div>
            ) : (
              <div className="classrooms-grid">
                {classroomsList.map((classroom) => (
                  <div 
                    className="classroom-card" 
                    key={classroom.id}
                    onClick={() => onSelectClassroom && onSelectClassroom(classroom)}
                    style={{ cursor: 'pointer' }}
                  >
                    <div>
                      <div className="card-top-bar"></div>
                      <h2 className="card-title">{classroom.title}</h2>
                      {classroom.subject && <p className="card-subject">{classroom.subject}</p>}
                      {classroom.description && <p className="card-description">{classroom.description}</p>}
                    </div>

                    <div className="card-footer">
                      <div className="card-type">
                        <Users size={14} />
                        <span>{isTeacher ? 'Host / Teacher' : 'Enrolled Student'}</span>
                      </div>

                      {isTeacher ? (
                        <span 
                          className="card-code" 
                          onClick={(e) => handleCopyCode(e, classroom.code)}
                          title="Click to copy invitation code for students"
                          style={{ cursor: 'pointer' }}
                        >
                          {copiedCode === classroom.code ? 'Copied!' : classroom.code}
                        </span>
                      ) : (
                        <span className="card-code" style={{ opacity: 0.85 }}>
                          Code: {classroom.code}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {activeTab === 'study-buddy' && (
          <StudyBuddy isTeacher={isTeacher} />
        )}
      </main>

      {/* Teacher Modal Popup */}
      {isTeacher && (
        <CreateClassRoom 
          isOpen={isCreateModalOpen} 
          onClose={() => setIsCreateModalOpen(false)} 
          onCreate={handleCreateClassroom}
        />
      )}

      {/* Student Modal Popup */}
      {!isTeacher && (
        <JoinClassRoom
          isOpen={isJoinModalOpen}
          onClose={() => setIsJoinModalOpen(false)}
          onJoin={handleJoinClassroom}
        />
      )}
    </div>
  );
}