import React from 'react';
import { MessageSquare, Check } from 'lucide-react';
import './study_invitation.css';

function StudyInvitation({
    isOpen,
    onClose,
    inviterName = 'Your study partner',
    inviterInitials = 'GS',
    topicName = 'StatefulWidget Lifecycle',
    categoryName = 'Flutter · Widget Structure',
    onJoin,
    onDecline
}) {
    if (!isOpen) return null;

    const handleJoin = () => {
        if (onJoin) onJoin();
        onClose();
    };

    const handleDecline = () => {
        if (onDecline) onDecline();
        onClose();
    };

    return (
        <div className="study-inv-modal-overlay" onClick={onClose}>
            <div className="study-inv-modal-content" onClick={(e) => e.stopPropagation()}>

                {/* Top Circular Inviter Avatar with Ring & Chat Badge */}
                <div className="study-inv-avatar-container">
                    <div className="study-inv-avatar-ring">
                        <div className="study-inv-avatar-inner">
                            {inviterInitials}
                        </div>
                        <div className="study-inv-chat-badge">
                            <MessageSquare size={12} />
                        </div>
                    </div>
                </div>

                {/* Title & Inviter Subtitle */}
                <h2 className="study-inv-modal-title">Study Invitation</h2>
                <p className="study-inv-modal-subtitle">
                    <strong className="study-inv-inviter-name">{inviterName}</strong> invited you to join a study session
                </p>

                {/* Topic Card */}
                <div className="study-inv-topic-card">
                    <span className="study-inv-topic-label">TOPIC</span>
                    <h3 className="study-inv-topic-name">{topicName}</h3>
                    <p className="study-inv-topic-category">{categoryName}</p>
                </div>

                {/* Action Buttons */}
                <div className="study-inv-modal-actions">
                    <button
                        type="button"
                        className="study-inv-btn-decline"
                        onClick={handleDecline}
                    >
                        Decline
                    </button>
                    <button
                        type="button"
                        className="study-inv-btn-join"
                        onClick={handleJoin}
                    >
                        <Check size={16} />
                        Join Session
                    </button>
                </div>

            </div>
        </div>
    );
}

export default StudyInvitation;
