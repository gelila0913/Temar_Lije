import React from 'react';
import './Title.css';

const Title = ({ 
  title, 
  subtitle, 
  invitationCode, 
  onBack, 
  activeTab, 
  onTabChange, 
  tabs = ['Materials', 'Live class', 'Assignments', 'Attendance', 'Quizzes', 'Members'] 
}) => {
  return (
    <div className="title-wrapper">
      <header className="app-top-nav">
        <div className="nav-left">
          <div className="brand-logo">
            <svg className="logo-icon" viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 10v6M2 10l10-5 10 5-10 5z"></path>
              <path d="M6 12v5c3 3 9 3 12 0v-5"></path>
            </svg>
            <span className="brand-name">ClassMind</span>
          </div>
          <nav className="primary-links">
            <a href="#" className="nav-link active">
              <svg className="nav-icon" viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7"></rect>
                <rect x="14" y="3" width="7" height="7"></rect>
                <rect x="14" y="14" width="7" height="7"></rect>
                <rect x="3" y="14" width="7" height="7"></rect>
              </svg>
              Classrooms
            </a>
            <a href="#" className="nav-link">
              <svg className="nav-icon" viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
              </svg>
              Study Buddy
            </a>
          </nav>
        </div>
        <div className="nav-right">
          <div className="user-profile">
            <div className="avatar">G</div>
            <div className="user-info">
              <span className="username">gelila</span>
              <span className="user-badge">Teacher</span>
            </div>
          </div>
          <button className="logout-btn" aria-label="Logout">
            <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
              <polyline points="16 17 21 12 16 7"></polyline>
              <line x1="21" y1="12" x2="9" y2="12"></line>
            </svg>
          </button>
        </div>
      </header>

      <div className="course-header-container">
        <div className="course-header-top">
          <div className="course-header-left">
            {onBack && (
              <button className="back-button" onClick={onBack}>
                &larr; Classrooms
              </button>
            )}
            <h1 className="course-title">{title}</h1>
            {subtitle && <p className="course-subtitle">{subtitle}</p>}
          </div>
          
          {invitationCode && (
            <div className="course-header-right">
              <div className="invitation-card">
                <span className="invitation-label">INVITATION CODE</span>
                <span className="invitation-code">{invitationCode}</span>
              </div>
            </div>
          )}
        </div>

        <div className="course-tabs-container">
          {tabs.map((tab) => (
            <button
              key={tab}
              className={`course-tab ${activeTab === tab ? 'active' : ''}`}
              onClick={() => onTabChange && onTabChange(tab)}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Title;
