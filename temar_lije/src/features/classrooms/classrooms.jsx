import React, { useState, useEffect } from 'react';
import { LayoutGrid, Sparkles, LogOut, Plus, Users } from 'lucide-react';
import './classrooms.css';
import temarLijeLogo from '../../assets/temar-lije-logo.png';
import CreateClassRoom from '../../components/layout/create_class_room/create_class_room';
import Header from '../../components/common/Header/header.jsx';
import StudyBuddy from '../study-buddy/study-buddy.jsx';

const DEFAULT_CLASSROOMS = [
  {
    id: 1,
    title: 'React',
    subject: 'xzvfdgxacds',
    description: 'sdwr',
    code: 'RRWC3C'
  },
  {
    id: 2,
    title: 'Flutter',
    subject: 'Widget',
    description: 'widget structure',
    code: 'DB7GLU'
  }
];

export default function Classrooms({ 
  currentUser = { name: 'gelila', role: 'Teacher' }, 
  initialClassrooms = DEFAULT_CLASSROOMS,
  onLogout = () => alert('Signing out...'),
  onSelectClassroom,
  darkMode,
  setDarkMode
}) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('classrooms');

  
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
      code: randomCode
    };

    setClassroomsList((prev) => [...prev, newClass]);
  };

  const handleCopyCode = (e, code) => {
    e.stopPropagation();
    navigator.clipboard.writeText(code);
    alert(`Classroom invitation code "${code}" copied to clipboard!`);
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
        {activeTab === 'classrooms' ? (
          <>
            <div className="main-top-bar">
              <div>
                <h1 className="page-title">Your classrooms</h1>
                <p className="page-subtitle">
                  Create a classroom, share the invitation code and upload lesson materials.
                </p>
              </div>

              <button 
                className="btn-new-classroom"
                onClick={() => setIsModalOpen(true)}
              >
                <Plus size={16} /> New classroom
              </button>
            </div>

            {/* Empty State vs Classroom Cards */}
            {classroomsList.length === 0 ? (
              <div className="empty-state">
                <Users size={48} className="empty-icon" />
                <h3>No classrooms yet</h3>
                <p>Create your first classroom to get started with live teaching and materials.</p>
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
                        <span>Classroom</span>
                      </div>

                      <span 
                        className="card-code" 
                        onClick={(e) => handleCopyCode(e, classroom.code)}
                        title="Click to copy code"
                        style={{ cursor: 'pointer' }}
                      >
                        {classroom.code}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <StudyBuddy />
        )}
      </main>

      {/* Modal Popup */}
      <CreateClassRoom 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onCreate={handleCreateClassroom}
      />
    </div>
  );
}