import React, { useState, useEffect, useRef } from 'react';
import { Search, Plus, Users, Code, Sparkles, Trash2, CheckCircle2 } from 'lucide-react';
import io from 'socket.io-client';
import './membersTab.css';
import Chat from '../../../chat/chat.jsx';
import CreateGroupModal from '../../../../components/members/CreateGroupModal.jsx';
import { API_BASE_URL } from '../../../../config/constants';
import { useAuth } from '../../../../context/AuthContext';
import CreateGroup from '../../../../components/layout/create_group/create_group.jsx';
import StudyInvitation from '../../../../components/layout/study_invitation/study_invitation.jsx';
import SendInvitation from '../../../../components/layout/send_invitation/send_invitation.jsx';

const USER_PROFILES = {
  'at': { name: 'Abebe Tadesse', initials: 'AT', avatarBg: '#8b5cf6', online: true },
  'mh': { name: 'Meron Haile', initials: 'MH', avatarBg: '#f97316', online: false },
  'yb': { name: 'Yonas Bekele', initials: 'YB', avatarBg: '#0d9488', online: true },
  'ta': { name: 'Tigist Alemu', initials: 'TA', avatarBg: '#a855f7', online: true },
};

// Static classroom roster (mock — no classroom-members API exists).
// The authenticated user is injected at render time from useAuth() and
// keyed by id, so the (you) badge can only ever match their account.
const ONLINE_CLASSMATES = [
  { id: 'mock-at', name: 'Abebe Tadesse', initials: 'AT', avatarClass: 'at-bg' },
  { id: 'mock-yb', name: 'Yonas Bekele', initials: 'YB', avatarClass: 'yb-bg' },
  { id: 'mock-ta', name: 'Tigist Alemu', initials: 'TA', avatarClass: 'ta-bg' },
  { id: 'mock-ht', name: 'Hana Tesfaye', initials: 'HT', avatarClass: 'ht-bg' },
];

const OFFLINE_CLASSMATES = [
  { id: 'mock-mh', name: 'Meron Haile', initials: 'MH', avatarClass: 'mh-bg', status: 'last seen 2h ago' },
  { id: 'mock-dg', name: 'Dawit Girma', initials: 'DG', avatarClass: 'dg-bg', status: 'last seen 1d ago' },
];

