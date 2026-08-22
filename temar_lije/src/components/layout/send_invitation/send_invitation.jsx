import React, { useState, useEffect } from 'react';
import { MessageSquare, BookOpen, Send, Check } from 'lucide-react';
import './send_invitation.css';

function SendInvitation({
    isOpen,
    onClose,
    groupName = 'Study Group',
    topicName,
    invitedMembers = [],
    userProfiles = {},
    onSend
}) {
    const [selectedIds, setSelectedIds] = useState(invitedMembers);

    useEffect(() => {
        setSelectedIds(invitedMembers);
    }, [invitedMembers, isOpen]);

    if (!isOpen) return null;

    // Show all available students from userProfiles (or invited list)
    const allStudentIds = Object.keys(userProfiles);
    const displayIds = allStudentIds.length > 0 ? allStudentIds : invitedMembers;

    const handleToggle = (id) => {
        setSelectedIds(prev =>
            prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
        );
    };

    const handleSend = () => {
        if (onSend) {
            onSend(selectedIds);
        }
        onClose();
    };

    const displayName = topicName || groupName;
    const label = topicName ? 'Topic' : 'Study Group';

    return (
        <div className="send-inv-modal-overlay" onClick={onClose}>
            <div className="send-inv-modal-content" onClick={(e) => e.stopPropagation()}>
                
                {/* Top Green Icon Box */}
                <div className="send-inv-top-icon-box">
                    <MessageSquare size={24} />
                </div>

                {/* Header Title & Subtitle */}
                <h2 className="send-inv-modal-title">Invite Students</h2>
                <p className="send-inv-modal-subtitle">
                    Select the students you would like to invite to join <strong style={{ color: '#0f172a' }}>{displayName}</strong>.
                </p>

                {/* Group / Topic Banner Card */}
                <div className="send-inv-topic-card">
                    <div className="send-inv-topic-icon-box">
                        <BookOpen size={20} color="#0d6e5b" />
                    </div>
                    <div className="send-inv-topic-info">
                        <span className="send-inv-topic-label">{label}</span>
                        <h4 className="send-inv-topic-name">{displayName}</h4>
                    </div>
                </div>

                {/* Available Students List */}
                <div className="send-inv-students-list">
                    {displayIds.length === 0 ? (
                        <div style={{ padding: '20px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
                            No other students currently available to invite.
                        </div>
                    ) : (
                        displayIds.map((id) => {
                            const user = userProfiles[id] || { name: id, initials: 'ST', avatarBg: '#3b82f6' };
                            const isChecked = selectedIds.includes(id);
                            return (
                                <div
                                    key={id}
                                    className={`send-inv-student-row ${isChecked ? 'selected' : ''}`}
                                    onClick={() => handleToggle(id)}
                                    style={{
                                        cursor: 'pointer',
                                        transition: 'all 0.15s ease',
                                        backgroundColor: isChecked ? '#f0fdf9' : '',
                                        borderColor: isChecked ? '#99f6e4' : ''
                                    }}
                                >
                                    <div className="send-inv-student-left">
                                        <div
                                            className="send-inv-student-avatar"
                                            style={{ backgroundColor: user.avatarBg || '#3b82f6', position: 'relative' }}
                                        >
                                            {user.initials || 'ST'}
                                            <span
                                                style={{
                                                    position: 'absolute',
                                                    bottom: '-1px',
                                                    right: '-1px',
                                                    width: '9px',
                                                    height: '9px',
                                                    borderRadius: '50%',
                                                    backgroundColor: user.online ? '#22c55e' : '#94a3b8',
                                                    border: '2px solid #ffffff'
                                                }}
                                            />
                                        </div>
                                        <div>
                                            <span className="send-inv-student-name">{user.name}</span>
                                            <span style={{ display: 'block', fontSize: '11px', color: user.online ? '#15803d' : '#94a3b8', fontWeight: 600 }}>
                                                {user.online ? 'online' : 'offline'}
                                            </span>
                                        </div>
                                    </div>
                                    <div
                                        style={{
                                            width: '22px',
                                            height: '22px',
                                            borderRadius: '50%',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            backgroundColor: isChecked ? '#0d6e5b' : '#e2e8f0',
                                            transition: 'all 0.15s ease'
                                        }}
                                    >
                                        {isChecked && <Check size={13} strokeWidth={3} color="white" />}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Action Buttons */}
                <div className="send-inv-modal-actions">
                    <button
                        type="button"
                        className="send-inv-btn-cancel"
                        onClick={onClose}
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        className="send-inv-btn-submit"
                        onClick={handleSend}
                    >
                        <Send size={16} />
                        {selectedIds.length > 0 ? `Send Invitations (${selectedIds.length})` : 'Done'}
                    </button>
                </div>

            </div>
        </div>
    );
}

export default SendInvitation;
