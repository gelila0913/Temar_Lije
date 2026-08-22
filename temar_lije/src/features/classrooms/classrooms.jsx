import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Users, KeyRound, Loader2, AlertCircle, Trash2 } from 'lucide-react';
import './classrooms.css';
import CreateClassRoom from '../../components/layout/create_class_room/create_class_room';
import JoinClassRoom from '../../components/layout/join_class_room/join_class_room';
import Header from '../../components/common/Header/header.jsx';
import StudyBuddy from '../study-buddy/study-buddy.jsx';
import { getClassrooms, createClassroom, joinClassroom, deleteClassroom } from '../../services/apiClient';

export default function Classrooms({ 
  currentUser = { name: 'User', role: 'Teacher' }, 
  initialClassrooms = [],
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
  const [classroomsList, setClassroomsList] = useState(initialClassrooms);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadClassrooms = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getClassrooms();
      if (Array.isArray(data) && data.length > 0) {
        setClassroomsList(data);
      } else {
        setClassroomsList([]);
      }
    } catch (err) {
      console.warn('Failed to load classrooms from backend:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadClassrooms();
  }, [loadClassrooms]);

  const avatarInitial = currentUser?.name ? currentUser.name.charAt(0).toUpperCase() : 'U';

  const handleCreateClassroom = async (newClassroomData) => {
    try {
      const created = await createClassroom({
        title: newClassroomData.title,
        subject: newClassroomData.subject,
        description: newClassroomData.description,
      });

      setClassroomsList((prev) => [created, ...prev]);
      setIsCreateModalOpen(false);
    } catch (err) {
      alert(err.message || 'Failed to create classroom');
    }
  };

  const handleJoinClassroom = async (codeToJoin) => {
    try {
      const joined = await joinClassroom(codeToJoin);
      setClassroomsList((prev) => {
        const exists = prev.some((c) => c.id === joined.id || (c.code || '').toUpperCase() === (joined.code || '').toUpperCase());
        if (exists) return prev;
        return [joined, ...prev];
      });
      alert(`Successfully enrolled in ${joined.title || 'classroom'}!`);
      setIsJoinModalOpen(false);
      return { success: true };
    } catch (err) {
      return { error: err.message || `No classroom found with code "${codeToJoin}".` };
    }
  };

  const handleCopyCode = (e, code) => {
    e.stopPropagation();
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(''), 2000);
  };

  const handleDeleteClassroom = async (e, classroom) => {
    e.stopPropagation();
    const classTitle = classroom.title || classroom.name || 'this classroom';
    const confirmed = window.confirm(
      `⚠️ Delete Classroom?\n\nAre you sure you want to permanently delete "${classTitle}"?\n\nAll classroom materials, assignments, enrolled student records, and study groups will be deleted. This action cannot be undone.`
    );
    if (!confirmed) return;

    try {
      await deleteClassroom(classroom.id);
      setClassroomsList((prev) => prev.filter((c) => c.id !== classroom.id));
      alert(`Classroom "${classTitle}" has been deleted.`);
    } catch (err) {
      alert(`Failed to delete classroom: ${err.message || 'Error occurred'}`);
    }
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

            {error && (
              <div
                style={{
                  padding: '12px 16px',
                  backgroundColor: '#fee2e2',
                  color: '#b91c1c',
                  borderRadius: '10px',
                  marginBottom: '16px',
                  fontSize: '0.875rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <AlertCircle size={16} /> {error}
              </div>
            )}

            {/* Empty State vs Classroom Cards */}
            {loading ? (
              <div
                style={{
                  padding: '60px 20px',
                  textAlign: 'center',
                  background: '#ffffff',
                  borderRadius: '16px',
                  border: '1px solid #e5e7eb',
                }}
              >
                <Loader2 size={32} className="animate-spin" style={{ margin: '0 auto 12px', color: '#14785c' }} />
                <p style={{ color: '#6b7280', margin: 0 }}>Loading your classrooms...</p>
              </div>
            ) : classroomsList.length === 0 ? (
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
                      <h2 className="card-title">{classroom.title || classroom.name}</h2>
                      {classroom.subject && <p className="card-subject">{classroom.subject}</p>}
                      {classroom.description && <p className="card-description">{classroom.description}</p>}
                    </div>

                    <div className="card-footer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                      <div className="card-type" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Users size={14} />
                        <span>{isTeacher ? 'Host / Teacher' : 'Enrolled Student'}</span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {isTeacher && (
                          <button
                            type="button"
                            onClick={(e) => handleDeleteClassroom(e, classroom)}
                            title="Delete this classroom"
                            style={{
                              background: 'rgba(239, 68, 68, 0.1)',
                              color: '#dc2626',
                              border: '1px solid rgba(239, 68, 68, 0.25)',
                              borderRadius: '6px',
                              padding: '4px 8px',
                              fontSize: '11.5px',
                              fontWeight: 600,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              transition: 'all 0.15s ease'
                            }}
                          >
                            <Trash2 size={12} />
                            <span>Delete</span>
                          </button>
                        )}

                        {isTeacher ? (
                          <span 
                            className="card-code" 
                            onClick={(e) => handleCopyCode(e, classroom.code || classroom.inviteCode)}
                            title="Click to copy invitation code for students"
                            style={{ cursor: 'pointer' }}
                          >
                            {copiedCode === (classroom.code || classroom.inviteCode) ? 'Copied!' : (classroom.code || classroom.inviteCode)}
                          </span>
                        ) : (
                          <span className="card-code" style={{ opacity: 0.85 }}>
                            Code: {classroom.code || classroom.inviteCode}
                          </span>
                        )}
                      </div>
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