export default function MembersTab({ darkMode, setDarkMode, classroom, currentUser }) {
  const { user, accessToken } = useAuth();
  const classroomId = String(classroom?.id || classroom?.code || 'flutter');
  const effectiveUserId = user?.id || currentUser?.id || 'gs';
  const effectiveUserName = user?.fullName || currentUser?.name || 'Sara Gebremedhin';
  const currentUserInitials = user?.initials
    || currentUser?.initials
    || (effectiveUserName || '').trim().split(/\s+/).map(p => p[0]).join('').slice(0, 2).toUpperCase()
    || 'U';

  const [activeTab, setActiveTab] = useState('Members');
  const [selectedGroupId, setSelectedGroupId] = useState(null);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [showSendInvitationModal, setShowSendInvitationModal] = useState(false);
  const [pendingGroupDetails, setPendingGroupDetails] = useState(null);
  const [studyGroups, setStudyGroups] = useState([]);
  const [invitationToast, setInvitationToast] = useState('');
  const [invitationData, setInvitationData] = useState({
    isOpen: false,
    inviterName: '',
    inviterInitials: '',
    topicName: '',
    categoryName: '',
    groupId: ''
  });
  const socketRef = useRef(null);
  const tabs = ['Members', 'Study Groups'];

  useEffect(() => {
    const socket = io(API_BASE_URL.replace('/api', ''), {
      auth: { token: accessToken },
      transports: ['websocket', 'polling']
    });
    socketRef.current = socket;

    socket.on('studyInvitation', (data) => {
      if (data.invitedMembers?.includes(effectiveUserId) && data.inviterId !== effectiveUserId) {
        setInvitationData({
          isOpen: true,
          inviterName: data.inviterName || 'Classmate',
          inviterInitials: data.inviterInitials || 'CM',
          topicName: data.topicName || 'Study Session',
          categoryName: data.categoryName || `${classroom?.title || 'Classroom'} · Study Group`,
          groupId: data.groupId
        });
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [effectiveUserId, accessToken, classroom]);

  const fetchStudyGroups = () => {
    const headers = accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
    fetch(`${API_BASE_URL}/chat/groups?classroomId=${encodeURIComponent(classroomId)}`, { headers })
      .then(res => res.json())
      .then(data => {
        if (data && Array.isArray(data)) {
          const mainGroups = data.filter((g) => {
            const isTopic = data.some((other) => other.id !== g.id && g.id.startsWith(`${other.id}-`));
            return !isTopic;
          });
          const mappedGroups = mainGroups.map((g) => ({
            id: g.id,
            name: g.name,
            subtitle: g.subtitle || g.description || `${g.members?.length || 0} members`,
            isClassroom: false,
            time: '',
            icon: g.icon || '📚',
            color: g.color || '#6366f1',
            members: g.members?.map(m => m.userId) || []
          }));
          setStudyGroups(mappedGroups);
        }
      })
      .catch(err => console.error('Failed to load study groups in MembersTab:', err));
  };

  useEffect(() => {
    fetchStudyGroups();
  }, [classroomId, accessToken]);

  const handleCreateGroup = (groupDetails) => {
    setPendingGroupDetails(groupDetails);
    setShowCreateGroup(false);
    setShowSendInvitationModal(true);
  };

  const handleConfirmSendInvitations = (invitedMembers) => {
    if (!pendingGroupDetails) return;
    const groupDetails = {
      ...pendingGroupDetails,
      members: invitedMembers || pendingGroupDetails.members
    };

    const memberList = [effectiveUserId, ...(groupDetails.members || [])];
    const headers = {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {})
    };

    fetch(`${API_BASE_URL}/chat/groups`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: groupDetails.name,
        description: 'Study group discussion',
        icon: groupDetails.icon || '📚',
        color: groupDetails.color || '#6366f1',
        classroomId: classroomId,
        memberIds: memberList
      })
    })
      .then(res => {
        if (!res.ok) throw new Error(`Create group failed (${res.status})`);
        return res.json();
      })
      .then(g => {
        const newGroupObj = {
          id: g.id,
          name: g.name,
          subtitle: 'No messages yet',
          isClassroom: false,
          time: '',
          icon: g.icon || '📚',
          color: g.color || '#6366f1',
          members: memberList
        };

        // Emit WebSocket studyInvitation to all invited classmates
        if (socketRef.current) {
          socketRef.current.emit('studyInvitation', {
            inviterId: effectiveUserId,
            inviterName: effectiveUserName,
            inviterInitials: currentUserInitials,
            topicName: groupDetails.name,
            categoryName: `${classroom?.title || 'Classroom'} · Study Group`,
            invitedMembers: groupDetails.members || [],
            groupId: g.id
          });

          // Post initial system invitation message in the study group chat
          socketRef.current.emit('sendMessage', {
            roomId: g.id,
            text: `👋 ${effectiveUserName} created the study group "${groupDetails.name}" and sent invitations to ${groupDetails.members?.length || 0} classmates.`,
            type: 'system'
          });
        }

        setStudyGroups(prev => [...prev.filter(item => item.id !== g.id), newGroupObj]);
        setShowSendInvitationModal(false);
        setPendingGroupDetails(null);
        setSelectedGroupId(g.id);

        setInvitationToast(`🎉 Study group "${groupDetails.name}" created & invitations sent!`);
        setTimeout(() => setInvitationToast(''), 4000);
      })
      .catch(err => {
        console.error('Failed to create group in MembersTab:', err);
      });
  };

  const handleDeleteGroup = (groupId, e) => {
    if (e) e.stopPropagation();
    if (window.confirm('Are you sure you want to delete this study group?')) {
      const headers = accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
      fetch(`${API_BASE_URL}/chat/groups/${groupId}`, {
        method: 'DELETE',
        headers
      })
        .then(() => {
          setStudyGroups((prev) => prev.filter((g) => g.id !== groupId));
          if (selectedGroupId === groupId) {
            setSelectedGroupId(null);
          }
        })
        .catch((err) => console.error('Failed to delete group in MembersTab:', err));
    }
  };

  return (
    <div className={`members-page-layout ${darkMode ? 'dark' : ''}`}>
      {/* Sidebar Section */}
      <aside className="sidebar-container">
        <div className="sidebar-profile">
          <div className="sidebar-user">
            <div className="user-avatar-circle">{currentUserInitials}</div>
            <div className="user-text">
              <span className="user-name-text">{user?.fullName || currentUser?.name || 'You'}</span>
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
          <div className="section-header">CLASSROOM CHATS</div>
          <div 
            className={`sidebar-item ${selectedGroupId === ((classroom?.title || 'flutter').toLowerCase().replace(/\s+/g, '-')) ? 'active' : ''}`}
            onClick={() => {
              const classSlug = (classroom?.title || 'flutter').toLowerCase().replace(/\s+/g, '-');
              setSelectedGroupId(classSlug);
            }}
            style={{ cursor: 'pointer' }}
          >
            <div className="item-icon green-bg">
              <Code size={18} />
            </div>
            <div className="item-content">
              <div className="item-title-row">
                <span className="item-title">{classroom?.title || 'Flutter'} (General)</span>
              </div>
              <p className="item-subtitle">Main class discussion & voice</p>
            </div>
          </div>

          <div 
            className={`sidebar-item ${selectedGroupId === null ? 'active' : ''}`}
            onClick={() => { setSelectedGroupId(null); setActiveTab('Members'); }}
            style={{ cursor: 'pointer', borderTop: '1px dashed var(--border-color, #e2e8f0)', marginTop: '4px', paddingTop: '6px' }}
          >
            <div className="item-icon" style={{ backgroundColor: '#0ea5e9' }}>
              <Users size={16} />
            </div>
            <div className="item-content">
              <div className="item-title-row">
                <span className="item-title">Classroom Overview</span>
              </div>
              <p className="item-subtitle">Members roster & study groups</p>
            </div>
          </div>
        </div>

        <div className="sidebar-section">
          <div className="section-header">
            <span>STUDY GROUPS</span>
            <button
              type="button"
              className="add-group-btn"
              onClick={() => setShowCreateGroup(true)}
              title="Create new study group"
            >
              <Plus size={16} />
            </button>
          </div>
          {studyGroups.length === 0 ? (
            <div style={{ padding: '10px 14px', fontSize: '12px', color: 'var(--text-muted, #94a3b8)', fontStyle: 'italic' }}>
              No groups created yet.
            </div>
          ) : (
            studyGroups.map((group) => (
              <div 
                key={group.id}
                className={`sidebar-item ${selectedGroupId === group.id ? 'active' : ''}`}
                onClick={() => setSelectedGroupId(group.id)}
                style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}
              >
                <div className="item-icon purple-bg" style={{ backgroundColor: group.color || '#8b5cf6' }}>
                  {group.icon ? <span style={{ fontSize: '18px' }}>{group.icon}</span> : <Sparkles size={18} />}
                </div>
                <div className="item-content" style={{ flex: 1 }}>
                  <div className="item-title-row">
                    <span className="item-title">{group.name}</span>
                    <span className="item-time">{group.time}</span>
                  </div>
                  <p className="item-subtitle">{group.subtitle}</p>
                </div>
                <button
                  className="delete-group-btn"
                  onClick={(e) => handleDeleteGroup(group.id, e)}
                  title="Delete study group"
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#ef4444',
                    cursor: 'pointer',
                    padding: '6px',
                    borderRadius: '6px',
                    marginLeft: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="main-classroom-area" style={selectedGroupId !== null ? { overflow: 'hidden' } : {}}>
        {selectedGroupId !== null ? (
          <Chat 
            hideSidebar={true} 
            activeId={selectedGroupId} 
            setActiveId={setSelectedGroupId} 
            classroomId={classroomId}
            studyGroups={studyGroups}
            setStudyGroups={setStudyGroups}
            darkMode={darkMode}
            setDarkMode={setDarkMode}
          />
        ) : (
          <>
            {/* Classroom Title Header */}
            <header className="classroom-header-bar">
              <div className="classroom-header-icon">
                <Code size={20} />
              </div>
              <div className="classroom-header-info">
                <h1 className="classroom-title-text">{classroom?.title || 'Flutter'}</h1>
                <p className="classroom-subtitle-text">{classroom?.subject || 'Widget • widget structure'}</p>
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
                      onClick={() => setShowCreateGroup(true)}
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
                    <h4 className="section-title">STUDENTS • ONLINE ({ONLINE_CLASSMATES.length + 1})</h4>
                    <div className="members-list-stack">
                      {[
                        {
                          id: user?.id || 'anonymous',
                          name: user?.fullName || currentUser?.name || 'You',
                          initials: currentUserInitials,
                          avatarClass: 'gs-bg',
                        },
                        ...ONLINE_CLASSMATES,
                      ].map((member) => (
                        <div className="member-card-row" key={member.id}>
                          <div className={`member-avatar ${member.avatarClass}`}>{member.initials}</div>
                          <div className="member-details">
                            <div className="member-name-row">
                              <span className="member-name-text">{member.name}</span>
                              {(member.id === user?.id || (member.name === (user?.fullName || currentUser?.name))) && (
                                <span className="you-badge-label">(you)</span>
                              )}
                            </div>
                            <span className="member-status-text">
                              <span className="online-indicator-dot"></span> online now
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>

                  {/* Students Offline Section */}
                  <section className="members-section">
                    <h4 className="section-title">STUDENTS • OFFLINE ({OFFLINE_CLASSMATES.length})</h4>
                    <div className="members-list-stack">
                      {OFFLINE_CLASSMATES.map((member) => (
                        <div className="member-card-row offline" key={member.id}>
                          <div className={`member-avatar ${member.avatarClass}`}>{member.initials}</div>
                          <div className="member-details">
                            <span className="member-name-text">{member.name}</span>
                            <span className="member-status-text">
                              <span className="offline-indicator-dot"></span> {member.status}
                            </span>
                          </div>
                        </div>
                      ))}
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
                        <h3 className="banner-title">Classroom Study Groups</h3>
                        <p className="banner-desc">Collaborate with peers on class projects and group study.</p>
                      </div>
                    </div>
                    <button 
                      type="button" 
                      className="new-group-action-btn" 
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                      onClick={() => setShowCreateGroup(true)}
                    >
                      <Plus size={16} /> New Group
                    </button>
                  </div>

                  {studyGroups.length === 0 ? (
                    <div style={{ padding: '40px 20px', textAlign: 'center', color: '#64748b' }}>
                      <Users size={40} style={{ margin: '0 auto 12px auto', color: '#94a3b8', display: 'block' }} />
                      <h4 style={{ margin: '0 0 6px 0', fontSize: '16px', fontWeight: 600, color: 'var(--text-main, #1e293b)' }}>No study groups created yet</h4>
                      <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: '#64748b' }}>Click "New Group" above to start your first peer study session.</p>
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px', marginTop: '20px' }}>
                      {studyGroups.map(group => (
                        <div 
                          key={group.id}
                          onClick={() => setSelectedGroupId(group.id)}
                          style={{
                            padding: '16px',
                            borderRadius: '12px',
                            border: '1px solid var(--border-color, #e2e8f0)',
                            backgroundColor: 'var(--card-bg, #ffffff)',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '12px'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: group.color || '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', color: '#ffffff' }}>
                              {group.icon || '📚'}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: 'var(--text-main, #0f172a)' }}>{group.name}</h4>
                              <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: 'var(--text-muted, #64748b)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{group.subtitle || 'Study group'}</p>
                            </div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '10px', borderTop: '1px solid var(--border-color, #f1f5f9)' }}>
                            <span style={{ fontSize: '12px', color: '#0d9488', fontWeight: 600 }}>Open Chat →</span>
                            <span style={{ fontSize: '11px', color: '#94a3b8' }}>{group.members?.length || 1} members</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </main>

      <CreateGroup
        isOpen={showCreateGroup}
        onClose={() => setShowCreateGroup(false)}
        onCreate={handleCreateGroup}
      />

      <SendInvitation
        isOpen={showSendInvitationModal}
        onClose={() => {
          setShowSendInvitationModal(false);
          setPendingGroupDetails(null);
        }}
        groupName={pendingGroupDetails?.name || 'Study Group'}
        invitedMembers={pendingGroupDetails?.members || []}
        userProfiles={USER_PROFILES}
        onSend={handleConfirmSendInvitations}
      />

      <StudyInvitation
        isOpen={invitationData.isOpen}
        onClose={() => setInvitationData(prev => ({ ...prev, isOpen: false }))}
        inviterName={invitationData.inviterName}
        inviterInitials={invitationData.inviterInitials}
        topicName={invitationData.topicName}
        categoryName={invitationData.categoryName}
        onJoin={() => {
          if (invitationData.groupId) {
            setSelectedGroupId(invitationData.groupId);
          }
          setInvitationData(prev => ({ ...prev, isOpen: false }));
        }}
        onDecline={() => {
          setInvitationData(prev => ({ ...prev, isOpen: false }));
        }}
      />

      {invitationToast && (
        <div 
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            backgroundColor: '#0d9488',
            color: '#ffffff',
            padding: '12px 20px',
            borderRadius: '12px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            zIndex: 99999,
            fontWeight: 600,
            fontSize: '14px',
            animation: 'fadeIn 0.2s ease-out'
          }}
        >
          <CheckCircle2 size={18} />
          <span>{invitationToast}</span>
        </div>
      )}
    </div>
  );
}
