import React from 'react';
import { MessageSquare, BookOpen, Send } from 'lucide-react';
import './send_invitation.css';

function SendInvitation({
    isOpen,
    onClose,
    groupName = 'Study Group',
    topicName,
    invitedMembers = ['at', 'yb'],
    userProfiles = {},
    onSend
}) {
    if (!isOpen) return null;

    const invitedUserObjs = invitedMembers.map(id => ({
        id,
        ...userProfiles[id]
    })).filter(u => u.name);

    const handleSend = () => {
        if (onSend) {
            onSend(invitedMembers);
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
                <h2 className="send-inv-modal-title">Send Invitations</h2>
                <p className="send-inv-modal-subtitle">
                    You're inviting {invitedUserObjs.length} student{invitedUserObjs.length === 1 ? '' : 's'} to join your study group.
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

                {/* Invited Students List */}
                <div className="send-inv-students-list">
                    {invitedUserObjs.map((user) => (
                        <div key={user.id} className="send-inv-student-row">
                            <div className="send-inv-student-left">
                                <div
                                    className="send-inv-student-avatar"
                                    style={{ backgroundColor: user.avatarBg || '#8b5cf6' }}
                                >
                                    {user.initials}
                                    {user.online && <span className="send-inv-online-dot" />}
                                </div>
                                <span className="send-inv-student-name">{user.name}</span>
                            </div>
                            <span className="send-inv-online-badge">Online</span>
                        </div>
                    ))}
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
                        Send Invitations
                    </button>
                </div>

            </div>
        </div>
    );
}

export default SendInvitation;
