import React, { useState } from 'react';
import { Search, Moon, Plus, Users, Code, Sparkles, ArrowLeft } from 'lucide-react';
import './membersTab.css';
import Chat from '../../../chat/chat.jsx';

export default function MembersTab({ darkMode, setDarkMode }) {
  const [activeTab, setActiveTab] = useState('Members');
  const [selectedGroupId, setSelectedGroupId] = useState(null);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [studyGroups, setStudyGroups] = useState([
    { id: 'widget-kings', name: 'Widget Kings 👑', subtitle: 'Abebe: Deadline Sunday midni...', isClassroom: false, time: '2:54 PM', members: ['gs', 'at', 'yb'], icon: '🦋', color: '#6366f1' },
    { id: 'vd', name: 'vd', subtitle: 'No messages yet', isClassroom: false, time: '', members: ['gs'], icon: '💻', color: '#0d9488' },
    { id: 'packages', name: 'packages', subtitle: 'No messages yet', isClassroom: false, time: '', members: ['gs'], icon: '📚', color: '#06b6d4' }
  ]);
  const tabs = ['Members', 'Study Groups'];

  return (
    <div className={`members-page-layout ${darkMode ? 'dark' : ''}`}>
      {/* Sidebar Section */}
      <aside className="sidebar-container">
        <div className="sidebar-profile">
          <div className="sidebar-user">
            <div className="user-avatar-circle">GS</div>
            <div className="user-text">
              <span className="user-name-text">Gelila Sintayehu</span>
              <span className="user-status-text">
                <span className="online-indicator-dot"></span> online
              </span>
            </div>
          </div>
        </div>

        <div className="sidebar-search">
          <div className="search-input-wrapper">
            <Search size={16} />
            <input type="text" placeholder="Search..." />
          </div>
        </div>

        <div className="sidebar-section">
          <div className="section-header">CLASSROOMS</div>
          <div 
            className={`sidebar-item ${selectedGroupId === null ? 'active' : ''}`}
            onClick={() => { setSelectedGroupId(null); setActiveTab('Members'); }}
            style={{ cursor: 'pointer' }}
          >
            <div className="item-icon green-bg">
              <Code size={18} />
            </div>
            <div className="item-content">
              <div className="item-title-row">
                <span className="item-title">Flutter</span>
                <span className="item-time">1:56 PM</span>
              </div>
              <p className="item-subtitle">Samuel: Post your lifecycle qu...</p>
            </div>
          </div>

          <div 
            className="sidebar-item"
            onClick={() => { setSelectedGroupId(null); setActiveTab('Members'); }}
            style={{ cursor: 'pointer' }}
          >
            <div className="item-icon purple-bg">
              <Code size={18} />
            </div>
            <div className="item-content">
              <div className="item-title-row">
                <span className="item-title">React Native</span>
              </div>
              <p className="item-subtitle">Mobile development</p>
            </div>
          </div>
        </div>

        <div className="sidebar-section">
          <div className="section-header">
            <span>STUDY GROUPS</span>
            <button 
              type="button" 
              className="add-group-btn"
              onClick={() => {
                setSelectedGroupId('widget-kings');
                setShowCreateGroup(true);
              }}
            >
              <Plus size={16} />
            </button>
          </div>
          {studyGroups.map((group) => (
            <div 
              key={group.id}
              className={`sidebar-item ${selectedGroupId === group.id ? 'active' : ''}`}
              onClick={() => setSelectedGroupId(group.id)}
              style={{ cursor: 'pointer' }}
            >
              <div className="item-icon purple-bg" style={{ backgroundColor: group.color || '#8b5cf6' }}>
                {group.icon ? <span style={{ fontSize: '18px' }}>{group.icon}</span> : <Sparkles size={18} />}
              </div>
              <div className="item-content">
                <div className="item-title-row">
                  <span className="item-title">{group.name}</span>
                  <span className="item-time">{group.time}</span>
                </div>
                <p className="item-subtitle">{group.subtitle}</p>
              </div>
            </div>
          ))}
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="main-classroom-area" style={selectedGroupId !== null ? { overflow: 'hidden' } : {}}>
        {selectedGroupId !== null ?
          <Chat 
            hideSidebar={true} 
            activeId={selectedGroupId} 
            setActiveId={setSelectedGroupId} 
            showCreateGroupDirectly={showCreateGroup} 
            onCloseCreateGroupDirectly={() => setShowCreateGroup(false)}
            studyGroups={studyGroups}
            setStudyGroups={setStudyGroups}
            darkMode={darkMode}
            setDarkMode={setDarkMode}
          />
         : 
          <>
            {/* Classroom Title Header */}
            <header className="classroom-header-bar">
              <div className="classroom-header-icon">
                <Code size={20} />
              </div>
              <div className="classroom-header-info">
                <h1 className="classroom-title-text">Flutter</h1>
                <p className="classroom-subtitle-text">Widget • widget structure</p>
              </div>
            </header>

        {/* Tab Sub-navigation */}
        <nav className="classroom-tabs-navigation">
          {tabs.map((tab) => (
            <button
              key={tab}
              type="button"
              className={`nav-tab-button ${tab === activeTab ? 'active' : ''}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </button>
          ))}
        </nav>

        {/* Tab Content Area */}
        <div className="classroom-tab-content">
          {activeTab === 'Members' && (
            <div className="members-tab-view">
              {/* Start a Study Group Banner */}
              <div className="study-group-banner">
                <div className="banner-left">
                  <div className="banner-icon-circle">
                    <Users size={20} />
                  </div>
                  <div className="banner-text">
                    <h3 className="banner-title">Start a Study Group</h3>
                    <p className="banner-desc">Create a private group chat for assignments, projects, or peer study.</p>
                  </div>
                </div>
                <button 
                  type="button" 
                  className="new-group-action-btn" 
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                  onClick={() => {
                    setSelectedGroupId('widget-kings');
                    setShowCreateGroup(true);
                  }}
                >
                  <Plus size={16} /> New Group
                </button>
              </div>

              {/* Teachers Section */}
              <section className="members-section">
                <h4 className="section-title">TEACHERS (1)</h4>
                <div className="member-card-row">
                  <div className="member-avatar sm-bg">SM</div>
                  <div className="member-details">
                    <div className="member-name-row">
                      <span className="member-name-text">Samuel Mekonnen</span>
                      <span className="teacher-badge-label">Teacher</span>
                    </div>
                    <span className="member-status-text">
                      <span className="online-indicator-dot"></span> online now
                    </span>
                  </div>
                </div>
              </section>

              {/* Students Online Section */}
              <section className="members-section">
                <h4 className="section-title">STUDENTS • ONLINE (5)</h4>
                <div className="members-list-stack">
                  <div className="member-card-row">
                    <div className="member-avatar gs-bg">GS</div>
                    <div className="member-details">
                      <div className="member-name-row">
                        <span className="member-name-text">Gelila Sintayehu</span>
                        <span className="you-badge-label">(you)</span>
                      </div>
                      <span className="member-status-text">
                        <span className="online-indicator-dot"></span> online now
                      </span>
                    </div>
                  </div>

                  <div className="member-card-row">
                    <div className="member-avatar at-bg">AT</div>
                    <div className="member-details">
                      <span className="member-name-text">Abebe Tadesse</span>
                      <span className="member-status-text">
                        <span className="online-indicator-dot"></span> online now
                      </span>
                    </div>
                  </div>

                  <div className="member-card-row">
                    <div className="member-avatar yb-bg">YB</div>
                    <div className="member-details">
                      <span className="member-name-text">Yonas Bekele</span>
                      <span className="member-status-text">
                        <span className="online-indicator-dot"></span> online now
                      </span>
                    </div>
                  </div>

                  <div className="member-card-row">
                    <div className="member-avatar ta-bg">TA</div>
                    <div className="member-details">
                      <span className="member-name-text">Tigist Alemu</span>
                      <span className="member-status-text">
                        <span className="online-indicator-dot"></span> online now
                      </span>
                    </div>
                  </div>

                  <div className="member-card-row">
                    <div className="member-avatar ht-bg">HT</div>
                    <div className="member-details">
                      <span className="member-name-text">Hana Tesfaye</span>
                      <span className="member-status-text">
                        <span className="online-indicator-dot"></span> online now
                      </span>
                    </div>
                  </div>
                </div>
              </section>

              {/* Students Offline Section */}
              <section className="members-section">
                <h4 className="section-title">STUDENTS • OFFLINE (2)</h4>
                <div className="members-list-stack">
                  <div className="member-card-row offline">
                    <div className="member-avatar mh-bg">MH</div>
                    <div className="member-details">
                      <span className="member-name-text">Meron Haile</span>
                      <span className="member-status-text">
                        <span className="offline-indicator-dot"></span> last seen 2h ago
                      </span>
                    </div>
                  </div>

                  <div className="member-card-row offline">
                    <div className="member-avatar dg-bg">DG</div>
                    <div className="member-details">
                      <span className="member-name-text">Dawit Girma</span>
                      <span className="member-status-text">
                        <span className="offline-indicator-dot"></span> last seen 1d ago
                      </span>
                    </div>
                  </div>
                </div>
              </section>
            </div>
          )}

          {activeTab === 'Study Groups' && (
            <div className="members-tab-view">
              <div className="study-group-banner">
                <div className="banner-left">
                  <div className="banner-icon-circle">
                    <Sparkles size={20} />
                  </div>
                  <div className="banner-text">
                    <h3 className="banner-title">Widget Kings 👑</h3>
                    <p className="banner-desc">4 members • Active peer study group for Flutter assignments.</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </>
    }
  </main>
    </div>
  );
}
