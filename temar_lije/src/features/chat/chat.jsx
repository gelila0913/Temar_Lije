import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Sun, Moon, X, Search, ArrowLeft, Plus, BookOpen, Menu, UserPlus, Link, Check, CheckCheck, Paperclip, Send, Smile, Copy, Pencil, Trash2, Reply, Forward, Info, FileText, Image, FolderArchive, MessageSquare, Phone, Mic, MicOff, LogOut, Pin, PinOff, Play, Pause, ChevronUp, ChevronDown } from 'lucide-react';
import './chat.css';
import { io } from 'socket.io-client';
import { API_BASE_URL, getSocketUrl } from '../../config/constants';
import { useAuth } from '../../context/AuthContext';
import CreateGroup from '../../components/layout/create_group/create_group';
import AddMember from '../../components/layout/add_member/add_member';
import Topic from '../../components/layout/topic/topic';
import SendInvitation from '../../components/layout/send_invitation/send_invitation';
import StudyInvitation from '../../components/layout/study_invitation/study_invitation';

const CURATED_EMOJIS = ['😄', '😂', '👍', '❤️', '🔥', '💪', '✅', '🎨', '💻', '🚀', '📚', '📝', '💡', '👑', '🌟', '👏', '🎉', '👋'];

function Chat({
    hideSidebar = false,
    activeId: propActiveId,
    setActiveId: propSetActiveId,
    showCreateGroupDirectly = false,
    onCloseCreateGroupDirectly,
    studyGroups: propStudyGroups,
    setStudyGroups: propSetStudyGroups,
    classroomId,
    darkMode: propDarkMode,
    setDarkMode: propSetDarkMode
}) {
    const [localDarkMode, setLocalDarkMode] = useState(false);
    const darkMode = propDarkMode !== undefined ? propDarkMode : localDarkMode;
    const setDarkMode = propSetDarkMode !== undefined ? propSetDarkMode : setLocalDarkMode;
    const [searchQuery, setSearchQuery] = useState('');
    const [studentsList, setStudentsList] = useState([]);

    const { accessToken, refreshAccessToken, user: authUser } = useAuth();
    const tokenRef = useRef(accessToken);
    tokenRef.current = accessToken;

    const currentUser = useMemo(() => ({
        id: authUser?.id || 'guest',
        name: authUser?.fullName || authUser?.name || authUser?.email || 'User',
        initials: authUser?.initials || (authUser?.fullName || authUser?.name || 'U').trim().split(/\s+/).map(p => p[0]).join('').slice(0, 2).toUpperCase() || 'U',
        avatarBg: authUser?.avatarBg || '#3b82f6'
    }), [authUser?.id, authUser?.fullName, authUser?.name, authUser?.email, authUser?.initials, authUser?.avatarBg]);
    
    const currentUserRef = useRef(currentUser);
    currentUserRef.current = currentUser;
    const isAuthedRef = useRef(!!authUser);

    useEffect(() => {
        const fetchStudents = async () => {
            try {
                const res = await fetch(`${API_BASE_URL}/users/students`);
                if (res.ok) {
                    const data = await res.json();
                    if (Array.isArray(data)) {
                        setStudentsList(data);
                    }
                }
            } catch (err) {
                console.warn('Failed to load students in chat:', err);
            }
        };
        fetchStudents();
    }, []);

    const USER_PROFILES = useMemo(() => {
        const map = {};
        if (currentUser.id) {
            map[currentUser.id] = {
                name: currentUser.name,
                initials: currentUser.initials,
                avatarBg: currentUser.avatarBg,
                online: true,
            };
        }
        studentsList.forEach(s => {
            map[s.id] = {
                name: s.fullName || s.name || s.email,
                initials: s.initials || (s.fullName ? s.fullName.slice(0, 2).toUpperCase() : 'ST'),
                avatarBg: s.avatarBg || '#3b82f6',
                online: true,
            };
        });
        return map;
    }, [currentUser, studentsList]);

    // Fetch wrapper that attaches the JWT and silently refreshes once on 401
    const apiFetch = async (url, options = {}) => {
        const doFetch = (token) =>
            fetch(url, {
                ...options,
                headers: {
                    ...(options.headers || {}),
                    Authorization: `Bearer ${token}`
                }
            });
        let res = await doFetch(accessToken);
        if (res.status === 401 && accessToken) {
            try {
                const freshToken = await refreshAccessToken();
                if (freshToken) res = await doFetch(freshToken);
            } catch (err) {
                console.warn('Token refresh failed:', err);
            }
        }
        return res;
    };

    const [localActiveId, setLocalActiveId] = useState(authUser ? '' : 'widget-kings');
    const activeId = propActiveId !== undefined ? propActiveId : localActiveId;
    const setActiveId = propSetActiveId !== undefined ? propSetActiveId : setLocalActiveId;

    const [inputValue, setInputValue] = useState('');
    const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

    // In-Chat Message Search States
    const [showInChatSearch, setShowInChatSearch] = useState(false);
    const [inChatSearchQuery, setInChatSearchQuery] = useState('');
    const [searchMatchIndex, setSearchMatchIndex] = useState(0);

    // Audio Voice Note Recording States
    const [isRecordingVoice, setIsRecordingVoice] = useState(false);
    const [recordingDuration, setRecordingDuration] = useState(0);
    const [activeAudioPlayingId, setActiveAudioPlayingId] = useState(null);
    const [activeAudioProgress, setActiveAudioProgress] = useState({});
    const mediaRecorderRef = useRef(null);
    const audioChunksRef = useRef([]);
    const recordingTimerRef = useRef(null);
    const audioPlayerRefs = useRef({});
    const audioWaveAnimRef = useRef(null);
    const audioWaveCanvasRef = useRef({});
    const activeAudioPlayingIdRef = useRef(null);

    // Voice Chat Real Microphone Stream
    const voiceAudioContextRef = useRef(null);
    const voiceStreamRef = useRef(null);
    const voiceAnalyserRef = useRef(null);
    const [localIsSpeaking, setLocalIsSpeaking] = useState(false);

    // Rich Interactive States
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [attachedImage, setAttachedImage] = useState(null);
    const [showAddModal, setShowAddModal] = useState({ open: false, type: 'group' });
    const [newGroupName, setNewGroupName] = useState('');
    const [newGroupDesc, setNewGroupDesc] = useState('');
    const [typingUser, setTypingUser] = useState(null);
    const [editingMessageId, setEditingMessageId] = useState(null);
    const [toastMessage, setToastMessage] = useState(null);
    const [toastEmoji, setToastEmoji] = useState('🔗');
    const toastTimeoutRef = useRef(null);

    const showToast = useCallback((msg, emoji = '🔗') => {
        if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
        setToastMessage(msg);
        setToastEmoji(emoji);
        toastTimeoutRef.current = setTimeout(() => {
            setToastMessage(null);
        }, 3000);
    }, []);

    const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0, message: null });
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [selectedMessageIds, setSelectedMessageIds] = useState(new Set());

    const enterSelectionMode = useCallback((msgId) => {
        setIsSelectionMode(true);
        setSelectedMessageIds(new Set(msgId ? [msgId] : []));
        setContextMenu({ visible: false, x: 0, y: 0, message: null });
    }, []);

    const exitSelectionMode = useCallback(() => {
        setIsSelectionMode(false);
        setSelectedMessageIds(new Set());
    }, []);

    const toggleMessageSelection = useCallback((msgId) => {
        setSelectedMessageIds(prev => {
            const next = new Set(prev);
            if (next.has(msgId)) next.delete(msgId);
            else next.add(msgId);
            return next;
        });
    }, []);

    const handleDeleteSelected = useCallback(() => {
        selectedMessageIds.forEach(id => handleDeleteMessageRef.current?.(id));
        exitSelectionMode();
    }, [selectedMessageIds, exitSelectionMode]);

    const isImageFile = useCallback((fileName = '', fileIcon = '') => {
        const imgExts = /\.(png|jpe?g|gif|webp|svg|bmp|ico|avif)$/i;
        return imgExts.test(fileName) || fileIcon === '🖼️' || fileIcon === '🎨';
    }, []);
    const [replyingTo, setReplyingTo] = useState(null);
    const [forwardingMessage, setForwardingMessage] = useState(null);
    const [showGroupInfoModal, setShowGroupInfoModal] = useState(false);
    const [isAddingMember, setIsAddingMember] = useState(false);
    const [showAddMemberModal, setShowAddMemberModal] = useState(false);
    const [joinPreviewGroupId, setJoinPreviewGroupId] = useState(null);
    const [joinRequestState, setJoinRequestState] = useState(null);
    const [pendingFiles, setPendingFiles] = useState([]);
    const [showUploadOptionModal, setShowUploadOptionModal] = useState(false);
    const [showCreateTopicModal, setShowCreateTopicModal] = useState(false);
    const [showSendInvitationModal, setShowSendInvitationModal] = useState(false);
    const [showStudyInvitationModal, setShowStudyInvitationModal] = useState(false);
    const [createdTopicName, setCreatedTopicName] = useState('StatefulWidget Lifecycle');
    const [activeTopicId, setActiveTopicId] = useState('general');
    const [selectedGroupIdForTopics, setSelectedGroupIdForTopics] = useState(null);

    const [invitationData, setInvitationData] = useState({
        isOpen: false,
        inviterName: '',
        inviterInitials: '',
        topicName: '',
        categoryName: '',
        groupId: ''
    });

    const [groupMemberRoles, setGroupMemberRoles] = useState({});
    const [isEditingGroupInfo, setIsEditingGroupInfo] = useState(false);
    const [editGroupName, setEditGroupName] = useState('');
    const [editGroupDesc, setEditGroupDesc] = useState('');

    const handleStartEditGroupInfo = () => {
        setEditGroupName(activeItem.name || '');
        setEditGroupDesc(activeItem.description || activeItem.subtitle || '');
        setIsEditingGroupInfo(true);
    };

    const handleSaveGroupInfo = () => {
        if (!editGroupName.trim()) {
            if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
            setToastMessage('Group name cannot be empty');
            toastTimeoutRef.current = setTimeout(() => setToastMessage(null), 3000);
            return;
        }

        apiFetch(`${API_BASE_URL}/chat/groups/${activeId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: editGroupName.trim(),
                description: editGroupDesc.trim()
            })
        })
        .then(res => {
            if (res.ok) {
                setStudyGroups(prev => prev.map(g => (g.id === activeId ? { ...g, name: editGroupName.trim(), description: editGroupDesc.trim(), subtitle: editGroupDesc.trim() } : g)));
                setIsEditingGroupInfo(false);
                if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
                setToastMessage('Group information updated!');
                toastTimeoutRef.current = setTimeout(() => setToastMessage(null), 3000);
            } else {
                return res.json().then(err => { throw new Error(err.message || 'Failed to update group info'); });
            }
        })
        .catch(err => {
            if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
            setToastMessage(err.message || 'Failed to update group');
            toastTimeoutRef.current = setTimeout(() => setToastMessage(null), 3000);
        });
    };

    const handleToggleAdminRole = (memberId, customPermissions) => {
        const currentRole = groupMemberRoles[`${activeId}-${memberId}`] || 'MEMBER';
        const newRole = currentRole === 'ADMIN' ? 'MEMBER' : 'ADMIN';
        
        apiFetch(`${API_BASE_URL}/chat/groups/${activeId}/members/${memberId}/role`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ role: newRole, permissions: customPermissions })
        })
        .then(res => {
            if (res.ok) {
                setGroupMemberRoles(prev => ({
                    ...prev,
                    [`${activeId}-${memberId}`]: newRole
                }));
                const userObj = USER_PROFILES[memberId];
                if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
                setToastMessage(`${userObj?.name || memberId} is now ${newRole === 'ADMIN' ? 'an Admin' : 'a Member'}!`);
                toastTimeoutRef.current = setTimeout(() => setToastMessage(null), 3000);
            } else {
                return res.json().then(err => { throw new Error(err.message || 'Failed to update member role'); });
            }
        })
        .catch(err => {
            if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
            setToastMessage(err.message || 'Failed to update role');
            toastTimeoutRef.current = setTimeout(() => setToastMessage(null), 3000);
        });
    };

    const simSpeakerIntervalRef = useRef(null);

    const startVoiceAudioCapture = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            voiceStreamRef.current = stream;
            const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
            if (AudioCtxClass) {
                const audioCtx = new AudioCtxClass();
                voiceAudioContextRef.current = audioCtx;
                const source = audioCtx.createMediaStreamSource(stream);
                const analyser = audioCtx.createAnalyser();
                analyser.fftSize = 256;
                source.connect(analyser);
                voiceAnalyserRef.current = analyser;

                const dataArray = new Uint8Array(analyser.frequencyBinCount);
                const checkAudioLevel = () => {
                    if (!voiceAnalyserRef.current) return;
                    voiceAnalyserRef.current.getByteFrequencyData(dataArray);
                    let sum = 0;
                    for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
                    const avg = sum / dataArray.length;
                    setLocalIsSpeaking(avg > 16);
                    requestAnimationFrame(checkAudioLevel);
                };
                requestAnimationFrame(checkAudioLevel);
            }
        } catch (err) {
            console.warn('Voice chat mic access:', err);
        }
    };

    const stopVoiceAudioCapture = () => {
        if (voiceStreamRef.current) {
            voiceStreamRef.current.getTracks().forEach(track => track.stop());
            voiceStreamRef.current = null;
        }
        if (voiceAudioContextRef.current) {
            voiceAudioContextRef.current.close().catch(() => {});
            voiceAudioContextRef.current = null;
        }
        voiceAnalyserRef.current = null;
        setLocalIsSpeaking(false);
    };

    const handleToggleVoiceChat = () => {
        if (voiceCallStatus === 'connected') {
            if (activeVoiceChat?.groupId === activeId) {
                handleLeaveVoiceChat();
                return;
            } else {
                stopVoiceAudioCapture();
                if (simSpeakerIntervalRef.current) {
                    clearInterval(simSpeakerIntervalRef.current);
                    simSpeakerIntervalRef.current = null;
                }
                if (socketRef.current && activeVoiceChat) {
                    socketRef.current.emit('leaveVoiceChat', {
                        groupId: activeVoiceChat.groupId,
                        userId: currentUser.id
                    });
                }
                setVoiceCallStatus(null);
                setActiveVoiceChat(null);
                setTimeout(joinNewVoiceCall, 100);
                return;
            }
        }

        joinNewVoiceCall();
    };

    const joinNewVoiceCall = () => {
        setVoiceCallStatus('connecting');
        startVoiceAudioCapture();

        setTimeout(() => {
            setVoiceCallStatus('connected');
            setLocalMuted(false);

            const initialChat = {
                groupId: activeId,
                participants: [
                    { userId: currentUser.id, username: currentUser.name, initials: currentUser.initials, avatarBg: currentUser.avatarBg, muted: false, speaking: false }
                ]
            };
            setActiveVoiceChat(initialChat);

            if (socketRef.current) {
                socketRef.current.emit('joinVoiceChat', {
                    groupId: activeId,
                    userId: currentUser.id,
                    username: currentUser.name,
                    initials: currentUser.initials,
                    avatarBg: currentUser.avatarBg
                });
            }



            // Periodically refresh participant speaking states
            simSpeakerIntervalRef.current = setInterval(() => {
                setActiveVoiceChat(prev => {
                    if (!prev) return null;
                    return {
                        ...prev,
                        participants: prev.participants.map(p => {
                            if (p.userId === currentUser.id) {
                                return { ...p, speaking: !localMutedRef.current && (localIsSpeakingRef.current || Math.random() > 0.7) };
                            }
                            return { ...p, speaking: !p.muted && Math.random() > 0.5 };
                        })
                    };
                });
            }, 800);

        }, 800);
    };

    const handleLeaveVoiceChat = () => {
        stopVoiceAudioCapture();
        if (simSpeakerIntervalRef.current) {
            clearInterval(simSpeakerIntervalRef.current);
            simSpeakerIntervalRef.current = null;
        }

        if (socketRef.current && activeVoiceChat) {
            socketRef.current.emit('leaveVoiceChat', {
                groupId: activeVoiceChat.groupId,
                userId: currentUser.id
            });
        }

        setVoiceCallStatus(null);
        setActiveVoiceChat(null);
    };

    const handleToggleLocalMute = () => {
        const nextMuted = !localMuted;
        setLocalMuted(nextMuted);

        if (voiceStreamRef.current) {
            voiceStreamRef.current.getAudioTracks().forEach(track => {
                track.enabled = !nextMuted;
            });
        }

        if (socketRef.current && activeVoiceChat) {
            socketRef.current.emit('toggleMuteVoice', {
                groupId: activeVoiceChat.groupId,
                userId: currentUser.id,
                muted: nextMuted
            });
        }
    };

    const [activeVoiceChat, setActiveVoiceChat] = useState(null); 
    const activeVoiceChatRef = useRef(null);
    activeVoiceChatRef.current = activeVoiceChat;
    const [localMuted, setLocalMuted] = useState(false);
    const localMutedRef = useRef(localMuted);
    localMutedRef.current = localMuted;
    const localIsSpeakingRef = useRef(localIsSpeaking);
    localIsSpeakingRef.current = localIsSpeaking;
    const [voiceCallStatus, setVoiceCallStatus] = useState(null);

    // Audio Voice Note Recording Handlers
    const handleStartVoiceRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                }
            });

            audioChunksRef.current = [];

            let chosenMimeType = '';
            const preferredTypes = [
                'audio/webm;codecs=opus',
                'audio/webm',
                'audio/mp4;codecs=aac',
                'audio/mp4',
                'audio/ogg;codecs=opus',
                'audio/wav'
            ];
            for (const t of preferredTypes) {
                if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t)) {
                    chosenMimeType = t;
                    break;
                }
            }

            const options = chosenMimeType ? { mimeType: chosenMimeType } : {};
            const mediaRecorder = new MediaRecorder(stream, options);
            mediaRecorderRef.current = mediaRecorder;

            mediaRecorder.ondataavailable = (e) => {
                if (e.data && e.data.size > 0) {
                    audioChunksRef.current.push(e.data);
                }
            };

            mediaRecorder.start(250); // flush 250ms chunks continuously into audioChunksRef
            setIsRecordingVoice(true);
            setRecordingDuration(0);
            recordingTimerRef.current = setInterval(() => {
                setRecordingDuration(prev => prev + 1);
            }, 1000);
        } catch (err) {
            console.error('Failed to start audio recording:', err);
            showToast('Microphone access is required to record voice notes.', '🎙️');
        }
    };

    const handleCancelVoiceRecording = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            try {
                if (mediaRecorderRef.current.stream) {
                    mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
                }
                mediaRecorderRef.current.stop();
            } catch (err) {
                console.warn('Error cancelling recording:', err);
            }
        }
        clearInterval(recordingTimerRef.current);
        setIsRecordingVoice(false);
        setRecordingDuration(0);
        audioChunksRef.current = [];
    };

    const handleSendVoiceRecording = async () => {
        if (!mediaRecorderRef.current || !isRecordingVoice) return;
        const duration = recordingDuration || 1;
        clearInterval(recordingTimerRef.current);
        setIsRecordingVoice(false);
        setRecordingDuration(0);

        const recorder = mediaRecorderRef.current;
        recorder.onstop = async () => {
            if (recorder.stream) {
                recorder.stream.getTracks().forEach(track => track.stop());
            }

            const recordedMimeType = recorder.mimeType || 'audio/webm';
            const audioBlob = new Blob(audioChunksRef.current, { type: recordedMimeType });

            if (audioBlob.size === 0) {
                showToast('Voice note was empty, please try again.', '⚠️');
                return;
            }

            const ext = recordedMimeType.includes('mp4') ? 'mp4' 
                      : recordedMimeType.includes('ogg') ? 'ogg' 
                      : recordedMimeType.includes('wav') ? 'wav' 
                      : 'webm';

            const formData = new FormData();
            formData.append('file', audioBlob, `voice-note-${Date.now()}.${ext}`);

            let audioUrl = '';
            let uploadFailed = false;
            try {
                const res = await apiFetch(`${API_BASE_URL}/chat/upload`, {
                    method: 'POST',
                    body: formData
                });
                const data = await res.json();
                if (data && data.url) {
                    audioUrl = data.url;
                } else {
                    throw new Error('No URL in upload response');
                }
            } catch (err) {
                console.error('Failed to upload voice note:', err);
                uploadFailed = true;
                audioUrl = URL.createObjectURL(audioBlob);
            }

            const isClassroom = classrooms.some(c => c.id === activeId);
            const roomId = isClassroom ? activeId : `${activeId}-${activeTopicId}`;
            const timeString = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const durationLabel = `${Math.floor(duration / 60)}:${(duration % 60).toString().padStart(2, '0')}`;

            const optimisticId = `optimistic-voice-${Date.now()}`;
            const newMsg = {
                id: optimisticId,
                senderId: currentUser.id,
                sender: currentUser.name,
                initials: currentUser.initials,
                avatarClass: currentUser.initials.toLowerCase(),
                time: timeString,
                incoming: false,
                type: 'audio',
                audioUrl: audioUrl,
                text: audioUrl,
                fileName: `Voice message (${durationLabel})`,
                fileSize: formatBytes(audioBlob.size),
                fileIcon: '🎙️',
                duration: duration,
                isPinned: false
            };

            setMessagesByGroup(prev => ({
                ...prev,
                [roomId]: [...(prev[roomId] || []), newMsg]
            }));

            if (socketRef.current && !uploadFailed) {
                socketRef.current.emit('sendMessage', {
                    _optimisticId: optimisticId,
                    roomId,
                    senderId: currentUser.id,
                    text: audioUrl,
                    type: 'audio',
                    fileName: newMsg.fileName,
                    fileSize: newMsg.fileSize,
                    fileIcon: '🎙️',
                    duration: duration
                });
            } else if (uploadFailed) {
                showToast('Voice note stored locally (server offline).', '⚠️');
            }
        };

        try {
            if (recorder.state !== 'inactive') {
                recorder.stop();
            }
        } catch (e) {
            console.error('Error stopping recorder:', e);
        }
    };

    // Toggle Pin Message Handler
    const handleTogglePinMessage = (msg) => {
        if (!msg) return;
        const newPinned = !msg.isPinned;
        apiFetch(`${API_BASE_URL}/chat/messages/${msg.id}/pin`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ isPinned: newPinned })
        })
        .then(res => res.json())
        .then(() => {
            setMessagesByGroup(prev => {
                const isClassroom = classrooms.some(c => c.id === activeId);
                const currentKey = isClassroom ? activeId : `${activeId}-${activeTopicId}`;
                const current = prev[currentKey] || [];
                return {
                    ...prev,
                    [currentKey]: current.map(m => (m.id === msg.id ? { ...m, isPinned: newPinned } : m))
                };
            });
            showToast(newPinned ? 'Message pinned to top!' : 'Message unpinned', '📌');
        })
        .catch(err => console.error('Failed to pin message:', err));
    };

    // Smooth Scroll Jump to Message
    const handleJumpToMessage = (msgId) => {
        const elem = document.getElementById(`msg-bubble-${msgId}`);
        if (elem) {
            elem.scrollIntoView({ behavior: 'smooth', block: 'center' });
            elem.classList.remove('msg-highlight-flash');
            void elem.offsetWidth;
            elem.classList.add('msg-highlight-flash');
            setTimeout(() => elem.classList.remove('msg-highlight-flash'), 2600);
        }
    };

    // Classrooms list (populated strictly from backend data)
    const [classrooms, setClassrooms] = useState([]);

    // Study Groups (populated strictly from backend data)
    const [localStudyGroups, setLocalStudyGroups] = useState([]);
    const studyGroups = propStudyGroups !== undefined ? propStudyGroups : localStudyGroups;
    const setStudyGroups = propSetStudyGroups !== undefined ? propSetStudyGroups : setLocalStudyGroups;

    // Messages log by group/classroom ID
    const [messagesByGroup, setMessagesByGroup] = useState({});

    // Refs
    const socketRef = useRef(null);
    const studyGroupsRef = useRef(studyGroups);
    const handleDeleteMessageRef = useRef(null);
    const prevRoomIdRef = useRef(null);

    // Pick a sensible fallback channel when the active one disappears
    const fallbackGroupId = (excludeId) => {
        const remaining = (studyGroupsRef.current || []).filter(g => g.id !== excludeId);
        return remaining[0]?.id || '';
    };

    // Keep studyGroupsRef in sync with studyGroups
    useEffect(() => {
        studyGroupsRef.current = studyGroups;
    }, [studyGroups]);

    const [topicsByGroup, setTopicsByGroup] = useState({});

    // Initialize socket connection and load groups
    useEffect(() => {
        socketRef.current = io(getSocketUrl(), {
            auth: (cb) => cb({ token: tokenRef.current }),
            transports: ['websocket', 'polling']
        });

        socketRef.current.on('connect_error', (err) => {
            console.warn('Socket connection failed:', err.message);
            showToast('Realtime connection lost. Reconnecting…', '⚠️');
        });

        socketRef.current.on('newMessage', (msg) => {
            // Restore file data for document and grouped types
            let fileDataUrl;
            let groupedFiles;
            if (msg.type === 'document') {
                fileDataUrl = msg.text; // file URL stored in text field
            } else if (msg.type === 'grouped') {
                try { groupedFiles = JSON.parse(msg.text || '[]'); } catch { groupedFiles = []; }
            }

            const mappedMsg = {
                id: msg.id,
                sender: msg.senderId === currentUserRef.current.id ? currentUserRef.current.name : (msg.sender?.name || msg.senderId),
                initials: msg.senderId === currentUserRef.current.id ? currentUserRef.current.initials : (msg.sender?.initials || '??'),
                avatarClass: msg.senderId === currentUserRef.current.id ? currentUserRef.current.initials.toLowerCase() : (msg.sender?.initials?.toLowerCase() || 'at'),
                avatarBg: msg.sender?.avatarBg || '#8b5cf6',
                text: msg.type === 'document' || msg.type === 'grouped' ? undefined : msg.text,
                image: msg.image,
                time: new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                incoming: msg.senderId !== currentUserRef.current.id,
                reactions: (msg.reactionsGrouped || []).map(r => ({
                    emoji: r.emoji,
                    count: r.count,
                    userReacted: (r.userIds || []).includes(currentUserRef.current.id)
                })),
                type: msg.type,
                fileName: msg.fileName,
                fileSize: msg.fileSize,
                fileIcon: msg.fileIcon,
                isPinned: msg.isPinned || false,
                audioUrl: msg.type === 'audio' ? (msg.audioUrl || msg.text) : undefined,
                replyTo: msg.replyTo || undefined,
                forwardedFrom: msg.forwardedFrom || undefined,
                fileDataUrl: fileDataUrl,
                files: groupedFiles
            };

            setMessagesByGroup(prev => {
                const key = msg.roomId || msg.groupId;
                if (!key) return prev;
                const existing = prev[key] || [];
                // If we already have this server-confirmed id, skip
                if (existing.some(m => m.id === msg.id)) return prev;

                // Replace optimistic placeholder using _optimisticId for precision or matching content
                if (msg.senderId === currentUserRef.current.id) {
                    let optimisticIdx = -1;
                    if (msg._optimisticId) {
                        optimisticIdx = existing.findIndex(m => m.id === msg._optimisticId);
                    }
                    if (optimisticIdx === -1) {
                        optimisticIdx = existing.findIndex(m =>
                            m.id && String(m.id).startsWith('optimistic-') &&
                            (
                                (mappedMsg.text && m.text === mappedMsg.text) ||
                                (mappedMsg.audioUrl && (m.audioUrl === mappedMsg.audioUrl || m.text === mappedMsg.audioUrl)) ||
                                (mappedMsg.fileName && m.fileName === mappedMsg.fileName)
                            )
                        );
                    }
                    if (optimisticIdx !== -1) {
                        const updated = [...existing];
                        updated[optimisticIdx] = mappedMsg;
                        return { ...prev, [key]: updated };
                    }
                }
                return {
                    ...prev,
                    [key]: [...existing, mappedMsg]
                };
            });

            const previewText = msg.type === 'audio' ? '🎙️ Voice note' : (msg.text || (msg.image ? '📷 Photo' : 'Attachment'));
            const senderName = msg.senderId === currentUserRef.current.id ? 'You' : (msg.sender?.name || msg.senderId);
            // Find parent group using prefix matching (safe for UUID IDs)
            const parentGroup = studyGroupsRef.current.find(g => msg.groupId === g.id || (msg.groupId || '').startsWith(g.id + '-'));
            if (parentGroup) {
                setStudyGroups(prev =>
                    prev.map(g => (g.id === parentGroup.id ? { ...g, subtitle: `${senderName}: ${previewText}`, time: mappedMsg.time } : g))
                );
            }
        });

        socketRef.current.on('messagePinned', (data) => {
            const { messageId, isPinned } = data;
            setMessagesByGroup(prev => {
                const updatedAll = {};
                Object.keys(prev).forEach(key => {
                    updatedAll[key] = (prev[key] || []).map(m => (m.id === messageId ? { ...m, isPinned } : m));
                });
                return updatedAll;
            });
        });

        socketRef.current.on('messageDeleted', (data) => {
            const { messageId } = data;
            setMessagesByGroup(prev => {
                const updatedAll = {};
                Object.keys(prev).forEach(key => {
                    updatedAll[key] = (prev[key] || []).filter(m => m.id !== messageId);
                });
                return updatedAll;
            });
        });

        socketRef.current.on('messageUpdated', (data) => {
            const { messageId, text } = data;
            setMessagesByGroup(prev => {
                const updatedAll = {};
                Object.keys(prev).forEach(key => {
                    updatedAll[key] = (prev[key] || []).map(m => m.id === messageId ? { ...m, text } : m);
                });
                return updatedAll;
            });
        });

        socketRef.current.on('reactionToggled', (data) => {
            const { messageId, reactions } = data;
            const mappedReactions = (reactions || []).map(r => ({
                emoji: r.emoji,
                count: r.count,
                userReacted: (r.userIds || []).includes(currentUserRef.current.id)
            }));
            setMessagesByGroup(prev => {
                const updatedAll = {};
                Object.keys(prev).forEach(key => {
                    updatedAll[key] = (prev[key] || []).map(m => m.id === messageId ? { ...m, reactions: mappedReactions } : m);
                });
                return updatedAll;
            });
        });

        socketRef.current.on('groupDeleted', (data) => {
            const { groupId } = data;
            const parent = studyGroupsRef.current.find(m => groupId && groupId.startsWith(`${m.id}-`));
            if (parent) {
                const topicId = groupId.substring(parent.id.length + 1);
                setTopicsByGroup(prev => {
                    const existing = prev[parent.id] || [];
                    const filtered = existing.filter(t => t.id !== topicId);
                    return {
                        ...prev,
                        [parent.id]: filtered
                    };
                });
                setActiveTopicId(prev => (prev === topicId ? 'general' : prev));
            } else {
                setStudyGroups(prev => prev.filter(g => g.id !== groupId));
                setActiveId(prev => (prev === groupId ? fallbackGroupId(groupId) : prev));
            }
        });

        socketRef.current.on('groupCreated', (group) => {
            if (!group) return;
            const isTopic = group.isTopic || (group.icon && group.icon.startsWith('topic:')) || (group.id && group.id.includes('-') && !group.id.includes('6666'));
            if (isTopic) {
                const parentId = group.parentGroupId || (group.icon && group.icon.startsWith('topic:') ? group.icon.split(':')[1] : group.id.split('-')[0]);
                const topicId = group.topicId || (group.icon && group.icon.startsWith('topic:') ? group.icon.split(':')[2] : group.id.split('-').slice(1).join('-')) || group.name.toLowerCase().replace(/\s+/g, '-');
                
                setTopicsByGroup(prev => {
                    const existing = prev[parentId] || [
                        { id: 'general', name: 'General', icon: '#', color: '#64748b', subtitle: 'General chat room', time: '' }
                    ];
                    if (existing.some(t => t.id === topicId)) return prev;
                    return {
                        ...prev,
                        [parentId]: [
                            ...existing,
                            { id: topicId, name: group.name, icon: '#', color: group.colorAccent || group.color || '#0d9488', subtitle: group.description || 'Topic created', time: '' }
                        ]
                    };
                });
            } else {
                const isClassroom = group.icon === '🏫';
                if (isClassroom) {
                    setClassrooms(prev => {
                        if (prev.some(c => c.id === group.id)) return prev;
                        return [
                            ...prev,
                            {
                                id: group.id,
                                name: group.name,
                                subtitle: group.description || 'No messages yet',
                                isClassroom: true,
                                time: '',
                                icon: group.icon || '🏫',
                                color: group.color || '#10b981',
                                members: group.members?.map(m => m.userId) || []
                            }
                        ];
                    });
                } else {
                    setStudyGroups(prev => {
                        if (prev.some(g => g.id === group.id)) return prev;
                        return [
                            ...prev,
                            {
                                id: group.id,
                                name: group.name,
                                subtitle: group.description || 'No messages yet',
                                isClassroom: false,
                                time: '',
                                icon: group.icon || '👥',
                                color: group.color || '#8b5cf6',
                                members: group.members?.map(m => m.userId) || []
                            }
                        ];
                    });
                    setTopicsByGroup(prev => {
                        if (prev[group.id]) return prev;
                        return {
                            ...prev,
                            [group.id]: [
                                { id: 'general', name: 'General', icon: '#', color: '#64748b', subtitle: 'General chat room', time: '' }
                            ]
                        };
                    });
                }
            }
        });

        socketRef.current.on('memberRemoved', (data) => {
            const { groupId, userId } = data;
            if (userId === currentUserRef.current.id) {
                setActiveId(prev => (prev === groupId ? fallbackGroupId(groupId) : prev));
                setStudyGroups(prev => prev.filter(g => g.id !== groupId));
                if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
                setToastMessage(`You were removed from the group.`);
                toastTimeoutRef.current = setTimeout(() => setToastMessage(null), 4000);
            } else {
                setStudyGroups(prev =>
                    prev.map(g => {
                        if (g.id === groupId) {
                            return {
                                ...g,
                                members: (g.members || []).filter(m => m !== userId)
                            };
                        }
                        return g;
                    })
                );
            }
        });

        socketRef.current.on('studyInvitation', (data) => {
            if (data.invitedMembers?.includes(currentUserRef.current.id) && data.inviterId !== currentUserRef.current.id) {
                setInvitationData({
                    isOpen: true,
                    inviterName: data.inviterName,
                    inviterInitials: data.inviterInitials,
                    topicName: data.topicName,
                    categoryName: data.categoryName,
                    groupId: data.groupId
                });
            }
        });

        socketRef.current.on('roleUpdated', (data) => {
            const { groupId, userId, role } = data;
            setGroupMemberRoles(prev => ({
                ...prev,
                [`${groupId}-${userId}`]: role
            }));
        });

        socketRef.current.on('topicCreated', (data) => {
            const { groupId, topic } = data || {};
            if (!groupId || !topic) return;
            const tId = topic.slug || topic.id;
            setTopicsByGroup(prev => {
                const existing = prev[groupId] || [
                    { id: 'general', name: 'General', icon: '#', color: '#64748b', subtitle: 'General chat room', time: '' }
                ];
                if (existing.some(t => t.id === tId)) return prev;
                return {
                    ...prev,
                    [groupId]: [
                        ...existing,
                        {
                            id: tId,
                            name: topic.name,
                            icon: topic.icon || '#',
                            color: topic.color || '#0d9488',
                            subtitle: `Topic: ${topic.name}`,
                            time: ''
                        }
                    ]
                };
            });
        });

        socketRef.current.on('topicDeleted', (data) => {
            const { groupId, topicId } = data || {};
            if (!groupId || !topicId) return;
            setTopicsByGroup(prev => {
                const existing = prev[groupId] || [];
                return {
                    ...prev,
                    [groupId]: existing.filter(t => t.id !== topicId && t.slug !== topicId)
                };
            });
            setActiveTopicId(prev => (prev === topicId ? 'general' : prev));
        });

        socketRef.current.on('groupUpdated', (data) => {
            const { groupId, name, description, icon, color } = data || {};
            if (!groupId) return;
            setStudyGroups(prev =>
                prev.map(g => (g.id === groupId ? { ...g, name: name || g.name, description: description !== undefined ? description : g.description, icon: icon || g.icon, color: color || g.color } : g))
            );
        });

        socketRef.current.on('membersAdded', (data) => {
            const { groupId, members } = data || {};
            if (!groupId || !Array.isArray(members)) return;
            setStudyGroups(prev =>
                prev.map(g => (g.id === groupId ? { ...g, members: members.map(m => m.userId || m) } : g))
            );
        });

        socketRef.current.on('voiceChatUserJoined', (data) => {
            const { groupId, userId, username, initials, avatarBg } = data;
            setActiveVoiceChat(prev => {
                const currentParticipants = prev?.groupId === groupId ? prev.participants : [];
                if (currentParticipants.some(p => p.userId === userId)) return prev;
                return {
                    groupId,
                    participants: [
                        ...currentParticipants,
                        { userId, username, initials, avatarBg, muted: false, speaking: false }
                    ]
                };
            });
        });

        socketRef.current.on('voiceChatUserLeft', (data) => {
            const { groupId, userId } = data;
            setActiveVoiceChat(prev => {
                if (!prev || prev.groupId !== groupId) return prev;
                const updatedParticipants = prev.participants.filter(p => p.userId !== userId);
                if (updatedParticipants.length === 0) return null;
                return {
                    ...prev,
                    participants: updatedParticipants
                };
            });
        });

        socketRef.current.on('voiceChatUserMuteToggled', (data) => {
            const { groupId, userId, muted } = data;
            setActiveVoiceChat(prev => {
                if (!prev || prev.groupId !== groupId) return prev;
                return {
                    ...prev,
                    participants: prev.participants.map(p =>
                        p.userId === userId ? { ...p, muted } : p
                    )
                };
            });
        });

        // Fetch persisted study groups
        apiFetch(`${API_BASE_URL}/chat/groups${classroomId ? `?classroomId=${encodeURIComponent(classroomId)}` : ''}`)
            .then(res => res.json())
            .then(data => {
                if (data && Array.isArray(data)) {
                    const mainGroups = data.filter(g => {
                        const isTopic = g.isTopic || (g.icon && g.icon.startsWith('topic:')) || (g.id && g.id.includes('-') && !g.id.includes('6666') && data.some(other => other.id !== g.id && g.id.startsWith(`${other.id}-`)));
                        if (isTopic) return false;
                        const isClassroom = g.icon === '🏫' || g.id === 'flutter' || g.id.startsWith('class-');
                        if (isClassroom) return true;
                        // Teachers are strictly restricted from seeing student peer study groups
                        const isTeacherUser = (currentUserRef.current?.role || '').toLowerCase() === 'teacher';
                        if (isTeacherUser) return false;
                        const curId = currentUserRef.current?.id || effectiveUserId;
                        const memberIds = (g.members || []).map(m => (typeof m === 'object' ? (m.userId || m.id) : m));
                        return memberIds.includes(curId) || g.ownerId === curId || g.createdById === curId;
                    });

                    const loadedClassrooms = [];
                    const mappedGroups = [];
                    const tempTopicsByGroup = {};

                    mainGroups.forEach(g => {
                        const isClassroom = g.icon === '🏫' || g.id === 'flutter' || g.id.startsWith('class-');
                        const item = {
                            id: g.id,
                            name: g.name,
                            description: g.description || '',
                            subtitle: g.description || 'No messages yet',
                            isClassroom: isClassroom,
                            time: '',
                            icon: isClassroom ? '🏫' : (g.icon || '📚'),
                            color: g.color || g.colorAccent || '#8b5cf6',
                            ownerId: g.ownerId || g.createdById,
                            myRole: g.myRole || 'MEMBER',
                            myPermissions: g.myPermissions || {},
                            members: g.members?.map(m => (typeof m === 'object' ? m.userId : m)) || []
                        };
                        if (isClassroom) {
                            loadedClassrooms.push(item);
                        } else {
                            mappedGroups.push(item);
                        }

                        // Attach topics for this group
                        const rawTopics = Array.isArray(g.topics) && g.topics.length > 0
                            ? g.topics
                            : [{ id: 'general', name: 'General', icon: '#', color: '#64748b', subtitle: 'General chat room', time: '' }];

                        tempTopicsByGroup[g.id] = rawTopics;
                    });

                    setClassrooms(loadedClassrooms);
                    setStudyGroups(mappedGroups);
                    setTopicsByGroup(tempTopicsByGroup);
                    
                    const rolesMap = {};
                    data.forEach(g => {
                        if (g.ownerId) {
                            rolesMap[`${g.id}-${g.ownerId}`] = 'OWNER';
                        }
                        if (g.createdById) {
                            rolesMap[`${g.id}-${g.createdById}`] = 'OWNER';
                        }
                        g.members?.forEach(m => {
                            const uId = typeof m === 'object' ? m.userId : m;
                            const role = (typeof m === 'object' && m.role) ? m.role : 'MEMBER';
                            rolesMap[`${g.id}-${uId}`] = role;
                        });
                    });
                    setGroupMemberRoles(prev => ({ ...prev, ...rolesMap }));
                }
            })
            .catch(err => console.error('Failed to load study groups:', err));

        return () => {
            if (socketRef.current) socketRef.current.disconnect();
            if (simSpeakerIntervalRef.current) clearInterval(simSpeakerIntervalRef.current);
            stopAudioWaveAnim();
        };
    }, []);

    // Consume a pending /join/:id invite once the target group is loaded
    useEffect(() => {
        const pending = sessionStorage.getItem('pending_join_id');
        if (!pending) return;
        const target =
            studyGroups.find(g => g.id === pending) ||
            classrooms.find(c => c.id === pending);
        if (target) {
            setJoinPreviewGroupId(pending);
            sessionStorage.removeItem('pending_join_id');
        }
    }, [studyGroups, classrooms]);

    // Announce voice-chat departure on page close (server also cleans up on socket disconnect)
    useEffect(() => {
        const handleBeforeUnload = () => {
            const vc = activeVoiceChatRef.current;
            if (socketRef.current && vc?.groupId) {
                socketRef.current.emit('leaveVoiceChat', { groupId: vc.groupId });
            }
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, []);

    // Room connection and chat history loading hook
    useEffect(() => {
        if (!activeId || !socketRef.current) return;

        const isClassroom = classrooms.some(c => c.id === activeId);
        const roomId = isClassroom ? activeId : `${activeId}-${activeTopicId}`;

        if (prevRoomIdRef.current && prevRoomIdRef.current !== roomId) {
            socketRef.current.emit('leaveRoom', { roomId: prevRoomIdRef.current });
        }
        prevRoomIdRef.current = roomId;

        socketRef.current.emit('joinRoom', {
            roomId: roomId,
            userId: currentUserRef.current.id,
            username: currentUserRef.current.name,
            initials: currentUserRef.current.initials,
            avatarBg: currentUserRef.current.avatarBg
        });

        apiFetch(`${API_BASE_URL}/chat/history/${roomId}`)
            .then(res => res.json())
            .then(data => {
                if (data && Array.isArray(data)) {
                    const mappedMessages = data.map(msg => {
                        let fileDataUrl;
                        let groupedFiles;
                        if (msg.type === 'document') {
                            fileDataUrl = msg.text;
                        } else if (msg.type === 'grouped') {
                            try { groupedFiles = JSON.parse(msg.text || '[]'); } catch { groupedFiles = []; }
                        }
                        return ({
                            id: msg.id,
                            sender: msg.senderId === currentUserRef.current.id ? currentUserRef.current.name : (msg.sender?.name || msg.senderId),
                            initials: msg.senderId === currentUserRef.current.id ? currentUserRef.current.initials : (msg.sender?.initials || '??'),
                            avatarClass: msg.senderId === currentUserRef.current.id ? currentUserRef.current.initials.toLowerCase() : (msg.sender?.initials?.toLowerCase() || 'at'),
                            avatarBg: msg.sender?.avatarBg || '#8b5cf6',
                            text: msg.type === 'document' || msg.type === 'grouped' ? undefined : msg.text,
                            image: msg.image,
                            time: new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                            incoming: msg.senderId !== currentUserRef.current.id,
                            reactions: (msg.reactionsGrouped || []).map(r => ({
                                emoji: r.emoji,
                                count: r.count,
                                userReacted: (r.userIds || []).includes(currentUserRef.current.id)
                            })),
                            type: msg.type,
                            fileName: msg.fileName,
                            fileSize: msg.fileSize,
                            fileIcon: msg.fileIcon,
                            isPinned: msg.isPinned || false,
                            audioUrl: msg.type === 'audio' ? (msg.audioUrl || msg.text) : undefined,
                            replyTo: msg.replyTo || undefined,
                            forwardedFrom: msg.forwardedFrom || undefined,
                            fileDataUrl,
                            files: groupedFiles
                        });
                    });
                    
                    setMessagesByGroup(prev => {
                        const current = prev[roomId] || [];
                        const pendingOptimistic = current.filter(m => m.id && String(m.id).startsWith('optimistic-'));
                        const remainingOptimistic = pendingOptimistic.filter(opt =>
                            !mappedMessages.some(serverMsg =>
                                (serverMsg.text && opt.text && serverMsg.text === opt.text) ||
                                (serverMsg.audioUrl && opt.audioUrl && serverMsg.audioUrl === opt.audioUrl)
                            )
                        );
                        return {
                            ...prev,
                            [roomId]: [...mappedMessages, ...remainingOptimistic]
                        };
                    });
                }
            })
            .catch(err => console.error('Failed to load chat history:', err));
    }, [activeId, activeTopicId, classrooms]);

    // Refs
    const conversationPaneRef = useRef(null);
    const fileInputRef = useRef(null);
    const prevActiveIdRef = useRef(activeId);

    // Drag-to-select refs
    const dragStartRef = useRef(null);        // { x, y } in pane-local coords
    const dragRectRef  = useRef(null);        // live { x, y, w, h } state
    const [dragRect, setDragRect] = useState(null); // triggers re-render for the overlay

    // Drag-to-select effect — attaches window-level listeners while pane is mounted
    useEffect(() => {
        const pane = conversationPaneRef.current;
        if (!pane) return;

        const onMouseDown = (e) => {
            // Only left-button drag on the pane background (not on a bubble/button)
            if (e.button !== 0) return;
            const tag = e.target.tagName.toLowerCase();
            if (['button', 'a', 'input', 'textarea', 'canvas'].includes(tag)) return;
            if (e.target.closest('.message-bubble, .audio-player-bubble, .document-attachment-card, .grouped-attachments-grid, .message-reaction-bar, .reactions-list')) return;

            const paneRect = pane.getBoundingClientRect();
            const startX = e.clientX - paneRect.left;
            const startY = e.clientY - paneRect.top + pane.scrollTop;
            dragStartRef.current = { x: startX, y: startY, clientX: e.clientX, clientY: e.clientY };
            dragRectRef.current = null;
        };

        const onMouseMove = (e) => {
            if (!dragStartRef.current) return;
            const start = dragStartRef.current;

            // Only start drawing rect after moving 6px to avoid accidental drags
            const dx = e.clientX - start.clientX;
            const dy = e.clientY - start.clientY;
            if (!dragRectRef.current && Math.sqrt(dx * dx + dy * dy) < 6) return;

            const paneRect = pane.getBoundingClientRect();
            const curX = e.clientX - paneRect.left;
            const curY = e.clientY - paneRect.top + pane.scrollTop;

            const rx = Math.min(start.x, curX);
            const ry = Math.min(start.y, curY);
            const rw = Math.abs(curX - start.x);
            const rh = Math.abs(curY - start.y);

            dragRectRef.current = { rx, ry, rw, rh };
            setDragRect({ rx, ry, rw, rh });

            // Hit-test each message row
            const rows = pane.querySelectorAll('.message-row');
            const newSelected = new Set();
            rows.forEach(row => {
                const rowRect = row.getBoundingClientRect();
                const rowTop    = rowRect.top    - paneRect.top + pane.scrollTop;
                const rowBottom = rowRect.bottom - paneRect.top + pane.scrollTop;
                const rowLeft   = rowRect.left   - paneRect.left;
                const rowRight  = rowRect.right  - paneRect.left;

                const overlaps =
                    rowRight  > rx       &&
                    rowLeft   < rx + rw  &&
                    rowBottom > ry       &&
                    rowTop    < ry + rh;

                if (overlaps) {
                    const msgId = row.dataset.msgid;
                    if (msgId) newSelected.add(msgId);
                }
            });

            if (newSelected.size > 0) {
                setIsSelectionMode(true);
                setSelectedMessageIds(newSelected);
            }

            e.preventDefault();
        };

        const onMouseUp = () => {
            dragStartRef.current = null;
            dragRectRef.current  = null;
            setDragRect(null);
        };

        pane.addEventListener('mousedown', onMouseDown);
        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);

        return () => {
            pane.removeEventListener('mousedown', onMouseDown);
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
        };
    }, []);

    // Active item and active messages key helpers
    const activeItem =
        studyGroups.find(g => g.id === activeId) ||
        classrooms.find(c => c.id === activeId) ||
        { id: activeId || '', name: 'Study Group', subtitle: '', icon: '📚', color: '#6366f1', isClassroom: false, members: [] };

    const activeMessagesKey = activeItem.isClassroom ? activeId : `${activeId}-${activeTopicId}`;
    const activeMessages = useMemo(() => {
        const rawList = messagesByGroup[activeMessagesKey] || [];
        const seenIds = new Set();
        const deduped = [];
        for (const m of rawList) {
            if (!m || !m.id) continue;
            if (seenIds.has(m.id)) continue;
            seenIds.add(m.id);
            deduped.push(m);
        }
        return deduped;
    }, [messagesByGroup, activeMessagesKey]);

    const pinnedMessage = activeMessages.find(m => m.isPinned);

    const matchedMessageIds = inChatSearchQuery.trim()
        ? activeMessages.filter(m => (m.text || '').toLowerCase().includes(inChatSearchQuery.toLowerCase())).map(m => m.id)
        : [];

    const handleNextSearchMatch = () => {
        if (matchedMessageIds.length === 0) return;
        const nextIdx = (searchMatchIndex + 1) % matchedMessageIds.length;
        setSearchMatchIndex(nextIdx);
        handleJumpToMessage(matchedMessageIds[nextIdx]);
    };

    const handlePrevSearchMatch = () => {
        if (matchedMessageIds.length === 0) return;
        const prevIdx = (searchMatchIndex - 1 + matchedMessageIds.length) % matchedMessageIds.length;
        setSearchMatchIndex(prevIdx);
        handleJumpToMessage(matchedMessageIds[prevIdx]);
    };

    // Scroll to bottom when active chat changes or a new message is appended
    useEffect(() => {
        if (conversationPaneRef.current) {
            const isChannelSwitch = prevActiveIdRef.current !== activeId;
            conversationPaneRef.current.scrollTo({
                top: conversationPaneRef.current.scrollHeight,
                behavior: isChannelSwitch ? 'auto' : 'smooth'
            });
        }
        prevActiveIdRef.current = activeId;
    }, [activeId, activeTopicId, (messagesByGroup[`${activeId}-${activeTopicId}`] || messagesByGroup[activeId] || []).length]);

    // Typing indicator simulation when active group changes
    useEffect(() => {
        if (authUser) return undefined;
        setTypingUser(null);
        if (activeId === 'widget-kings') {
            const timer = setTimeout(() => {
                setTypingUser('Yonas Bekele');
            }, 1000);
            const clearTimer = setTimeout(() => {
                setTypingUser(null);
            }, 3500);
            return () => {
                clearTimeout(timer);
                clearTimeout(clearTimer);
            };
        } else if (activeId === 'flutter') {
            const timer = setTimeout(() => {
                setTypingUser('Samuel');
            }, 800);
            const clearTimer = setTimeout(() => {
                setTypingUser(null);
            }, 3300);
            return () => {
                clearTimeout(timer);
                clearTimeout(clearTimer);
            };
        }
    }, [activeId, authUser]);

    // Close custom context menu on outside click
    useEffect(() => {
        const handleOutsideClick = () => {
            if (contextMenu.visible) {
                setContextMenu(prev => ({ ...prev, visible: false }));
            }
        };
        window.addEventListener('click', handleOutsideClick);
        return () => window.removeEventListener('click', handleOutsideClick);
    }, [contextMenu.visible]);

    // Handle group creation launch triggered externally
    useEffect(() => {
        if (showCreateGroupDirectly) {
            setShowAddModal({ open: true, type: 'group' });
        }
    }, [showCreateGroupDirectly]);

    // Helper to format bytes
    const formatBytes = (bytes, decimals = 1) => {
        if (!bytes) return '0 Bytes';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    };

    // Helper to extract audio duration from file name
    const getAudioDurationFromFileName = (fileName) => {
        if (!fileName) return 0;
        const match = fileName.match(/\((\d+):(\d+)\)/);
        if (match) {
            const minutes = parseInt(match[1], 10);
            const seconds = parseInt(match[2], 10);
            return minutes * 60 + seconds;
        }
        return 0;
    };

    // --- Voice note waveform (frequency bars) ---
    const getAudioWaveSeed = (msgId) => {
        let h = 0;
        const idStr = String(msgId || 'default');
        for (let i = 0; i < idStr.length; i++) h = (h * 31 + idStr.charCodeAt(i)) >>> 0;
        return (h / 4294967295) * Math.PI * 2;
    };

    const drawAudioWave = (canvas, isPlaying, msgId, incoming, progress = 0) => {
        if (!canvas) return;
        const ctx2d = canvas.getContext('2d');
        if (!ctx2d) return;
        const W = canvas.width;
        const H = canvas.height;
        ctx2d.clearRect(0, 0, W, H);
        const barCount = 30;
        const barGap = 2;
        const barW = (W - barGap * (barCount - 1)) / barCount;
        const seed = getAudioWaveSeed(msgId);

        for (let i = 0; i < barCount; i++) {
            const barRatio = i / barCount;
            const isPlayed = barRatio <= progress;

            let v = 0.25 + 0.3 * Math.sin(i * 0.75 + seed) + 0.15 * Math.sin(i * 1.8 + seed * 2);
            if (isPlaying) {
                const waveShift = (Date.now() / 120) + (i * 0.45);
                v = 0.2 + 0.55 * Math.abs(Math.sin(waveShift));
            }
            v = Math.max(0.18, Math.min(0.92, v));
            const h = Math.max(4, v * (H - 8));
            const x = i * (barW + barGap);
            const y = (H - h) / 2;
            const r = Math.min(barW / 2, 2);

            ctx2d.fillStyle = isPlayed
                ? (incoming ? '#4f46e5' : '#ffffff')
                : (incoming ? 'rgba(99,102,241,0.35)' : 'rgba(255,255,255,0.45)');

            ctx2d.beginPath();
            if (ctx2d.roundRect) {
                ctx2d.roundRect(x, y, barW, h, r);
            } else {
                ctx2d.rect(x, y, barW, h);
            }
            ctx2d.fill();
        }
    };

    const stopAudioWaveAnim = () => {
        if (audioWaveAnimRef.current) {
            cancelAnimationFrame(audioWaveAnimRef.current);
            audioWaveAnimRef.current = null;
        }
    };

    const startAudioWaveAnim = (msgId, incoming) => {
        stopAudioWaveAnim();
        const animate = () => {
            if (activeAudioPlayingIdRef.current !== msgId) return;
            const canvas = audioWaveCanvasRef.current[msgId];
            const el = audioPlayerRefs.current[msgId];
            if (canvas && el) {
                let dur = el.duration;
                if (!dur || dur === Infinity || isNaN(dur)) {
                    dur = 0;
                }
                const progress = dur > 0 ? el.currentTime / dur : 0;
                drawAudioWave(canvas, true, msgId, incoming, progress);
            }
            audioWaveAnimRef.current = requestAnimationFrame(animate);
        };
        audioWaveAnimRef.current = requestAnimationFrame(animate);
    };

    const handlePlayAudioMessage = async (msg) => {
        const audioSrc = msg.audioUrl || msg.text;
        if (!audioSrc) {
            showToast("Audio source not available", "⚠️");
            return;
        }

        const el = audioPlayerRefs.current[msg.id];
        if (!el) {
            console.warn("Audio element ref not found for", msg.id);
            return;
        }

        if (activeAudioPlayingId === msg.id) {
            el.pause();
            setActiveAudioPlayingId(null);
            activeAudioPlayingIdRef.current = null;
            stopAudioWaveAnim();
            const canvas = audioWaveCanvasRef.current[msg.id];
            if (canvas) {
                let dur = el.duration;
                if (!dur || dur === Infinity || isNaN(dur)) {
                    dur = getAudioDurationFromFileName(msg.fileName) || msg.duration || 1;
                }
                drawAudioWave(canvas, false, msg.id, msg.incoming, el.currentTime / dur);
            }
            return;
        }

        // Pause all other audio players
        Object.keys(audioPlayerRefs.current).forEach(id => {
            const otherEl = audioPlayerRefs.current[id];
            if (otherEl && id !== msg.id) {
                otherEl.pause();
                const otherCanvas = audioWaveCanvasRef.current[id];
                if (otherCanvas) {
                    let otherDur = otherEl.duration;
                    if (!otherDur || otherDur === Infinity || isNaN(otherDur)) otherDur = 1;
                    drawAudioWave(otherCanvas, false, id, false, otherEl.currentTime / otherDur);
                }
            }
        });

        try {
            if (!el.src || el.src === window.location.href) {
                el.src = audioSrc;
                el.load();
            }
            await el.play();
            setActiveAudioPlayingId(msg.id);
            activeAudioPlayingIdRef.current = msg.id;
            startAudioWaveAnim(msg.id, msg.incoming);
        } catch (err) {
            console.error("Audio playback error:", err);
            showToast("Audio playback failed", "⚠️");
            setActiveAudioPlayingId(null);
            activeAudioPlayingIdRef.current = null;
            stopAudioWaveAnim();
        }
    };

    const handlePauseAudioMessage = (msg) => {
        const el = audioPlayerRefs.current[msg.id];
        if (el) el.pause();
        setActiveAudioPlayingId(null);
        activeAudioPlayingIdRef.current = null;
        stopAudioWaveAnim();
    };

    const handleAudioEnded = () => {
        setActiveAudioPlayingId(null);
        activeAudioPlayingIdRef.current = null;
        stopAudioWaveAnim();
    };

    // Helper to format audio playback time
    const formatAudioTime = (seconds) => {
        if (isNaN(seconds) || seconds === Infinity) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    // Helper to get file icon
    const getFileIcon = (filename) => {
        const ext = filename.split('.').pop().toLowerCase();
        if (['pdf'].includes(ext)) return '📕';
        if (['zip', 'rar', 'tar', 'gz', '7z'].includes(ext)) return '📦';
        if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'].includes(ext)) return '🖼️';
        if (['mp3', 'wav', 'ogg'].includes(ext)) return '🎵';
        if (['mp4', 'mov', 'avi', 'mkv'].includes(ext)) return '🎥';
        if (['doc', 'docx', 'txt', 'rtf'].includes(ext)) return '📄';
        return '📁';
    };

    // Handle multiple file input selection
    const handleFileChange = (e) => {
        const selected = Array.from(e.target.files);
        if (selected.length > 0) {
            setPendingFiles(selected);
            setShowUploadOptionModal(true);
        }
        e.target.value = ''; // Reset to allow re-uploading same files
    };

    const triggerFileSelect = () => {
        fileInputRef.current?.click();
    };

    // Handle sending the files based on selected Telegram mode
    const handleSendPendingFiles = async (sendMode) => {
        const timeString = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const roomId = activeItem.isClassroom ? activeId : `${activeId}-${activeTopicId}`;

        if (sendMode === 'grouped') {
            const promises = pendingFiles.map(async (file) => {
                const isImage = file.type.startsWith('image/');
                const formData = new FormData();
                formData.append('file', file);
                let fileUrl = null;
                try {
                    const res = await apiFetch(`${API_BASE_URL}/chat/upload`, {
                        method: 'POST',
                        body: formData
                    });
                    const data = await res.json();
                    fileUrl = data.url;
                } catch (err) {
                    console.warn('Fallback local file read:', err);
                }

                if (!fileUrl && isImage) {
                    fileUrl = await new Promise(resolve => {
                        const reader = new FileReader();
                        reader.onload = (e) => resolve(e.target.result);
                        reader.readAsDataURL(file);
                    });
                }

                return {
                    name: file.name,
                    size: formatBytes(file.size),
                    icon: getFileIcon(file.name),
                    data: fileUrl,
                    isImage: isImage
                };
            });

            const groupedItems = await Promise.all(promises);
            const newMessage = {
                id: `msg-group-${Date.now()}`,
                sender: currentUser.name,
                initials: currentUser.initials,
                avatarClass: currentUser.initials.toLowerCase(),
                type: 'grouped',
                files: groupedItems,
                time: timeString,
                incoming: false,
                reactions: [],
                isPinned: false
            };

            setMessagesByGroup(prev => ({
                ...prev,
                [activeMessagesKey]: [...(prev[activeMessagesKey] || []), newMessage]
            }));

            const previewText = `sent ${pendingFiles.length} grouped files`;
            if (studyGroups.some(g => g.id === activeId)) {
                setStudyGroups(prev =>
                    prev.map(g => (g.id === activeId ? { ...g, subtitle: `You: ${previewText}`, time: timeString } : g))
                );
            }

            if (socketRef.current) {
                socketRef.current.emit('sendMessage', {
                    roomId,
                    senderId: currentUser.id,
                    text: JSON.stringify(groupedItems),
                    type: 'grouped',
                    fileName: `${pendingFiles.length} files`,
                    _optimisticId: newMessage.id
                });
            }

        } else {
            for (let index = 0; index < pendingFiles.length; index++) {
                const file = pendingFiles[index];
                const isImage = file.type.startsWith('image/');
                const formData = new FormData();
                formData.append('file', file);

                let serverUrl = null;
                try {
                    const res = await apiFetch(`${API_BASE_URL}/chat/upload`, {
                        method: 'POST',
                        body: formData
                    });
                    const data = await res.json();
                    serverUrl = data.url;
                } catch (err) {
                    console.warn('Fallback file upload:', err);
                }

                if (!serverUrl && isImage) {
                    serverUrl = await new Promise(resolve => {
                        const reader = new FileReader();
                        reader.onload = (e) => resolve(e.target.result);
                        reader.readAsDataURL(file);
                    });
                }

                const newMessage = {
                    id: `optimistic-file-${Date.now()}-${index}`,
                    sender: currentUser.name,
                    initials: currentUser.initials,
                    avatarClass: currentUser.initials.toLowerCase(),
                    time: timeString,
                    incoming: false,
                    reactions: [],
                    isPinned: false
                };

                if (isImage && sendMode === 'compressed') {
                    newMessage.image = serverUrl;
                    newMessage.text = '';
                } else {
                    newMessage.type = 'document';
                    newMessage.fileName = file.name;
                    newMessage.fileSize = formatBytes(file.size);
                    newMessage.fileIcon = getFileIcon(file.name);
                    newMessage.fileDataUrl = serverUrl;
                }

                setMessagesByGroup(prev => ({
                    ...prev,
                    [activeMessagesKey]: [...(prev[activeMessagesKey] || []), newMessage]
                }));

                const previewText = newMessage.image ? '📷 Image attachment' : `📄 ${file.name}`;
                if (studyGroups.some(g => g.id === activeId)) {
                    setStudyGroups(prev =>
                        prev.map(g => (g.id === activeId ? { ...g, subtitle: `You: ${previewText}`, time: timeString } : g))
                    );
                }

                if (socketRef.current) {
                    socketRef.current.emit('sendMessage', {
                        roomId,
                        senderId: currentUser.id,
                        text: newMessage.type === 'document' ? (newMessage.fileDataUrl || '') : (newMessage.text || ''),
                        image: newMessage.image || undefined,
                        type: newMessage.type || 'text',
                        fileName: newMessage.fileName,
                        fileSize: newMessage.fileSize,
                        fileIcon: newMessage.fileIcon,
                        _optimisticId: newMessage.id
                    });
                }
            }
        }

        setShowUploadOptionModal(false);
        setPendingFiles([]);
    };

    // Handle sending or updating a message
    const handleSendMessage = () => {
        if (!inputValue.trim() && !attachedImage) return;

        const timeString = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        if (editingMessageId) {
            // Edit existing message in-place
            setMessagesByGroup(prev => {
                const activeMessages = prev[activeMessagesKey] || [];
                const updatedMessages = activeMessages.map(msg => {
                    if (msg.id === editingMessageId) {
                        return {
                            ...msg,
                            text: inputValue,
                            image: attachedImage ? attachedImage : msg.image
                        };
                    }
                    return msg;
                });
                return {
                    ...prev,
                    [activeMessagesKey]: updatedMessages
                };
            });

            // Update preview text in the sidebar
            const previewText = attachedImage ? '📷 Image attachment' : inputValue;
            if (studyGroups.some(g => g.id === activeId)) {
                setStudyGroups(prev =>
                    prev.map(g => (g.id === activeId ? { ...g, subtitle: `You (edited): ${previewText}`, time: timeString } : g))
                );
                if (!activeItem.isClassroom) {
                    setTopicsByGroup(prev => {
                        const groupTopics = prev[activeId] || [];
                        const updated = groupTopics.map(t => (t.id === activeTopicId ? { ...t, subtitle: `You (edited): ${previewText}`, time: timeString } : t));
                        return { ...prev, [activeId]: updated };
                    });
                }
            } else if (classrooms.some(c => c.id === activeId)) {
                setClassrooms(prev =>
                    prev.map(c => (c.id === activeId ? { ...c, subtitle: `You (edited): ${previewText}`, time: timeString } : c))
                );
            }

            // Call backend API to persist edit and broadcast
            const roomId = activeItem.isClassroom ? activeId : `${activeId}-${activeTopicId}`;
            apiFetch(`${API_BASE_URL}/chat/messages/${editingMessageId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: inputValue, roomId })
            })
            .catch(err => console.error('Failed to edit message:', err));

            setEditingMessageId(null);
        } else {
            // Send new message via Socket.io gateway
            // Use topic-scoped roomId so messages land in the right channel bucket
            const roomId = activeItem.isClassroom ? activeId : `${activeId}-${activeTopicId}`;
            const optimisticId = `optimistic-${Date.now()}`;

            // Optimistically add message locally so it appears immediately
            const optimisticMsg = {
                id: optimisticId,
                sender: currentUser.name,
                initials: currentUser.initials,
                avatarClass: currentUser.initials.toLowerCase(),
                avatarBg: currentUser.avatarBg,
                text: inputValue,
                image: attachedImage || undefined,
                time: timeString,
                incoming: false,
                reactions: [],
                isPinned: false,
                replyTo: replyingTo ? { id: replyingTo.id, sender: replyingTo.sender, text: replyingTo.text } : undefined
            };

            setMessagesByGroup(prev => ({
                ...prev,
                [roomId]: [...(prev[roomId] || []), optimisticMsg]
            }));

            // Update sidebar preview immediately
            const previewText = attachedImage ? '📷 Image attachment' : inputValue;
            if (studyGroups.some(g => g.id === activeId)) {
                setStudyGroups(prev =>
                    prev.map(g => (g.id === activeId ? { ...g, subtitle: `You: ${previewText}`, time: timeString } : g))
                );
            } else if (classrooms.some(c => c.id === activeId)) {
                setClassrooms(prev =>
                    prev.map(c => (c.id === activeId ? { ...c, subtitle: `You: ${previewText}`, time: timeString } : c))
                );
            }

            if (socketRef.current) {
                socketRef.current.emit('sendMessage', {
                    roomId,
                    senderId: currentUser.id,
                    text: inputValue,
                    image: attachedImage || undefined,
                    replyToId: replyingTo ? replyingTo.id : undefined,
                    _optimisticId: optimisticId
                });
            }
        }

        setInputValue('');
        setAttachedImage(null);
        setShowEmojiPicker(false);
        setReplyingTo(null);
    };

    // Handle deleting a message
    const handleDeleteMessage = (messageId) => {
        const roomId = activeItem.isClassroom ? activeId : `${activeId}-${activeTopicId}`;
        
        setMessagesByGroup(prev => {
            const activeMessagesList = prev[activeMessagesKey] || [];
            const wasLastMessage = activeMessagesList.length > 0 && activeMessagesList[activeMessagesList.length - 1].id === messageId;
            
            if (wasLastMessage) {
                const textPreview = 'Message deleted';
                if (studyGroups.some(g => g.id === activeId)) {
                    setStudyGroups(gPrev =>
                        gPrev.map(g => (g.id === activeId ? { ...g, subtitle: textPreview } : g))
                    );
                    if (!activeItem.isClassroom) {
                        setTopicsByGroup(tPrev => {
                            const groupTopics = tPrev[activeId] || [];
                            const updated = groupTopics.map(t => (t.id === activeTopicId ? { ...t, subtitle: textPreview } : t));
                            return { ...tPrev, [activeId]: updated };
                        });
                    }
                } else if (classrooms.some(c => c.id === activeId)) {
                    setClassrooms(cPrev =>
                        cPrev.map(c => (c.id === activeId ? { ...c, subtitle: textPreview } : c))
                    );
                }
            }

            const filteredMessages = activeMessagesList.filter(msg => msg.id !== messageId);
            return {
                ...prev,
                [activeMessagesKey]: filteredMessages
            };
        });

        // Call backend API to persist delete and broadcast
        apiFetch(`${API_BASE_URL}/chat/messages/${messageId}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ roomId })
        })
        .catch(err => console.error('Failed to delete message:', err));
    };
    handleDeleteMessageRef.current = handleDeleteMessage;

    // Handle deleting a study group
    const handleDeleteGroup = (groupId, e) => {
        if (e) e.stopPropagation();
        if (window.confirm('Are you sure you want to delete this study group?')) {
            apiFetch(`${API_BASE_URL}/chat/groups/${groupId}`, {
                method: 'DELETE'
            })
            .then(res => {
                if (res.ok) {
                    setStudyGroups(prev => prev.filter(g => g.id !== groupId));
                    if (activeId === groupId) {
                        setActiveId('flutter');
                    }
                    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
                    setToastMessage('Study group deleted.');
                    toastTimeoutRef.current = setTimeout(() => setToastMessage(null), 3000);
                } else {
                    return res.json().then(err => { throw new Error(err.message || 'Failed to delete group'); });
                }
            })
            .catch(err => {
                if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
                setToastMessage(err.message || 'Failed to delete group');
                toastTimeoutRef.current = setTimeout(() => setToastMessage(null), 3000);
            });
        }
    };

    // Handle deleting a study topic channel
    const handleDeleteTopic = (groupId, topicId, e) => {
        if (e) e.stopPropagation();
        if (topicId === 'general') {
            if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
            setToastMessage('The General topic cannot be deleted.');
            toastTimeoutRef.current = setTimeout(() => setToastMessage(null), 3000);
            return;
        }
        if (window.confirm(`Are you sure you want to delete the topic "${topicId}"?`)) {
            apiFetch(`${API_BASE_URL}/chat/groups/${groupId}/topics/${topicId}`, {
                method: 'DELETE'
            })
            .then(res => {
                if (res.ok) {
                    setTopicsByGroup(prev => {
                        const list = prev[groupId] || [];
                        return { ...prev, [groupId]: list.filter(t => t.id !== topicId && t.slug !== topicId) };
                    });
                    if (activeTopicId === topicId) {
                        setActiveTopicId('general');
                    }
                    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
                    setToastMessage('Topic deleted.');
                    toastTimeoutRef.current = setTimeout(() => setToastMessage(null), 3000);
                } else {
                    return res.json().then(err => { throw new Error(err.message || 'Failed to delete topic'); });
                }
            })
            .catch(err => {
                if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
                setToastMessage(err.message || 'Failed to delete topic');
                toastTimeoutRef.current = setTimeout(() => setToastMessage(null), 3000);
            });
        }
    };

    // Handle removing a member from group
    const handleRemoveMember = (memberId) => {
        if (window.confirm(`Are you sure you want to remove ${USER_PROFILES[memberId]?.name || memberId} from this group?`)) {
            apiFetch(`${API_BASE_URL}/chat/groups/${activeId}/members/${memberId}`, {
                method: 'DELETE'
            })
            .then(res => {
                if (res.ok) {
                    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
                    setToastMessage(`${USER_PROFILES[memberId]?.name} removed from the group.`);
                    toastTimeoutRef.current = setTimeout(() => setToastMessage(null), 3000);
                }
            })
            .catch(err => console.error('Failed to remove member:', err));
        }
    };

    // Handle starting message edit mode
    const handleStartEdit = (msg) => {
        setEditingMessageId(msg.id);
        setInputValue(msg.text);
        if (msg.image) {
            setAttachedImage(msg.image);
        }
        setShowEmojiPicker(false);
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Escape' && isSelectionMode) {
            exitSelectionMode();
            return;
        }
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

    // Trigger Custom Context Menu
    const handleContextMenu = (e, msg) => {
        e.preventDefault();
        setContextMenu({
            visible: true,
            x: e.clientX,
            y: e.clientY,
            message: msg
        });
    };

    // Forward message to a classroom or study group
    const handleForwardMessage = (targetChannelId) => {
        if (!forwardingMessage) return;

        const timeString = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        const isTargetClassroom = classrooms.some(c => c.id === targetChannelId);
        const targetRoomId = isTargetClassroom ? targetChannelId : `${targetChannelId}-general`;

        const newForwardMsg = {
            id: `optimistic-forward-${Date.now()}`,
            sender: currentUser.name,
            initials: currentUser.initials,
            avatarClass: currentUser.initials.toLowerCase(),
            avatarBg: currentUser.avatarBg,
            text: forwardingMessage.text,
            image: forwardingMessage.image,
            time: timeString,
            incoming: false,
            reactions: [],
            forwardedFrom: forwardingMessage.sender,
            type: forwardingMessage.type || 'text',
            fileName: forwardingMessage.fileName,
            fileSize: forwardingMessage.fileSize,
            fileIcon: forwardingMessage.fileIcon
        };

        setMessagesByGroup(prev => ({
            ...prev,
            [targetRoomId]: [...(prev[targetRoomId] || []), newForwardMsg]
        }));

        // Update target channel's preview in the sidebar
        const targetItem = studyGroups.find(g => g.id === targetChannelId) || classrooms.find(c => c.id === targetChannelId);
        const textPreview = forwardingMessage.text ? `Forwarded: ${forwardingMessage.text}` : '📷 Forwarded image';
        if (studyGroups.some(g => g.id === targetChannelId)) {
            setStudyGroups(prev =>
                prev.map(g => (g.id === targetChannelId ? { ...g, subtitle: textPreview, time: timeString } : g))
            );
        } else if (classrooms.some(c => c.id === targetChannelId)) {
            setClassrooms(prev =>
                prev.map(c => (c.id === targetChannelId ? { ...c, subtitle: textPreview, time: timeString } : c))
            );
        }

        if (socketRef.current) {
            socketRef.current.emit('sendMessage', {
                roomId: targetRoomId,
                senderId: currentUser.id,
                text: forwardingMessage.text || '',
                image: forwardingMessage.image || undefined,
                type: forwardingMessage.type || 'text',
                fileName: forwardingMessage.fileName,
                fileSize: forwardingMessage.fileSize,
                fileIcon: forwardingMessage.fileIcon,
                forwardedFrom: forwardingMessage.sender,
                _optimisticId: newForwardMsg.id
            });
        }

        setForwardingMessage(null);

        showToast(`Message forwarded to "${targetItem?.name}"!`, '↪️');
    };

    // Copy to clipboard from context menu
    const handleCopyMessageText = (msg) => {
        if (!msg.text) return;
        navigator.clipboard.writeText(msg.text)
            .then(() => {
                showToast('Message copied to clipboard!', '📋');
            });
    };

    // Add a new member to the active group
    const handleAddGroupMember = (memberId) => {
        setStudyGroups(prev =>
            prev.map(g => {
                if (g.id === activeId) {
                    return {
                        ...g,
                        members: [...(g.members || []), memberId]
                    };
                }
                return g;
            })
        );

        const addedUser = USER_PROFILES[memberId];
        const addedText = `${currentUser.name} added ${addedUser?.name || memberId} to the group`;

        setMessagesByGroup(prev => ({
            ...prev,
            [activeMessagesKey]: [
                ...(prev[activeMessagesKey] || []),
                { id: `sys-added-${Date.now()}`, type: 'system', text: addedText }
            ]
        }));

        showToast(`${addedUser?.name} added to the group!`, '👤');
    };

    // Render message text with clickable URL links & search highlighting
    const renderMessageText = (text, isIncoming) => {
        if (!text) return null;

        const urlRegex = /(https?:\/\/[^\s]+|classmind\.app\/invite\/[^\s]+|localhost:\d+\/join\/[^\s]+|[^\s]+\.com[^\s]*)/gi;
        const parts = text.split(urlRegex);

        const linkColor = isIncoming
            ? (darkMode ? '#60a5fa' : '#2563eb')
            : '#ffffff';

        const highlightMatches = (content) => {
            if (!inChatSearchQuery.trim()) return content;
            const query = inChatSearchQuery;
            const regex = new RegExp(`(${query.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')})`, 'gi');
            const subParts = content.split(regex);
            if (subParts.length === 1) return content;
            return subParts.map((sp, idx) =>
                regex.test(sp) ? (
                    <mark key={idx} className="search-matched-text">{sp}</mark>
                ) : (
                    sp
                )
            );
        };

        if (parts.length === 1) return <div>{highlightMatches(text)}</div>;

        return (
            <div>
                {parts.map((part, index) => {
                    if (part.match(urlRegex)) {
                        let hrefUrl = part;
                        if (!part.startsWith('http://') && !part.startsWith('https://')) {
                            hrefUrl = 'https://' + part;
                        }
                        const isInternalJoin = part.includes('/join/');
                        return (
                            <a
                                key={index}
                                href={hrefUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{ color: linkColor, textDecoration: 'underline', fontWeight: '600', cursor: 'pointer' }}
                                onClick={(e) => {
                                    if (isInternalJoin) {
                                        e.preventDefault();
                                        const channelId = part.split('/join/')[1];
                                        if (channelId) {
                                            setJoinPreviewGroupId(channelId);
                                        }
                                    }
                                }}
                            >
                                {part}
                            </a>
                        );
                    }
                    return <span key={index}>{highlightMatches(part)}</span>;
                })}
            </div>
        );
    };

    // Toggle emoji reactions (clicked on reaction badge under message bubble)
    const handleReactionClick = (messageId, emojiIndex) => {
        const roomId = activeItem.isClassroom ? activeId : `${activeId}-${activeTopicId}`;
        const activeMessagesList = messagesByGroup[activeMessagesKey] || [];
        const msg = activeMessagesList.find(m => m.id === messageId);
        if (!msg) return;
        const emoji = msg.reactions[emojiIndex]?.emoji;
        if (!emoji) return;

        setMessagesByGroup(prev => {
            const activeMessagesList = prev[activeMessagesKey] || [];
            const updatedMessages = activeMessagesList.map(msg => {
                if (msg.id === messageId) {
                    const reactions = [...msg.reactions];
                    const activeReactionIndex = reactions.findIndex(r => r.userReacted);

                    if (activeReactionIndex === emojiIndex) {
                        // Clicking the same emoji -> remove it
                        reactions[emojiIndex] = {
                            ...reactions[emojiIndex],
                            count: reactions[emojiIndex].count - 1,
                            userReacted: false
                        };
                    } else {
                        // Clicking a different emoji
                        // 1. Remove previous reaction if exists
                        if (activeReactionIndex > -1) {
                            reactions[activeReactionIndex] = {
                                ...reactions[activeReactionIndex],
                                count: reactions[activeReactionIndex].count - 1,
                                userReacted: false
                            };
                        }
                        // 2. Add/increment new reaction
                        reactions[emojiIndex] = {
                            ...reactions[emojiIndex],
                            count: reactions[emojiIndex].count + 1,
                            userReacted: true
                        };
                    }

                    // Clean up 0 count reactions
                    const cleanReactions = reactions.filter(r => r.count > 0);
                    return { ...msg, reactions: cleanReactions };
                }
                return msg;
            });
            return {
                ...prev,
                [activeMessagesKey]: updatedMessages
            };
        });

        // Trigger REST API call
        apiFetch(`${API_BASE_URL}/chat/messages/${messageId}/reactions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ emoji, roomId })
        })
        .catch(err => console.error('Failed to toggle reaction:', err));
    };

    // Add a quick reaction emoji directly if not already present (from hover bar)
    const handleAddEmojiReaction = (messageId, emoji) => {
        const roomId = activeItem.isClassroom ? activeId : `${activeId}-${activeTopicId}`;

        setMessagesByGroup(prev => {
            const activeMessagesList = prev[activeMessagesKey] || [];
            const updatedMessages = activeMessagesList.map(msg => {
                if (msg.id === messageId) {
                    const reactions = [...msg.reactions];
                    const activeReactionIndex = reactions.findIndex(r => r.userReacted);
                    const targetReactionIndex = reactions.findIndex(r => r.emoji === emoji);

                    if (activeReactionIndex > -1 && reactions[activeReactionIndex].emoji === emoji) {
                        // Clicked same emoji -> Toggle it off
                        reactions[activeReactionIndex] = {
                            ...reactions[activeReactionIndex],
                            count: reactions[activeReactionIndex].count - 1,
                            userReacted: false
                        };
                    } else {
                        // Remove previous active reaction if exists
                        if (activeReactionIndex > -1) {
                            reactions[activeReactionIndex] = {
                                ...reactions[activeReactionIndex],
                                count: reactions[activeReactionIndex].count - 1,
                                userReacted: false
                            };
                        }

                        // Add new/increment target reaction
                        if (targetReactionIndex > -1) {
                            reactions[targetReactionIndex] = {
                                ...reactions[targetReactionIndex],
                                count: reactions[targetReactionIndex].count + 1,
                                userReacted: true
                            };
                        } else {
                            reactions.push({ emoji, count: 1, userReacted: true });
                        }
                    }

                    // Clean up 0 count reactions
                    const cleanReactions = reactions.filter(r => r.count > 0);
                    return { ...msg, reactions: cleanReactions };
                }
                return msg;
            });
            return {
                ...prev,
                [activeMessagesKey]: updatedMessages
            };
        });

        // Trigger REST API call
        apiFetch(`${API_BASE_URL}/chat/messages/${messageId}/reactions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ emoji, roomId })
        })
        .catch(err => console.error('Failed to add emoji reaction:', err));
    };

    // Handle creating a new study group or classroom
    const handleCreateItem = () => {
        if (!newGroupName.trim()) return;

        const itemId = newGroupName.toLowerCase().replace(/\s+/g, '-');
        const descText = newGroupDesc.trim() || 'No messages yet';

        if (showAddModal.type === 'classroom') {
            apiFetch(`${API_BASE_URL}/chat/groups`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: newGroupName,
                    description: descText,
                    icon: '🏫',
                    color: '#10b981',
                    classroomId: classroomId || undefined,
                    memberIds: [currentUser.id]
                })
            })
            .then(res => { if (!res.ok) throw new Error(`Create classroom failed (${res.status})`); return res.json(); })
            .then(g => {
                const newClassroomObj = {
                    id: g.id,
                    name: g.name,
                    subtitle: g.description || 'No messages yet',
                    isClassroom: true,
                    time: ''
                };
                setClassrooms(prev => [...prev, newClassroomObj]);
                setMessagesByGroup(prev => ({
                    ...prev,
                    [g.id]: [{ id: `sys-${Date.now()}`, type: 'system', text: `Classroom "${newGroupName}" created` }]
                }));
                setActiveId(g.id);
            })
            .catch(err => console.error('Failed to create classroom:', err));
        } else {
            const tempId = itemId;
            const newGroupObj = {
                id: tempId,
                name: newGroupName,
                subtitle: descText,
                isClassroom: false,
                time: '',
                members: [currentUser.id],
                icon: '👥',
                color: '#8b5cf6'
            };
            setStudyGroups(prev => [...prev, newGroupObj]);
            setTopicsByGroup(prev => ({
                ...prev,
                [tempId]: [{ id: 'general', name: 'General', icon: '#', color: '#64748b', subtitle: 'General chat room', time: '' }]
            }));
            setSelectedGroupIdForTopics(tempId);
            setActiveTopicId('general');
            setActiveId(tempId);

            apiFetch(`${API_BASE_URL}/chat/groups`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: tempId,
                    name: newGroupName,
                    description: descText,
                    classroomId: classroomId || undefined,
                    memberIds: [currentUser.id]
                })
            })
            .then(res => { if (!res.ok) throw new Error(`Create group failed (${res.status})`); return res.json(); })
            .then(group => {
                // Pre-persist general topic channel
                apiFetch(`${API_BASE_URL}/chat/groups`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        id: `${tempId}-general`,
                        name: 'General',
                        description: 'General chat room',
                        icon: '#',
                        color: '#64748b',
                        classroomId: classroomId || undefined,
                        memberIds: []
                    })
                });

                setGroupMemberRoles(prev => ({
                    ...prev,
                    [`${tempId}-${currentUser.id}`]: 'OWNER'
                }));
            })
            .catch(err => console.error('Failed to persist group:', err));
        }

        setNewGroupName('');
        setNewGroupDesc('');
        setShowAddModal({ open: false, type: 'group' });
    };

    // Generate dynamic join link and copy to clipboard
    const handleCopyInvite = () => {
        const inviteLink = `${window.location.origin}/join/${activeId}`;
        navigator.clipboard.writeText(inviteLink)
            .then(() => {
                if (toastTimeoutRef.current) {
                    clearTimeout(toastTimeoutRef.current);
                }
                setToastMessage(`Invite link for "${activeItem.name}" copied to clipboard!`);
                toastTimeoutRef.current = setTimeout(() => {
                    setToastMessage(null);
                }, 3000);
            })
            .catch(() => {
                alert(`Invite Link: ${inviteLink}`);
            });
    };





    // Filter classrooms and study groups by search query
    const filteredClassrooms = classrooms.filter(c =>
        c.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const filteredStudyGroups = studyGroups.filter(g =>
        g.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className={`chat-layout ${darkMode ? 'dark' : 'light'}`}>

            {/* Float Toast Notification */}
            {toastMessage && (
                <div className="toast-notification">
                    <span>{toastEmoji}</span>
                    <span>{toastMessage}</span>
                </div>
            )}

            {/* Sidebar Panel */}
            {!hideSidebar && (
                <div className={`chat-sidebar ${mobileSidebarOpen ? 'mobile-open' : ''}`}>

                    {/* Profile Card */}
                    <div className="profile-card">
                        <div className="profile-info">
                            <div className="profile-avatar">
                                {currentUser.initials}
                                <span className="online-dot"></span>
                            </div>
                            <div className="profile-details">
                                <span className="profile-name">{currentUser.name}</span>
                                <span className="profile-status">online</span>
                            </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <button
                                className="theme-toggle-btn"
                                onClick={() => setDarkMode(!darkMode)}
                                title="Toggle theme"
                            >
                                {darkMode ? (
                                    <Sun size={18} />
                                ) : (
                                    <Moon size={18} />
                                )}
                            </button>

                            <button
                                className="sidebar-close-btn"
                                onClick={() => setMobileSidebarOpen(false)}
                                aria-label="Close Sidebar"
                                title="Close Sidebar"
                            >
                                <X size={18} />
                            </button>
                        </div>
                    </div>

                    {/* Search Bar */}
                    <div className="search-bar-container">
                        <div className="search-wrapper">
                            <span className="search-icon">
                                <Search size={16} />
                            </span>
                            <input
                                type="text"
                                placeholder="Search..."
                                className="search-input"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* List of Chats */}
                    <div className="sidebar-list-container">

                        {selectedGroupIdForTopics ? (() => {
                            const activeGrp = studyGroups.find(g => g.id === selectedGroupIdForTopics);
                            if (!activeGrp) return null;
                            const topics = topicsByGroup[selectedGroupIdForTopics] || [];
                            return (
                                <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                                    {/* Telegram-style Group Header */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 14px', borderBottom: '1px solid var(--border-color)', marginBottom: '4px' }}>
                                        <button
                                            onClick={() => setSelectedGroupIdForTopics(null)}
                                            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center' }}
                                            title="Back to Chats"
                                        >
                                            <ArrowLeft size={17} />
                                        </button>
                                        <div style={{
                                            width: '34px', height: '34px', borderRadius: '50%',
                                            background: activeGrp.color || '#6366f1',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            fontSize: '16px', flexShrink: 0
                                        }}>
                                            {activeGrp.icon || '👥'}
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontSize: '13.5px', fontWeight: '700', color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {activeGrp.name}
                                            </div>
                                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                                {activeGrp.members ? activeGrp.members.length : 1} members
                                            </div>
                                        </div>
                                        <button
                                            className="add-group-btn"
                                            onClick={() => setShowCreateTopicModal(true)}
                                            title="New Topic"
                                        >
                                            <Plus size={15} />
                                        </button>
                                    </div>

                                    {/* Section label */}
                                    <div style={{ padding: '6px 14px 2px', fontSize: '10.5px', fontWeight: '700', color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                                        Topics
                                    </div>

                                    {/* Telegram-style # channel list */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', padding: '0 6px' }}>
                                        {topics.length === 0 && (
                                            <div style={{ padding: '18px 10px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
                                                No topics yet. Create one with +
                                            </div>
                                        )}
                                        {topics.map(t => {
                                            const topicMsgs = messagesByGroup[`${selectedGroupIdForTopics}-${t.id}`] || [];
                                            const lastMsg = topicMsgs.filter(m => m.type !== 'system').slice(-1)[0];
                                            const lastMsgPreview = lastMsg ? (lastMsg.text || (lastMsg.image ? '📷 Photo' : '📎 File')) : 'No messages yet';
                                            const lastMsgTime = lastMsg?.time || t.time || '';
                                            const isActive = activeTopicId === t.id;
                                            return (
                                                <div
                                                    key={t.id}
                                                    onClick={() => { setActiveTopicId(t.id); setMobileSidebarOpen(false); }}
                                                    style={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '10px',
                                                        padding: '9px 10px',
                                                        borderRadius: '10px',
                                                        cursor: 'pointer',
                                                        background: isActive ? 'var(--active-item-bg, rgba(99,102,241,0.15))' : 'transparent',
                                                        transition: 'background 0.15s'
                                                    }}
                                                    onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'var(--hover-bg, rgba(255,255,255,0.05))'; }}
                                                    onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
                                                >
                                                    {/* # hash icon box */}
                                                    <div style={{
                                                        width: '36px', height: '36px', borderRadius: '10px',
                                                        background: isActive ? (t.color || '#6366f1') : 'var(--search-bg, rgba(255,255,255,0.08))',
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                        fontSize: '15px', fontWeight: '800', color: isActive ? 'white' : 'var(--text-muted)',
                                                        flexShrink: 0, transition: 'all 0.15s'
                                                    }}>
                                                        {t.id === 'general' ? '#' : t.icon || '#'}
                                                    </div>
                                                    <div style={{ flex: 1, minWidth: 0 }}>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                            <span style={{
                                                                fontSize: '13px', fontWeight: isActive ? '700' : '600',
                                                                color: isActive ? 'var(--text-main)' : 'var(--text-main)',
                                                                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                                                            }}># {t.name}</span>
                                                            {lastMsgTime && <span style={{ fontSize: '10.5px', color: 'var(--text-muted)', flexShrink: 0 }}>{lastMsgTime}</span>}
                                                        </div>
                                                        <span style={{
                                                            fontSize: '11.5px', color: 'var(--text-muted)',
                                                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block'
                                                        }}>{lastMsgPreview}</span>
                                                    </div>
                                                    {(() => {
                                                        const activeGroupObj = studyGroups.find(g => g.id === selectedGroupIdForTopics);
                                                        const myRole = groupMemberRoles[`${selectedGroupIdForTopics}-${currentUser.id}`] || (activeGroupObj?.ownerId === currentUser.id ? 'OWNER' : 'MEMBER');
                                                        if (t.id !== 'general' && (myRole === 'OWNER' || myRole === 'ADMIN')) {
                                                            return (
                                                                <button
                                                                    type="button"
                                                                    onClick={(e) => handleDeleteTopic(selectedGroupIdForTopics, t.id, e)}
                                                                    style={{
                                                                        background: 'none',
                                                                        border: 'none',
                                                                        color: '#ef4444',
                                                                        cursor: 'pointer',
                                                                        padding: '4px',
                                                                        display: 'flex',
                                                                        alignItems: 'center',
                                                                        justifyContent: 'center',
                                                                        borderRadius: '4px',
                                                                        flexShrink: 0
                                                                    }}
                                                                    title="Delete Topic"
                                                                >
                                                                    <Trash2 size={13} />
                                                                </button>
                                                            );
                                                        }
                                                        return null;
                                                    })()}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })() : (
                            <>
                                {/* Classrooms Section */}
                                <div className="section-header">
                                    <span>Classrooms</span>
                                    <button
                                        className="add-group-btn"
                                        title="Create Classroom"
                                        onClick={() => setShowAddModal({ open: true, type: 'classroom' })}
                                    >
                                        <Plus size={16} />
                                    </button>
                                </div>

                                {filteredClassrooms.map(c => (
                                    <div
                                        key={c.id}
                                        className={`sidebar-item ${activeId === c.id ? 'active' : ''}`}
                                        onClick={() => {
                                            setActiveId(c.id);
                                            setSelectedGroupIdForTopics(null);
                                            setMobileSidebarOpen(false);
                                        }}
                                    >
                                        <div className="item-avatar classroom">
                                            {/* Classroom Icon */}
                                            <BookOpen size={20} />
                                        </div>
                                        <div className="item-text-container">
                                            <div className="item-title-row">
                                                <span className="item-title">{c.name}</span>
                                                {c.time && <span className="item-time">{c.time}</span>}
                                            </div>
                                            <span className="item-subtitle">{c.subtitle}</span>
                                        </div>
                                    </div>
                                ))}

                                {/* Study Groups Section */}
                                <div className="section-header">
                                    <span>Study Groups</span>
                                    <button
                                        className="add-group-btn"
                                        title="Create Study Group"
                                        onClick={() => setShowAddModal({ open: true, type: 'group' })}
                                    >
                                        <Plus size={16} />
                                    </button>
                                </div>

                                {filteredStudyGroups.map(g => (
                                    <div
                                        key={g.id}
                                        className={`sidebar-item ${activeId === g.id ? 'active' : ''}`}
                                        onClick={() => {
                                            setActiveId(g.id);
                                            setSelectedGroupIdForTopics(g.id);
                                            setActiveTopicId('general');
                                            setMobileSidebarOpen(false);
                                        }}
                                    >
                                        <div
                                            className="item-avatar study-group"
                                            style={{
                                                background: g.color || 'linear-gradient(135deg, #8b5cf6, #6d28d9)',
                                                fontSize: '18px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                color: 'white',
                                                boxShadow: 'none'
                                            }}
                                        >
                                            {g.icon || '👥'}
                                        </div>
                                        <div className="item-text-container" style={{ flex: 1 }}>
                                            <div className="item-title-row">
                                                <span className="item-title">{g.name}</span>
                                                {g.time && <span className="item-time">{g.time}</span>}
                                            </div>
                                            <span className="item-subtitle">{g.subtitle}</span>
                                        </div>
                                        {(() => {
                                            const gRole = groupMemberRoles[`${g.id}-${currentUser.id}`] || (g.ownerId === currentUser.id ? 'OWNER' : 'MEMBER');
                                            if (gRole === 'OWNER') {
                                                return (
                                                    <button
                                                        className="delete-group-btn"
                                                        onClick={(e) => handleDeleteGroup(g.id, e)}
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
                                                );
                                            }
                                            return null;
                                        })()}
                                    </div>
                                ))}
                            </>
                        )}

                        {filteredClassrooms.length === 0 && filteredStudyGroups.length === 0 && (
                            <div style={{ padding: '20px 10px', fontSize: '13px', color: 'var(--text-muted)', textAlign: 'center' }}>
                                No conversations found
                            </div>
                        )}

                    </div>
                </div>
            )}

            {/* Main Chat Pane */}
            <div className="chat-pane">

                {/* Chat Header */}
                <div className="chat-header">
                    <div className="chat-header-info">
                        {!hideSidebar && (
                            <button
                                className="mobile-sidebar-toggle"
                                onClick={() => setMobileSidebarOpen(true)}
                                aria-label="Open Sidebar"
                                title="Open Sidebar"
                            >
                                <Menu size={20} />
                            </button>
                        )}
                        {hideSidebar && (
                            <button
                                type="button"
                                className="chat-header-back-btn"
                                onClick={() => setActiveId(null)}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    color: 'var(--text-main)',
                                    cursor: 'pointer',
                                    marginRight: '12px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    padding: '6px'
                                }}
                                title="Back to classroom members"
                            >
                                <ArrowLeft size={20} />
                            </button>
                        )}
                        <div
                            className="header-avatar"
                            style={{
                                cursor: 'pointer',
                                background: activeItem.color || 'var(--active-item-border)',
                                fontSize: !activeItem.isClassroom ? '24px' : '15px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'white'
                            }}
                            onClick={() => !activeItem.isClassroom && setShowGroupInfoModal(true)}
                        >
                            {!activeItem.isClassroom ? (activeItem.icon || '👥') : activeItem.name.substring(0, 2).toUpperCase()}
                        </div>
                        <div
                            className="header-details"
                            style={{ cursor: 'pointer' }}
                            onClick={() => !activeItem.isClassroom && setShowGroupInfoModal(true)}
                        >
                            <span className="header-title">
                                {activeItem.name}
                                {!activeItem.isClassroom && activeTopicId && (
                                    <span style={{ color: 'var(--active-item-border)', fontSize: '13px', marginLeft: '8px', fontWeight: '600', opacity: 0.85 }}>
                                        # {activeTopicId}
                                    </span>
                                )}
                            </span>
                            <span className="header-subtitle">
                                {typingUser ? (
                                    <span style={{ color: 'var(--active-item-border)', fontWeight: '500' }}>
                                        💬 {typingUser} is typing...
                                    </span>
                                ) : (
                                    activeItem.isClassroom ? (
                                        'Classroom channel'
                                    ) : (
                                        `${activeItem.members ? activeItem.members.length : 1} members · ${activeItem.members ? activeItem.members.filter(m => USER_PROFILES[m]?.online).length : 1
                                        } online`
                                    )
                                )}
                            </span>
                        </div>
                    </div>

                    <div className="chat-header-actions">
                        {!activeItem.isClassroom && activeItem.members && (
                            <div className="members-stack">
                                {activeItem.members.map(memberId => {
                                    const user = USER_PROFILES[memberId];
                                    if (!user) return null;
                                    return (
                                        <div
                                            key={memberId}
                                            className={`stack-avatar ${memberId}`}
                                            title={user.name}
                                            style={{ backgroundColor: user.avatarBg }}
                                        >
                                            {user.initials}
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {!activeItem.isClassroom && (
                            <button 
                                className={`invite-btn ${activeVoiceChat?.groupId === activeId ? 'active-voice' : ''}`} 
                                title={activeVoiceChat?.groupId === activeId ? "Voice Chat Active" : "Start Voice Chat"} 
                                onClick={handleToggleVoiceChat} 
                                style={{ 
                                    marginRight: '8px',
                                    backgroundColor: activeVoiceChat?.groupId === activeId ? 'rgba(16, 185, 129, 0.15)' : 'var(--search-bg)',
                                    color: activeVoiceChat?.groupId === activeId ? '#10b981' : 'var(--text-main)',
                                    border: activeVoiceChat?.groupId === activeId ? '1px solid #10b981' : 'none'
                                }}
                            >
                                <Phone size={18} />
                            </button>
                        )}
                        <button
                            className="invite-btn"
                            title={showInChatSearch ? "Close search" : "Search in conversation"}
                            onClick={() => {
                                setShowInChatSearch(!showInChatSearch);
                                if (showInChatSearch) setInChatSearchQuery('');
                            }}
                            style={{
                                marginRight: '8px',
                                backgroundColor: showInChatSearch ? 'var(--active-item-border)' : 'var(--search-bg)',
                                color: showInChatSearch ? '#ffffff' : 'var(--text-main)'
                            }}
                        >
                            <Search size={18} />
                        </button>
                        {!activeItem.isClassroom && (
                            <button className="invite-btn" title="Create Study Topic" onClick={() => setShowCreateTopicModal(true)} style={{ marginRight: '8px' }}>
                                <BookOpen size={18} />
                            </button>
                        )}
                        <button className="invite-btn" title="Copy Invite Link" onClick={() => setShowAddMemberModal(true)}>
                            <Link size={18} />
                        </button>
                    </div>
                </div>

                {/* In-Chat Message Search Bar */}
                {showInChatSearch && (
                    <div style={{ padding: '8px 16px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'var(--search-bg)' }}>
                        <div className="inchat-search-bar">
                            <Search size={16} color="var(--text-muted)" />
                            <input
                                type="text"
                                placeholder="Search in this conversation..."
                                value={inChatSearchQuery}
                                onChange={(e) => {
                                    setInChatSearchQuery(e.target.value);
                                    setSearchMatchIndex(0);
                                }}
                                className="inchat-search-input"
                                autoFocus
                            />
                            {matchedMessageIds.length > 0 && (
                                <span className="inchat-search-counter">
                                    {searchMatchIndex + 1} of {matchedMessageIds.length}
                                </span>
                            )}
                            {matchedMessageIds.length > 0 && (
                                <>
                                    <button className="inchat-search-btn" onClick={handlePrevSearchMatch} title="Previous match">
                                        <ChevronUp size={16} />
                                    </button>
                                    <button className="inchat-search-btn" onClick={handleNextSearchMatch} title="Next match">
                                        <ChevronDown size={16} />
                                    </button>
                                </>
                            )}
                        </div>
                        <button
                            onClick={() => {
                                setShowInChatSearch(false);
                                setInChatSearchQuery('');
                            }}
                            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
                        >
                            <X size={18} />
                        </button>
                    </div>
                )}

                {/* Pinned Message Banner */}
                {pinnedMessage && (
                    <div
                        className="pinned-message-banner"
                        onClick={() => handleJumpToMessage(pinnedMessage.id)}
                        title="Click to jump to pinned message"
                    >
                        <div className="pinned-icon">📌</div>
                        <div className="pinned-content">
                            <div className="pinned-title">Pinned Message</div>
                            <div className="pinned-snippet">{pinnedMessage.text || pinnedMessage.fileName || 'Pinned attachment'}</div>
                        </div>
                        {(groupMemberRoles[`${activeId}-${currentUser.id}`] === 'OWNER' || groupMemberRoles[`${activeId}-${currentUser.id}`] === 'ADMIN' || activeItem.ownerId === currentUser.id) && (
                            <button
                                className="pinned-unpin-btn"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleTogglePinMessage(pinnedMessage);
                                }}
                                title="Unpin message"
                            >
                                <X size={14} />
                            </button>
                        )}
                    </div>
                )}

                {/* Voice Chat active panel */}
                {voiceCallStatus !== null && activeVoiceChat?.groupId === activeId && (
                    <div className="voice-chat-bar" style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 16px',
                        backgroundColor: 'var(--search-bg, rgba(255,255,255,0.04))',
                        borderBottom: '1px solid var(--border-color)',
                        animation: 'slideDown 0.25s ease-out',
                        flexShrink: 0
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div className="pulsing-green-dot" style={{
                                width: '8px',
                                height: '8px',
                                borderRadius: '50%',
                                backgroundColor: '#10b981',
                                animation: 'pulse 1.5s infinite'
                            }} />
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-main)' }}>Group Voice Chat</span>
                                <span style={{ fontSize: '10px', color: '#10b981', fontWeight: '600' }}>
                                    {voiceCallStatus === 'connecting' ? 'Connecting...' : 'Active call'}
                                </span>
                            </div>
                        </div>

                        {/* Call participants */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {activeVoiceChat.participants.map(p => (
                                <div
                                    key={p.userId}
                                    style={{
                                        position: 'relative',
                                        width: '32px',
                                        height: '32px',
                                        borderRadius: '50%',
                                        backgroundColor: p.avatarBg || '#6366f1',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: '11px',
                                        fontWeight: '700',
                                        color: 'white',
                                        border: p.speaking ? '2px solid #10b981' : '1px solid transparent',
                                        boxShadow: p.speaking ? '0 0 8px rgba(16, 185, 129, 0.5)' : 'none',
                                        transition: 'all 0.15s'
                                    }}
                                    title={`${p.username || p.userId} ${p.muted ? '(Muted)' : ''}`}
                                >
                                    {p.initials}
                                    {p.muted && (
                                        <div style={{
                                            position: 'absolute',
                                            bottom: '-2px',
                                            right: '-2px',
                                            width: '12px',
                                            height: '12px',
                                            borderRadius: '50%',
                                            backgroundColor: '#ef4444',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            border: '1px solid var(--chat-pane-bg, #1e293b)'
                                        }}>
                                            <MicOff size={7} color="white" />
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>

                        {/* Action controls */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            {voiceCallStatus === 'connected' && (
                                <button
                                    onClick={handleToggleLocalMute}
                                    style={{
                                        background: localMuted ? 'rgba(239, 68, 68, 0.1)' : 'rgba(255,255,255,0.06)',
                                        border: 'none',
                                        color: localMuted ? '#ef4444' : 'var(--text-main)',
                                        padding: '6px 10px',
                                        borderRadius: '8px',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '6px',
                                        fontSize: '11.5px',
                                        fontWeight: '600'
                                    }}
                                >
                                    {localMuted ? <MicOff size={14} /> : <Mic size={14} />}
                                    {localMuted ? 'Muted' : 'Mute'}
                                </button>
                            )}
                            <button
                                onClick={handleLeaveVoiceChat}
                                style={{
                                    background: 'rgba(239, 68, 68, 0.15)',
                                    border: 'none',
                                    color: '#ef4444',
                                    padding: '6px 10px',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '6px',
                                    fontSize: '11.5px',
                                    fontWeight: '600'
                                }}
                            >
                                <LogOut size={14} />
                                Leave
                            </button>
                        </div>
                    </div>
                )}

                {/* Embedded horizontal topics selector (when sidebar is hidden) */}
                {hideSidebar && !activeItem.isClassroom && (
                    <div className="topics-horizontal-bar" style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '8px 16px',
                        borderBottom: '1px solid var(--border-color)',
                        backgroundColor: 'var(--search-bg, rgba(255,255,255,0.03))',
                        overflowX: 'auto',
                        flexShrink: 0
                    }}>
                        {(topicsByGroup[activeId] || []).map(t => {
                            const isActive = activeTopicId === t.id;
                            const myRole = groupMemberRoles[`${activeId}-${currentUser.id}`] || 'OWNER';
                            const showDelete = t.id !== 'general' && (myRole === 'OWNER' || myRole === 'ADMIN');
                            return (
                                <div
                                    key={t.id}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                        borderRadius: '20px',
                                        backgroundColor: isActive ? 'var(--active-item-border, #6366f1)' : 'rgba(255,255,255,0.06)',
                                        padding: showDelete ? '2px 4px 2px 12px' : '6px 12px',
                                        transition: 'all 0.15s',
                                        whiteSpace: 'nowrap'
                                    }}
                                >
                                    <button
                                        type="button"
                                        onClick={() => setActiveTopicId(t.id)}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '6px',
                                            background: 'none',
                                            border: 'none',
                                            cursor: 'pointer',
                                            fontSize: '12px',
                                            fontWeight: '600',
                                            color: isActive ? 'white' : 'var(--text-muted)',
                                            padding: showDelete ? '4px 0' : '0',
                                            paddingRight: showDelete ? '4px' : '0'
                                        }}
                                    >
                                        <span>{t.id === 'general' ? '#' : t.icon || '#'}</span>
                                        <span>{t.name}</span>
                                    </button>
                                    {showDelete && (
                                        <button
                                            type="button"
                                            onClick={(e) => handleDeleteTopic(activeId, t.id, e)}
                                            style={{
                                                background: 'none',
                                                border: 'none',
                                                color: isActive ? 'rgba(255,255,255,0.8)' : '#ef4444',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                width: '18px',
                                                height: '18px',
                                                borderRadius: '50%',
                                                backgroundColor: 'rgba(0,0,0,0.1)'
                                            }}
                                            title="Delete Topic"
                                        >
                                            <X size={10} />
                                        </button>
                                    )}
                                </div>
                            );
                        })}
                        <button
                            type="button"
                            onClick={() => setShowCreateTopicModal(true)}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: '26px',
                                height: '26px',
                                borderRadius: '50%',
                                border: '1px dashed var(--text-muted)',
                                background: 'none',
                                color: 'var(--text-muted)',
                                cursor: 'pointer',
                                fontSize: '14px',
                                flexShrink: 0
                            }}
                            title="Create Topic"
                        >
                            +
                        </button>
                    </div>
                )}

                {/* Conversation Message Pane */}
                <div className="conversation-pane" ref={conversationPaneRef} style={{ position: 'relative', userSelect: dragRect ? 'none' : undefined }}>
                    {/* Drag-to-select rubber-band overlay */}
                    {dragRect && (
                        <div
                            className="drag-select-rect"
                            style={{
                                top:    dragRect.ry,
                                left:   dragRect.rx,
                                width:  dragRect.rw,
                                height: dragRect.rh,
                            }}
                        />
                    )}
                    {activeMessages.length > 0 ? (
                        activeMessages.map((msg, index) => {
                            if (msg.type === 'system') {
                                return (
                                    <div key={msg.id} className="system-message">
                                        {msg.text}
                                    </div>
                                );
                            }

                            return (
                                <div
                                    key={msg.id}
                                    data-msgid={msg.id}
                                    className={`message-row ${msg.incoming ? 'incoming' : 'outgoing'}${isSelectionMode && selectedMessageIds.has(msg.id) ? ' selected' : ''}`}
                                    onContextMenu={(e) => { if (!isSelectionMode) handleContextMenu(e, msg); }}
                                    onClick={() => { if (isSelectionMode) toggleMessageSelection(msg.id); }}
                                    style={isSelectionMode ? { cursor: 'pointer' } : {}}
                                >
                                    {isSelectionMode && (
                                        <div
                                            className={`selection-checkbox ${selectedMessageIds.has(msg.id) ? 'checked' : ''}`}
                                            onClick={(e) => { e.stopPropagation(); toggleMessageSelection(msg.id); }}
                                        >
                                            {selectedMessageIds.has(msg.id) && <Check size={12} color="white" />}
                                        </div>
                                    )}
                                    {msg.incoming && (
                                        <div className={`message-avatar ${msg.avatarClass}`}>
                                            {msg.initials}
                                        </div>
                                    )}
                                    <div className="message-content-wrapper">
                                        {/* Hover Quick-Reaction Bar — hidden in selection mode */}
                                        {!isSelectionMode && (
                                        <div className="message-reaction-bar">
                                            {['👍', '❤️', '😂', '💪', '🔥', '✅'].map((emoji) => (
                                                <button
                                                    key={emoji}
                                                    className="reaction-bar-btn"
                                                    onClick={() => handleAddEmojiReaction(msg.id, emoji)}
                                                    title={`React with ${emoji}`}
                                                >
                                                    {emoji}
                                                </button>
                                            ))}

                                            {/* Edit outgoing messages only */}
                                            {!msg.incoming && (
                                                <button
                                                    className="reaction-bar-btn"
                                                    onClick={() => handleStartEdit(msg)}
                                                    title="Edit message"
                                                    style={{ borderLeft: '1px solid var(--border-color)', borderRadius: 0, paddingLeft: '6px', marginLeft: '2px', display: 'inline-flex', alignItems: 'center' }}
                                                >
                                                    <Pencil size={14} />
                                                </button>
                                            )}

                                            {/* Delete messages */}
                                            <button
                                                className="reaction-bar-btn"
                                                onClick={() => handleDeleteMessage(msg.id)}
                                                title="Delete message"
                                                style={{ display: 'inline-flex', alignItems: 'center' }}
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                        )}

                                        {msg.incoming && (
                                            <span className="sender-name" style={{ color: msg.avatarBg || 'var(--active-item-border)' }}>
                                                {msg.sender}
                                            </span>
                                        )}
                                        <div className="message-bubble" id={`msg-bubble-${msg.id}`}>
                                            {msg.replyTo && (
                                                <div
                                                    className="reply-preview-bubble"
                                                    onClick={() => {
                                                        const targetEl = document.getElementById(`msg-bubble-${msg.replyTo.id}`);
                                                        if (targetEl) {
                                                            targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                                            targetEl.style.backgroundColor = 'var(--active-item-bg)';
                                                            setTimeout(() => {
                                                                targetEl.style.backgroundColor = '';
                                                            }, 1000);
                                                        }
                                                    }}
                                                >
                                                    <span className="reply-sender-name">{msg.replyTo.sender}</span>
                                                    <span className="reply-preview-text">{msg.replyTo.text || '📷 Image'}</span>
                                                </div>
                                            )}
                                            {msg.forwardedFrom && (
                                                <div style={{ fontSize: '11px', color: 'var(--active-item-border)', fontStyle: 'italic', marginBottom: '4px' }}>
                                                    Forwarded from {msg.forwardedFrom}
                                                </div>
                                            )}
                                            {msg.text && msg.type !== 'audio' && renderMessageText(msg.text, msg.incoming)}
                                            {msg.image && (
                                                <img
                                                    src={msg.image}
                                                    alt="attachment"
                                                    className="message-image"
                                                    onClick={() => {
                                                        const w = window.open('', '_blank');
                                                        if (w) {
                                                            w.document.write(`<img src="${msg.image}" style="max-width:100%; max-height:100%; display:block; margin:auto;" />`);
                                                        }
                                                    }}
                                                />
                                            )}

                                            {/* Document Attachment bubble */}
                                            {msg.type === 'document' && (() => {
                                                const docIsImage = isImageFile(msg.fileName, msg.fileIcon);
                                                const docSrc = msg.fileDataUrl || msg.text;
                                                return (
                                                    <div
                                                        className="document-attachment-card"
                                                        style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px', backgroundColor: msg.incoming ? 'var(--search-bg)' : 'rgba(255,255,255,0.15)', borderRadius: '12px', marginTop: '6px', border: '1px solid var(--border-color)', minWidth: '220px', cursor: docIsImage ? 'pointer' : 'default' }}
                                                        onClick={() => {
                                                            if (docIsImage && docSrc) {
                                                                const w = window.open('', '_blank');
                                                                if (w) {
                                                                    w.document.write(`<img src="${docSrc}" style="max-width:100%;max-height:100%;display:block;margin:auto;background:#000;" />`);
                                                                }
                                                            }
                                                        }}
                                                    >
                                                        {docIsImage && docSrc ? (
                                                            <img
                                                                src={docSrc}
                                                                alt={msg.fileName}
                                                                style={{ width: '42px', height: '42px', borderRadius: '10px', objectFit: 'cover', flexShrink: 0 }}
                                                            />
                                                        ) : (
                                                            <div style={{ fontSize: '24px', backgroundColor: 'var(--sidebar-bg)', width: '42px', height: '42px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 5px rgba(0,0,0,0.1)', flexShrink: 0 }}>
                                                                {msg.fileIcon || '📄'}
                                                            </div>
                                                        )}
                                                        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', textAlign: 'left' }}>
                                                            <span className="file-name" style={{ fontSize: '13px', fontWeight: '600', color: msg.incoming ? 'var(--text-main)' : '#ffffff', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                                                                {msg.fileName}
                                                            </span>
                                                            <span className="file-size" style={{ fontSize: '11px', color: msg.incoming ? 'var(--text-muted)' : 'rgba(255,255,255,0.7)', marginTop: '2px' }}>
                                                                {msg.fileSize}{docIsImage ? ' · Tap to open' : ''}
                                                            </span>
                                                        </div>
                                                        {!docIsImage && (
                                                            docSrc ? (
                                                                <a href={docSrc} download={msg.fileName} onClick={e => e.stopPropagation()} style={{ fontSize: '18px', color: msg.incoming ? 'var(--active-item-border)' : '#ffffff', cursor: 'pointer', textDecoration: 'none' }}>
                                                                    📥
                                                                </a>
                                                            ) : (
                                                                <span style={{ fontSize: '18px', opacity: 0.6, cursor: 'default' }}>📄</span>
                                                            )
                                                        )}
                                                    </div>
                                                );
                                            })()}

                                            {/* Grouped album gallery attachments bubble */}
                                            {msg.type === 'grouped' && msg.files && (
                                                <div className="grouped-attachments-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '8px', marginTop: '6px', minWidth: '240px' }}>
                                                    {msg.files.map((file, idx) => (
                                                        <div key={idx} style={{ display: 'flex', flexDirection: 'column', padding: '8px', backgroundColor: msg.incoming ? 'var(--search-bg)' : 'rgba(255,255,255,0.15)', borderRadius: '12px', border: '1px solid var(--border-color)', overflow: 'hidden', textAlign: 'left' }}>
                                                            {file.isImage && file.data ? (
                                                                <img src={file.data} alt={file.name} style={{ width: '100%', height: '80px', objectFit: 'cover', borderRadius: '8px', marginBottom: '6px', cursor: 'pointer' }} onClick={() => {
                                                                    const w = window.open('', '_blank');
                                                                    if (w) {
                                                                        w.document.write(`<img src="${file.data}" style="max-width:100%; max-height:100%; display:block; margin:auto;" />`);
                                                                    }
                                                                }} />
                                                            ) : (
                                                                <div style={{ height: '80px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32px', backgroundColor: 'var(--sidebar-bg)', borderRadius: '8px', marginBottom: '6px' }}>
                                                                    {file.icon}
                                                                </div>
                                                            )}
                                                            <span style={{ fontSize: '11px', fontWeight: '600', color: msg.incoming ? 'var(--text-main)' : '#ffffff', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }} title={file.name}>
                                                                {file.name}
                                                            </span>
                                                            <span style={{ fontSize: '9.5px', color: msg.incoming ? 'var(--text-muted)' : 'rgba(255,255,255,0.7)', marginTop: '2px' }}>
                                                                {file.size}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                            {/* Audio Voice Note Player bubble */}
                                            {msg.type === 'audio' && (() => {
                                                const audioEl = audioPlayerRefs.current[msg.id];
                                                const curTime = audioEl ? audioEl.currentTime : 0;
                                                let dur = audioEl ? audioEl.duration : 0;
                                                if (!dur || dur === Infinity || isNaN(dur)) {
                                                    dur = getAudioDurationFromFileName(msg.fileName);
                                                }
                                                if (!dur && msg.duration) dur = msg.duration;
                                                const progressPercent = dur > 0 ? (curTime / dur) * 100 : 0;
                                                const isOutgoing = !msg.incoming;
                                                const isCurrentlyPlaying = activeAudioPlayingId === msg.id;

                                                return (
                                                    <div className="audio-player-bubble">
                                                        <button
                                                            type="button"
                                                            className="audio-play-btn"
                                                            onClick={() => handlePlayAudioMessage(msg)}
                                                            title={isCurrentlyPlaying ? "Pause" : "Play Voice Message"}
                                                        >
                                                            {isCurrentlyPlaying ? <Pause size={18} /> : <Play size={18} style={{ marginLeft: '2px' }} />}
                                                        </button>
                                                        <div className="audio-info">
                                                            <canvas
                                                                className="audio-waveform-canvas"
                                                                width="260"
                                                                height="44"
                                                                ref={(canvas) => {
                                                                    if (canvas) {
                                                                        audioWaveCanvasRef.current[msg.id] = canvas;
                                                                        if (activeAudioPlayingId !== msg.id) {
                                                                            const progress = dur > 0 ? curTime / dur : 0;
                                                                            drawAudioWave(canvas, false, msg.id, msg.incoming, progress);
                                                                        }
                                                                    } else {
                                                                        delete audioWaveCanvasRef.current[msg.id];
                                                                    }
                                                                }}
                                                            />
                                                            <div
                                                                className="audio-scrubber-track"
                                                                onClick={(e) => {
                                                                    const el = audioPlayerRefs.current[msg.id];
                                                                    if (el) {
                                                                        let clickDur = el.duration;
                                                                        if (!clickDur || clickDur === Infinity || isNaN(clickDur)) {
                                                                            clickDur = getAudioDurationFromFileName(msg.fileName) || msg.duration || 0;
                                                                        }
                                                                        if (clickDur > 0) {
                                                                            const rect = e.currentTarget.getBoundingClientRect();
                                                                            const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                                                                            el.currentTime = pos * clickDur;
                                                                            setActiveAudioProgress(prev => ({ ...prev, [msg.id]: Date.now() }));
                                                                            const canvas = audioWaveCanvasRef.current[msg.id];
                                                                            if (canvas) {
                                                                                drawAudioWave(canvas, activeAudioPlayingId === msg.id, msg.id, msg.incoming, pos);
                                                                            }
                                                                        }
                                                                    }
                                                                }}
                                                            >
                                                                <div
                                                                    className="audio-scrubber-fill"
                                                                    style={{ width: `${progressPercent}%` }}
                                                                />
                                                            </div>
                                                            <div className="audio-time-row" style={{ color: isOutgoing ? 'rgba(255,255,255,0.8)' : 'var(--text-muted)' }}>
                                                                <span>{formatAudioTime(curTime)} / {formatAudioTime(dur)}</span>
                                                                <span>{msg.fileSize || 'Voice Note'}</span>
                                                            </div>
                                                            <audio
                                                                ref={el => {
                                                                    if (el) {
                                                                        audioPlayerRefs.current[msg.id] = el;
                                                                    } else {
                                                                        delete audioPlayerRefs.current[msg.id];
                                                                    }
                                                                }}
                                                                src={msg.audioUrl || msg.text}
                                                                preload="metadata"
                                                                onLoadedMetadata={(e) => {
                                                                    setActiveAudioProgress(prev => ({ ...prev, [msg.id]: Date.now() }));
                                                                    const canvas = audioWaveCanvasRef.current[msg.id];
                                                                    if (canvas && activeAudioPlayingId !== msg.id) {
                                                                        let d = e.target.duration;
                                                                        if (!d || d === Infinity || isNaN(d)) {
                                                                            d = getAudioDurationFromFileName(msg.fileName) || msg.duration || 0;
                                                                        }
                                                                        const p = d > 0 ? e.target.currentTime / d : 0;
                                                                        drawAudioWave(canvas, false, msg.id, msg.incoming, p);
                                                                    }
                                                                }}
                                                                onTimeUpdate={() => {
                                                                    setActiveAudioProgress(prev => ({ ...prev, [msg.id]: Date.now() }));
                                                                }}
                                                                onPause={() => {
                                                                    if (activeAudioPlayingIdRef.current === msg.id) {
                                                                        activeAudioPlayingIdRef.current = null;
                                                                        setActiveAudioPlayingId(null);
                                                                        stopAudioWaveAnim();
                                                                        const canvas = audioWaveCanvasRef.current[msg.id];
                                                                        const el = audioPlayerRefs.current[msg.id];
                                                                        if (canvas && el) {
                                                                            let d = el.duration;
                                                                            if (!d || d === Infinity || isNaN(d)) {
                                                                                d = getAudioDurationFromFileName(msg.fileName) || msg.duration || 1;
                                                                            }
                                                                            drawAudioWave(canvas, false, msg.id, msg.incoming, el.currentTime / d);
                                                                        }
                                                                    }
                                                                }}
                                                                onEnded={() => {
                                                                    activeAudioPlayingIdRef.current = null;
                                                                    setActiveAudioPlayingId(null);
                                                                    stopAudioWaveAnim();
                                                                    const canvas = audioWaveCanvasRef.current[msg.id];
                                                                    if (canvas) {
                                                                        drawAudioWave(canvas, false, msg.id, msg.incoming, 0);
                                                                    }
                                                                    setActiveAudioProgress(prev => ({ ...prev, [msg.id]: Date.now() }));
                                                                }}
                                                                onError={(e) => {
                                                                    console.error("Audio failed to load:", msg.id, e);
                                                                    if (activeAudioPlayingIdRef.current === msg.id) {
                                                                        setActiveAudioPlayingId(null);
                                                                        activeAudioPlayingIdRef.current = null;
                                                                        stopAudioWaveAnim();
                                                                    }
                                                                }}
                                                                style={{ display: 'none' }}
                                                            />
                                                        </div>
                                                    </div>
                                                );
                                            })()}
                                            <span className="message-meta">
                                                {msg.time}
                                                {!msg.incoming && (
                                                    <span className="checkmark-icon">
                                                        <CheckCheck size={14} color={darkMode ? "#3b82f6" : "#ffffff"} />
                                                    </span>
                                                )}
                                            </span>
                                        </div>

                                        {/* Reactions display list */}
                                        {msg.reactions && msg.reactions.length > 0 && (
                                            <div className="reactions-list">
                                                {msg.reactions.map((react, rIdx) => (
                                                    <button
                                                        key={react.emoji}
                                                        className={`reaction-badge ${react.userReacted ? 'active' : ''}`}
                                                        onClick={() => handleReactionClick(msg.id, rIdx)}
                                                    >
                                                        <span>{react.emoji}</span>
                                                        <span>{react.count}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })
                    ) : (
                        <div className="empty-state">
                            <div className="empty-state-icon" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                                <MessageSquare size={36} color="var(--active-item-border)" />
                            </div>
                            <div className="empty-state-title">No messages yet</div>
                            <div className="empty-state-desc">Send a message to start the conversation in this channel!</div>
                        </div>
                    )}

                </div>

                {/* Image Attachment Preview */}
                {attachedImage && (
                    <div className="image-preview-container">
                        <div className="preview-thumbnail-wrapper">
                            <img src={attachedImage} alt="Preview" className="preview-thumbnail" />
                            <button className="remove-preview-btn" onClick={() => setAttachedImage(null)} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><X size={14} /></button>
                        </div>
                    </div>
                )}

                {/* Replying Message Quoted Banner */}
                {replyingTo && (
                    <div className="reply-input-banner">
                        <div className="reply-banner-details">
                            <span className="reply-banner-title">Reply to {replyingTo.sender}</span>
                            <span className="reply-banner-preview">{replyingTo.text || '📷 Image'}</span>
                        </div>
                        <button
                            className="close-banner-btn"
                            onClick={() => setReplyingTo(null)}
                            title="Cancel reply"
                            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                            <X size={14} />
                        </button>
                    </div>
                )}

                {/* Editing Message Banner */}
                {editingMessageId && (
                    <div className="image-preview-container" style={{ justifyContent: 'space-between', padding: '8px 24px', backgroundColor: 'var(--search-bg)' }}>
                        <span style={{ fontSize: '12px', color: 'var(--active-item-border)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Pencil size={14} /> Editing message...
                        </span>
                        <button
                            onClick={() => {
                                setEditingMessageId(null);
                                setInputValue('');
                                setAttachedImage(null);
                            }}
                            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '12px' }}
                        >
                            Cancel
                        </button>
                    </div>
                )}

                {/* Emoji Picker Popover */}
                {showEmojiPicker && (
                    <div className="emoji-picker-popover">
                        <div className="emoji-picker-header">Select Emoji</div>
                        <div className="emoji-picker-grid">
                            {CURATED_EMOJIS.map((emoji) => (
                                <button
                                    key={emoji}
                                    onClick={() => {
                                        setInputValue(prev => prev + emoji);
                                    }}
                                >
                                    {emoji}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Input Footer */}
                <div className="chat-footer">
                    <div className="input-bar">
                        {/* Hidden File Input */}
                        <input
                            type="file"
                            multiple
                            style={{ display: 'none' }}
                            ref={fileInputRef}
                            onChange={handleFileChange}
                        />

                        {/* Attachment Button */}
                        <button className="input-action-btn" title="Attach files" onClick={triggerFileSelect} disabled={isRecordingVoice}>
                            <Paperclip size={20} />
                        </button>

                        {isRecordingVoice ? (
                            <div className="voice-recording-bar">
                                <div className="rec-indicator">
                                    <div className="rec-dot" />
                                    <span className="rec-timer">
                                        {Math.floor(recordingDuration / 60)}:{(recordingDuration % 60).toString().padStart(2, '0')}
                                    </span>
                                </div>
                                <div className="rec-waveforms">
                                    {[40, 70, 30, 90, 50, 80, 60, 100, 45, 65, 85, 35].map((h, i) => (
                                        <div key={i} className="rec-wave-bar" style={{ animationDelay: `${i * 0.08}s`, height: `${h * 0.2}px` }} />
                                    ))}
                                </div>
                                <button className="rec-cancel-btn" onClick={handleCancelVoiceRecording} title="Cancel recording">
                                    <Trash2 size={18} />
                                </button>
                                <button className="rec-send-btn" onClick={handleSendVoiceRecording} title="Send voice message">
                                    <Send size={16} />
                                </button>
                            </div>
                        ) : (
                            <>
                                {/* Message input */}
                                <textarea
                                    placeholder="Write a message..."
                                    className="message-textarea"
                                    rows="1"
                                    value={inputValue}
                                    onChange={(e) => setInputValue(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                />

                                {/* Quick Emoji Reaction trigger */}
                                <button
                                    className="input-action-btn"
                                    title="Add emoji"
                                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                                >
                                    <Smile size={20} />
                                </button>

                                {/* Send / Voice Record Button */}
                                {inputValue.trim() || attachedImage ? (
                                    <button
                                        className="send-btn"
                                        onClick={handleSendMessage}
                                        title={editingMessageId ? "Update Message" : "Send Message"}
                                    >
                                        {editingMessageId ? (
                                            <Check size={18} color="var(--active-item-border)" />
                                        ) : (
                                            <Send size={18} />
                                        )}
                                    </button>
                                ) : (
                                    <button
                                        type="button"
                                        className="input-action-btn"
                                        title="Record voice message"
                                        onClick={handleStartVoiceRecording}
                                        style={{ color: 'var(--active-item-border)' }}
                                    >
                                        <Mic size={20} />
                                    </button>
                                )}
                            </>
                        )}
                    </div>
                </div>

            </div>

            {/* Create Study Group Modal */}
            <CreateGroup
                isOpen={showAddModal.open && showAddModal.type === 'group'}
                onClose={() => {
                    setShowAddModal({ open: false, type: 'group' });
                    onCloseCreateGroupDirectly?.();
                }}
                onCreate={(groupDetails) => {
                    const memberList = [currentUser.id, ...groupDetails.members];
                    
                    apiFetch(`${API_BASE_URL}/chat/groups`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            name: groupDetails.name,
                            description: groupDetails.topic || 'No messages yet',
                            icon: groupDetails.icon || '👥',
                            color: groupDetails.color || '#6366f1',
                            classroomId: classroomId || undefined,
                            memberIds: memberList
                        })
                    })
                    .then(res => { if (!res.ok) throw new Error(`Create group failed (${res.status})`); return res.json(); })
                    .then(g => {
                        const newGroupObj = {
                            id: g.id,
                            name: g.name,
                            subtitle: g.description || 'No messages yet',
                            isClassroom: false,
                            time: '',
                            icon: g.icon || '👥',
                            color: g.color || '#6366f1',
                            members: memberList
                        };

                        const memberNames = groupDetails.members.map(mId => USER_PROFILES[mId]?.name || mId);
                        let joinedText = '';
                        if (memberNames.length > 0) {
                            if (memberNames.length === 1) {
                                joinedText = `${currentUser.name} added ${memberNames[0]} to the group`;
                            } else if (memberNames.length === 2) {
                                joinedText = `${currentUser.name} added ${memberNames[0]} and ${memberNames[1]} to the group`;
                            } else {
                                const last = memberNames.pop();
                                joinedText = `${currentUser.name} added ${memberNames.join(', ')}, and ${last} to the group`;
                            }
                        }

                        // Emit WebSocket studyInvitation to all other invited members
                        if (socketRef.current) {
                            socketRef.current.emit('studyInvitation', {
                                inviterId: currentUser.id,
                                inviterName: currentUser.name,
                                inviterInitials: currentUser.initials,
                                topicName: groupDetails.topic || 'StatefulWidget Lifecycle',
                                categoryName: `${groupDetails.name} · Study Group`,
                                invitedMembers: groupDetails.members,
                                groupId: g.id
                            });
                        }

                        const topicId = (groupDetails.topic || 'StatefulWidget Lifecycle').toLowerCase().replace(/\s+/g, '-');

                        setTopicsByGroup(prev => ({
                            ...prev,
                            [g.id]: [
                                { id: 'general', name: 'General', icon: '#', color: '#64748b', subtitle: 'General room', time: '' },
                                { id: topicId, name: groupDetails.topic || 'StatefulWidget Lifecycle', icon: (groupDetails.topic || 'StatefulWidget Lifecycle')[0].toUpperCase(), color: '#0d9488', subtitle: 'Main topic', time: '' }
                            ]
                        }));

                        setGroupMemberRoles(prev => {
                            const updated = { ...prev };
                            updated[`${g.id}-${currentUser.id}`] = 'OWNER';
                            groupDetails.members.forEach(mId => {
                                updated[`${g.id}-${mId}`] = 'MEMBER';
                            });
                            return updated;
                        });

                        setStudyGroups(prev => {
                            if (prev.some(x => x.id === g.id)) return prev;
                            return [...prev, newGroupObj];
                        });
                        setMessagesByGroup(prev => ({
                            ...prev,
                            [`${g.id}-${topicId}`]: [
                                { id: `sys-create-${Date.now()}`, type: 'system', text: `You created the study group "${groupDetails.name}" with study topic "${groupDetails.topic || 'StatefulWidget Lifecycle'}"` },
                                ...(joinedText ? [{ id: `sys-added-${Date.now()}`, type: 'system', text: joinedText }] : [])
                            ]
                        }));
                        setActiveId(g.id);
                        setSelectedGroupIdForTopics(g.id);
                        setActiveTopicId(topicId);
                        setShowAddModal({ open: false, type: 'group' });
                        onCloseCreateGroupDirectly?.();
                        // Show invitation confirmation immediately after group creation
                        if (groupDetails.members && groupDetails.members.length > 0) {
                            setCreatedTopicName(groupDetails.topic || groupDetails.name);
                            setTimeout(() => setShowSendInvitationModal(true), 300);
                        }
                    })
                    .catch(err => console.error('Failed to create study group:', err));
                }}
            />

            {/* Create Classroom Modal */}
            {showAddModal.open && showAddModal.type === 'classroom' && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <div className="modal-header">Create Classroom</div>
                        <input
                            type="text"
                            placeholder="Enter name..."
                            className="modal-input"
                            value={newGroupName}
                            onChange={(e) => setNewGroupName(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') handleCreateItem();
                            }}
                            autoFocus
                        />
                        <input
                            type="text"
                            placeholder="Enter description..."
                            className="modal-input"
                            value={newGroupDesc}
                            onChange={(e) => setNewGroupDesc(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') handleCreateItem();
                            }}
                        />
                        <div className="modal-actions">
                            <button className="modal-btn cancel" onClick={() => {
                                setNewGroupName('');
                                setNewGroupDesc('');
                                setShowAddModal({ open: false, type: 'group' });
                            }}>
                                Cancel
                            </button>
                            <button className="modal-btn confirm" onClick={handleCreateItem}>
                                Create
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Custom Context Menu */}
            {/* Selection Action Bar */}
            {isSelectionMode && (
                <div className="selection-action-bar">
                    <button className="selection-cancel-btn" onClick={exitSelectionMode} title="Cancel">
                        <X size={18} />
                    </button>
                    <span className="selection-count">
                        {selectedMessageIds.size} selected
                    </span>
                    <div className="selection-actions">
                        {selectedMessageIds.size === 1 && (() => {
                            const selMsg = activeMessages.find(m => selectedMessageIds.has(m.id));
                            return selMsg ? (
                                <button className="selection-action-btn" onClick={() => { setForwardingMessage(selMsg); exitSelectionMode(); }} title="Forward">
                                    <Forward size={16} /> Forward
                                </button>
                            ) : null;
                        })()}
                        <button
                            className="selection-action-btn danger"
                            onClick={handleDeleteSelected}
                            disabled={selectedMessageIds.size === 0}
                            title="Delete selected"
                        >
                            <Trash2 size={16} /> Delete ({selectedMessageIds.size})
                        </button>
                    </div>
                </div>
            )}

            {contextMenu.visible && (
                <div
                    className="custom-context-menu"
                    style={{ top: `${contextMenu.y}px`, left: `${contextMenu.x}px` }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <button
                        className="context-menu-item"
                        onClick={() => {
                            enterSelectionMode(contextMenu.message?.id);
                        }}
                        style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                    >
                        <Check size={16} /> Select
                    </button>
                    <button
                        className="context-menu-item"
                        onClick={() => {
                            setReplyingTo(contextMenu.message);
                            setContextMenu({ visible: false, x: 0, y: 0, message: null });
                        }}
                        style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                    >
                        <Reply size={16} /> Reply
                    </button>
                    <button
                        className="context-menu-item"
                        onClick={() => {
                            handleTogglePinMessage(contextMenu.message);
                            setContextMenu({ visible: false, x: 0, y: 0, message: null });
                        }}
                        style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                    >
                        {contextMenu.message?.isPinned ? <PinOff size={16} /> : <Pin size={16} />}
                        {contextMenu.message?.isPinned ? 'Unpin Message' : 'Pin Message'}
                    </button>
                    <button
                        className="context-menu-item"
                        onClick={() => {
                            setForwardingMessage(contextMenu.message);
                            setContextMenu({ visible: false, x: 0, y: 0, message: null });
                        }}
                        style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                    >
                        <Forward size={16} /> Forward
                    </button>
                    {contextMenu.message?.text && (
                        <button
                            className="context-menu-item"
                            onClick={() => {
                                handleCopyMessageText(contextMenu.message);
                                setContextMenu({ visible: false, x: 0, y: 0, message: null });
                            }}
                            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                        >
                            <Copy size={16} /> Copy Text
                        </button>
                    )}
                    {!contextMenu.message?.incoming && (
                        <button
                            className="context-menu-item"
                            onClick={() => {
                                handleStartEdit(contextMenu.message);
                                setContextMenu({ visible: false, x: 0, y: 0, message: null });
                            }}
                            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                        >
                            <Pencil size={16} /> Edit
                        </button>
                    )}
                    <button
                        className="context-menu-item"
                        onClick={() => {
                            alert(`Message Details:\n\nSender: ${contextMenu.message?.sender}\nTime: ${contextMenu.message?.time}\nID: ${contextMenu.message?.id}`);
                            setContextMenu({ visible: false, x: 0, y: 0, message: null });
                        }}
                        style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                    >
                        <Info size={16} /> Details
                    </button>
                    <button
                        className="context-menu-item danger-text"
                        onClick={() => {
                            handleDeleteMessage(contextMenu.message?.id);
                            setContextMenu({ visible: false, x: 0, y: 0, message: null });
                        }}
                        style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                    >
                        <Trash2 size={16} /> Delete
                    </button>
                </div>
            )}

            {/* Forward Picker Modal */}
            {forwardingMessage && (
                <div className="create-group-modal-overlay" onClick={() => setForwardingMessage(null)}>
                    <div className="forward-picker-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="members-modal-header">
                            <h3>Forward Message</h3>
                            <p>Select a group or classroom to forward this message to:</p>
                        </div>
                        <div className="forward-channels-list">
                            {classrooms.map(c => (
                                <div key={c.id} className="forward-channel-row" onClick={() => handleForwardMessage(c.id)}>
                                    <div className="header-avatar" style={{ fontSize: '11px', width: '28px', height: '28px' }}>
                                        {c.name.substring(0, 2).toUpperCase()}
                                    </div>
                                    <span style={{ fontSize: '13.5px', fontWeight: '500' }}>{c.name}</span>
                                </div>
                            ))}
                            {studyGroups.map(g => (
                                <div key={g.id} className="forward-channel-row" onClick={() => handleForwardMessage(g.id)}>
                                    <div className="header-avatar" style={{ fontSize: '11px', width: '28px', height: '28px' }}>
                                        {g.name.substring(0, 2).toUpperCase()}
                                    </div>
                                    <span style={{ fontSize: '13.5px', fontWeight: '500' }}>{g.name}</span>
                                </div>
                            ))}
                        </div>
                        <button className="members-modal-close-btn" onClick={() => setForwardingMessage(null)}>
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            {/* Telegram Group Info Modal */}
            {showGroupInfoModal && (
                <div className="create-group-modal-overlay" onClick={() => {
                    setShowGroupInfoModal(false);
                    setIsAddingMember(false);
                }}>
                    <div className="members-list-modal" style={{ width: '420px' }} onClick={(e) => e.stopPropagation()}>

                        {/* Group Profile Header */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px' }}>
                            <div
                                className="header-avatar"
                                style={{
                                    width: '64px',
                                    height: '64px',
                                    fontSize: '26px',
                                    borderRadius: '18px',
                                    marginBottom: '10px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    background: activeItem.color || 'var(--active-item-border)',
                                    color: 'white'
                                }}
                            >
                                {activeItem.icon || '👥'}
                            </div>
                            {isEditingGroupInfo ? (
                                <div style={{ width: '100%', marginBottom: '10px' }}>
                                    <label className="field-label-text">Group Name</label>
                                    <input
                                        type="text"
                                        value={editGroupName}
                                        onChange={(e) => setEditGroupName(e.target.value)}
                                        className="inchat-search-input"
                                        style={{ width: '100%', marginTop: '4px', marginBottom: '8px', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--search-bg)' }}
                                    />
                                    <label className="field-label-text">Group Description</label>
                                    <textarea
                                        value={editGroupDesc}
                                        onChange={(e) => setEditGroupDesc(e.target.value)}
                                        rows={2}
                                        style={{ width: '100%', marginTop: '4px', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--search-bg)', color: 'var(--text-main)', fontSize: '13px', resize: 'vertical' }}
                                    />
                                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginTop: '10px' }}>
                                        <button
                                            type="button"
                                            onClick={handleSaveGroupInfo}
                                            style={{ padding: '6px 14px', fontSize: '12px', fontWeight: '600', borderRadius: '6px', border: 'none', backgroundColor: 'var(--active-item-border)', color: 'white', cursor: 'pointer' }}
                                        >
                                            Save Changes
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setIsEditingGroupInfo(false)}
                                            style={{ padding: '6px 14px', fontSize: '12px', fontWeight: '600', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'transparent', color: 'var(--text-muted)', cursor: 'pointer' }}
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
                                        <h3 style={{ margin: '0 0 4px 0', fontSize: '20px', fontWeight: '700' }}>{activeItem.name}</h3>
                                        {(groupMemberRoles[`${activeId}-${currentUser.id}`] === 'OWNER' || activeItem.ownerId === currentUser.id) && (
                                            <button
                                                type="button"
                                                onClick={handleStartEditGroupInfo}
                                                style={{ background: 'none', border: 'none', color: 'var(--active-item-border)', cursor: 'pointer', padding: '2px' }}
                                                title="Edit Group Info"
                                            >
                                                <Pencil size={14} />
                                            </button>
                                        )}
                                    </div>
                                    <p style={{ margin: 0, fontSize: '12.5px', color: 'var(--text-muted)' }}>
                                        {activeItem.members ? activeItem.members.length : 1} members · {
                                            activeItem.members ? activeItem.members.filter(m => USER_PROFILES[m]?.online).length : 1
                                        } online
                                    </p>
                                </>
                            )}
                        </div>

                        {/* Description & Invite Link Section */}
                        {!isEditingGroupInfo && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '20px' }}>
                                {/* Description */}
                                <div>
                                    <label className="field-label-text">Group Description</label>
                                    <div style={{ fontSize: '13.5px', color: 'var(--text-main)', backgroundColor: 'var(--search-bg)', padding: '12px 16px', borderRadius: '12px', border: '1px solid var(--border-color)', marginTop: '6px', lineHeight: '1.45' }}>
                                        {activeItem.description || activeItem.subtitle || "No description set for this group."}
                                    </div>
                                </div>

                                {/* Invite Link */}
                                <div>
                                    <label className="field-label-text">Invite Link</label>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
                                        <div style={{ flex: 1, fontSize: '13px', color: 'var(--text-main)', backgroundColor: 'var(--search-bg)', padding: '10px 14px', borderRadius: '12px', border: '1px solid var(--border-color)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {`${window.location.origin}/join/${activeId}`}
                                        </div>
                                        <button
                                            type="button"
                                            className="modal-action-button cancel-button"
                                            style={{ padding: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '38px', height: '38px' }}
                                            onClick={handleCopyInvite}
                                            title="Copy Link"
                                        >
                                            <Copy size={16} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Members Block */}
                        <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                <label className="field-label-text" style={{ margin: 0 }}>
                                    Members ({activeItem.members ? activeItem.members.length : 1})
                                </label>
                                <button
                                    type="button"
                                    style={{ padding: '4px 8px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px', height: 'auto', background: 'var(--active-item-bg)', color: 'var(--active-item-border)', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}
                                    onClick={() => setIsAddingMember(!isAddingMember)}
                                >
                                    {isAddingMember ? <><X size={14} /> Close</> : <><UserPlus size={14} /> Add Member</>}
                                </button>
                            </div>

                            {/* Add Member sub-panel selector */}
                            {isAddingMember && (
                                <div style={{ marginBottom: '16px', padding: '12px', backgroundColor: 'var(--search-bg)', border: '1px dashed var(--active-item-border)', borderRadius: '12px', animation: 'fadeIn 0.2s ease-out' }}>
                                    <span style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', display: 'block', marginBottom: '8px', letterSpacing: '0.05em' }}>
                                        SELECT USER TO ADD:
                                    </span>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '120px', overflowY: 'auto' }}>
                                        {Object.keys(USER_PROFILES)
                                            .filter(mId => !activeItem.members?.includes(mId))
                                            .map(memberId => {
                                                const user = USER_PROFILES[memberId];
                                                return (
                                                    <div
                                                        key={memberId}
                                                        className="member-selection-row"
                                                        style={{ padding: '6px 10px', borderRadius: '8px', cursor: 'pointer' }}
                                                        onClick={() => {
                                                            handleAddGroupMember(memberId);
                                                            setIsAddingMember(false);
                                                        }}
                                                    >
                                                        <div className="member-avatar-badge" style={{ backgroundColor: user.avatarBg, width: '28px', height: '28px', fontSize: '10px' }}>
                                                            {user.initials}
                                                        </div>
                                                        <div className="member-details-column" style={{ marginLeft: '10px' }}>
                                                            <span style={{ fontSize: '13px', fontWeight: '600' }}>{user.name}</span>
                                                        </div>
                                                        <span style={{ fontSize: '11px', color: 'var(--active-item-border)', fontWeight: '600', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>Add <Plus size={12} /></span>
                                                    </div>
                                                );
                                            })}
                                        {Object.keys(USER_PROFILES).filter(mId => !activeItem.members?.includes(mId)).length === 0 && (
                                            <div style={{ fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center', padding: '10px 0' }}>
                                                All available members are already in this group!
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Scrollable Members list */}
                            <div className="members-modal-list" style={{ maxHeight: '180px' }}>
                                {activeItem.members ? activeItem.members.map(memberId => {
                                    const user = USER_PROFILES[memberId];
                                    if (!user) return null;
                                    return (
                                        <div key={memberId} className="member-selection-row" style={{ cursor: 'default', padding: '6px 10px' }}>
                                            <div className="member-avatar-badge" style={{ backgroundColor: user.avatarBg, width: '30px', height: '30px', fontSize: '10px' }}>
                                                {user.initials}
                                                <span className={`member-online-dot ${user.online ? 'online' : 'offline'}`} />
                                            </div>
                                            <div className="member-details-column" style={{ marginLeft: '10px' }}>
                                                <span className="member-row-name" style={{ fontSize: '13px' }}>{user.name}</span>
                                                <span className={`member-row-status ${user.online ? 'online-text' : ''}`} style={{ fontSize: '10.5px' }}>
                                                    {user.online ? 'online' : 'offline'}
                                                </span>
                                            </div>
                                            {(() => {
                                                const role = groupMemberRoles[`${activeId}-${memberId}`] || (memberId === currentUser.id ? 'OWNER' : 'MEMBER');
                                                const myRole = groupMemberRoles[`${activeId}-${currentUser.id}`] || 'OWNER';
                                                const roleText = role === 'OWNER' ? 'Owner' : (role === 'ADMIN' ? 'Admin' : 'Member');
                                                const roleClass = role === 'OWNER' ? 'owner' : (role === 'ADMIN' ? 'admin' : 'member');
                                                return (
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <span className={`member-role-badge ${roleClass}`}>
                                                            {roleText}
                                                        </span>
                                                        {myRole === 'OWNER' && memberId !== currentUser.id && (
                                                            <button
                                                                type="button"
                                                                onClick={() => handleToggleAdminRole(memberId)}
                                                                style={{
                                                                    padding: '2px 6px',
                                                                    fontSize: '10px',
                                                                    borderRadius: '4px',
                                                                    border: '1px solid var(--border-color)',
                                                                    backgroundColor: role === 'ADMIN' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                                                                    color: role === 'ADMIN' ? '#ef4444' : '#10b981',
                                                                    cursor: 'pointer',
                                                                    fontWeight: '600',
                                                                    marginRight: '4px'
                                                                }}
                                                            >
                                                                {role === 'ADMIN' ? 'Demote' : 'Promote'}
                                                            </button>
                                                        )}
                                                        {memberId !== currentUser.id && (myRole === 'OWNER' || (myRole === 'ADMIN' && role !== 'OWNER')) && (
                                                            <button
                                                                type="button"
                                                                onClick={() => handleRemoveMember(memberId)}
                                                                style={{
                                                                    padding: '2px 6px',
                                                                    fontSize: '10px',
                                                                    borderRadius: '4px',
                                                                    border: '1px solid rgba(239, 68, 68, 0.2)',
                                                                    backgroundColor: 'rgba(239, 68, 68, 0.15)',
                                                                    color: '#ef4444',
                                                                    cursor: 'pointer',
                                                                    fontWeight: '600',
                                                                    display: 'inline-flex',
                                                                    alignItems: 'center',
                                                                    justifyContent: 'center',
                                                                    gap: '2px'
                                                                }}
                                                                title="Remove Member"
                                                            >
                                                                <X size={11} /> Remove
                                                            </button>
                                                        )}
                                                    </div>
                                                );
                                            })()}
                                        </div>
                                    );
                                }) : (
                                    <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                                        No member list available.
                                    </div>
                                )}
                            </div>
                        </div>

                        <button className="members-modal-close-btn" style={{ marginTop: '10px' }} onClick={() => {
                            setShowGroupInfoModal(false);
                            setIsAddingMember(false);
                        }}>
                            Close
                        </button>
                    </div>
                </div>
            )}

            {/* Add Member / Copy Invite Link Modal */}
            <AddMember
                isOpen={showAddMemberModal}
                onClose={() => setShowAddMemberModal(false)}
                groupName={activeItem.name}
                groupIcon={activeItem.icon || '👥'}
                groupColor={activeItem.color || 'var(--active-item-border)'}
                inviteLink={`${window.location.origin}/join/${activeId}`}
                onCopy={() => {
                    if (toastTimeoutRef.current) {
                        clearTimeout(toastTimeoutRef.current);
                    }
                    setToastMessage(`Invite link for "${activeItem.name}" copied to clipboard!`);
                    toastTimeoutRef.current = setTimeout(() => {
                        setToastMessage(null);
                    }, 3000);
                }}
            />

            {/* Telegram-style Invite Join Preview Modal */}
            {joinPreviewGroupId && (() => {
                const previewItem =
                    studyGroups.find(g => g.id === joinPreviewGroupId) ||
                    classrooms.find(c => c.id === joinPreviewGroupId);
                if (!previewItem) return null;
                const isMember = previewItem.members?.includes(currentUser.id) || previewItem.isClassroom;

                const handleJoinAction = () => {
                    if (isMember) {
                        // Enter Chat directly
                        setActiveId(joinPreviewGroupId);
                        setJoinPreviewGroupId(null);
                        if (toastTimeoutRef.current) {
                            clearTimeout(toastTimeoutRef.current);
                        }
                        setToastMessage(`Switched to "${previewItem.name}" chat room!`);
                        toastTimeoutRef.current = setTimeout(() => {
                            setToastMessage(null);
                        }, 2500);
                    } else {
                        // Send simulated join request (as requested: "if u are new to the group you request and join the group")
                        setJoinRequestState('sending');

                        setTimeout(() => {
                            setJoinRequestState('approved');

                            // Add member in state
                            setStudyGroups(prev =>
                                prev.map(g => {
                                    if (g.id === joinPreviewGroupId) {
                                        return {
                                            ...g,
                                            members: [...(g.members || []), currentUser.id]
                                        };
                                    }
                                    return g;
                                })
                            );

                            // Post join request system message
                            setMessagesByGroup(prev => ({
                                ...prev,
                                [joinPreviewGroupId]: [
                                    ...(prev[joinPreviewGroupId] || []),
                                    { id: `sys-joined-req-${Date.now()}`, type: 'system', text: `${currentUser.name} joined the group via join request` }
                                ]
                            }));

                            // Switch after approval notification animation finishes
                            setTimeout(() => {
                                setActiveId(joinPreviewGroupId);
                                setJoinPreviewGroupId(null);
                                setJoinRequestState(null);

                                if (toastTimeoutRef.current) {
                                    clearTimeout(toastTimeoutRef.current);
                                }
                                setToastMessage(`Join request approved! Entered "${previewItem.name}" chat room.`);
                                toastTimeoutRef.current = setTimeout(() => {
                                    setToastMessage(null);
                                }, 3000);
                            }, 800);

                        }, 1500);
                    }
                };

                return (
                    <div className="create-group-modal-overlay" onClick={() => !joinRequestState && setJoinPreviewGroupId(null)}>
                        <div className="members-list-modal" style={{ width: '380px' }} onClick={(e) => e.stopPropagation()}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px' }}>
                                <div className="header-avatar" style={{ width: '64px', height: '64px', fontSize: '24px', borderRadius: '50%', backgroundColor: previewItem.color || 'var(--active-item-border)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '10px' }}>
                                    {previewItem.icon || previewItem.name.substring(0, 2).toUpperCase()}
                                </div>
                                <h3 style={{ margin: '0 0 4px 0', fontSize: '19px', fontWeight: '700' }}>{previewItem.name}</h3>
                                <p style={{ margin: 0, fontSize: '12.5px', color: 'var(--text-muted)' }}>
                                    {previewItem.members ? `${previewItem.members.length} members` : 'Classroom channel'}
                                </p>
                            </div>

                            <div style={{ marginBottom: '24px', textAlign: 'center' }}>
                                <label className="field-label-text" style={{ display: 'block', textAlign: 'center' }}>About Group</label>
                                <p style={{ fontSize: '13.5px', color: 'var(--text-main)', margin: '6px 0 0 0', lineHeight: '1.45' }}>
                                    {previewItem.subtitle || 'No description set for this group.'}
                                </p>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                <button
                                    className="members-modal-close-btn"
                                    onClick={handleJoinAction}
                                    disabled={joinRequestState !== null}
                                >
                                    {isMember ? (
                                        'Enter Chat'
                                    ) : (
                                        joinRequestState === null ? 'Request to Join Group' :
                                            joinRequestState === 'sending' ? 'Sending Request... ⏳' :
                                                'Request Approved! Entering... 🎉'
                                    )}
                                </button>
                                <button
                                    className="add-member-close-btn"
                                    onClick={() => setJoinPreviewGroupId(null)}
                                    disabled={joinRequestState !== null}
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                );
            })()}

            {/* Telegram File Upload Dialog Modal */}
            {showUploadOptionModal && pendingFiles.length > 0 && (
                <div className="create-group-modal-overlay" onClick={() => {
                    setShowUploadOptionModal(false);
                    setPendingFiles([]);
                }}>
                    <div className="members-list-modal" style={{ width: '380px' }} onClick={(e) => e.stopPropagation()}>
                        <div className="members-modal-header" style={{ marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
                            <h3 style={{ fontSize: '18px', fontWeight: '700', margin: '0 0 4px 0' }}>Send Files</h3>
                            <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', margin: 0 }}>
                                Select how you want to send {pendingFiles.length} file{pendingFiles.length > 1 ? 's' : ''}
                            </p>
                        </div>

                        {/* Selected files preview list */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '180px', overflowY: 'auto', marginBottom: '20px', paddingRight: '4px' }}>
                            {pendingFiles.map((file, idx) => (
                                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', backgroundColor: 'var(--search-bg)', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
                                    <div style={{ fontSize: '20px', width: '34px', height: '34px', backgroundColor: 'var(--sidebar-bg)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
                                        {getFileIcon(file.name)}
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                                        <div style={{ fontSize: '12.5px', fontWeight: '600', color: 'var(--text-main)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                                            {file.name}
                                        </div>
                                        <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', marginTop: '1px' }}>
                                            {formatBytes(file.size)}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Upload Options buttons */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <button
                                className="members-modal-close-btn"
                                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                                onClick={() => handleSendPendingFiles('document')}
                            >
                                <FileText size={16} /> Send as Documents
                            </button>

                            {pendingFiles.some(f => f.type.startsWith('image/')) && (
                                <button
                                    className="members-modal-close-btn"
                                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', backgroundColor: '#0d9488' }}
                                    onClick={() => handleSendPendingFiles('compressed')}
                                >
                                    <Image size={16} /> Send Compressed
                                </button>
                            )}

                            {pendingFiles.length > 1 && (
                                <button
                                    className="members-modal-close-btn"
                                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', backgroundColor: '#8b5cf6' }}
                                    onClick={() => handleSendPendingFiles('grouped')}
                                >
                                    <FolderArchive size={16} /> Send Grouped (As Album)
                                </button>
                            )}

                            <button
                                className="add-member-close-btn"
                                onClick={() => {
                                    setShowUploadOptionModal(false);
                                    setPendingFiles([]);
                                }}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Create Topic Modal */}
            <Topic
                isOpen={showCreateTopicModal}
                onClose={() => setShowCreateTopicModal(false)}
                userProfiles={USER_PROFILES}
                invitedMembers={activeItem.members ? activeItem.members.filter(m => m !== currentUser.id) : ['at', 'yb']}
                onCreate={(topicName) => {
                    const targetGroupKey = selectedGroupIdForTopics || activeId;

                    apiFetch(`${API_BASE_URL}/chat/groups/${targetGroupKey}/topics`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            name: topicName,
                            color: '#0d9488'
                        })
                    })
                    .then(res => {
                        if (!res.ok) {
                            return res.json().then(err => { throw new Error(err.message || 'Failed to create topic'); });
                        }
                        return res.json();
                    })
                    .then(topic => {
                        const tId = topic.slug || topic.id;
                        const timeString = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                        setTopicsByGroup(prev => {
                            const currentTopics = prev[targetGroupKey] || [];
                            if (currentTopics.some(t => t.id === tId)) return prev;
                            return {
                                ...prev,
                                [targetGroupKey]: [
                                    ...currentTopics,
                                    { id: tId, name: topic.name, icon: '#', color: '#0d9488', subtitle: 'Topic created', time: timeString }
                                ]
                            };
                        });
                        setMessagesByGroup(prev => ({
                            ...prev,
                            [`${targetGroupKey}-${tId}`]: [
                                { id: `sys-topic-${Date.now()}`, type: 'system', text: `Topic "${topicName}" created` }
                            ]
                        }));
                        setActiveTopicId(tId);
                        setCreatedTopicName(topicName);
                        if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
                        setToastMessage(`Topic "${topicName}" created!`);
                        toastTimeoutRef.current = setTimeout(() => setToastMessage(null), 2500);
                    })
                    .catch(err => {
                        if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
                        setToastMessage(err.message || 'Failed to create topic');
                        toastTimeoutRef.current = setTimeout(() => setToastMessage(null), 3000);
                    });
                }}
            />

            {/* Send Invitation Modal — shown after group creation confirm */}
            <SendInvitation
                isOpen={showSendInvitationModal}
                onClose={() => setShowSendInvitationModal(false)}
                topicName={createdTopicName}
                invitedMembers={activeItem.members ? activeItem.members.filter(m => m !== currentUser.id) : []}
                userProfiles={USER_PROFILES}
                onSend={() => {
                    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
                    setToastMessage(`Group invitations sent!`);
                    toastTimeoutRef.current = setTimeout(() => setToastMessage(null), 3000);
                }}
            />

            {/* Incoming Study Invitation Modal */}
            <StudyInvitation
                isOpen={invitationData.isOpen}
                onClose={() => setInvitationData(prev => ({ ...prev, isOpen: false }))}
                inviterName={invitationData.inviterName}
                inviterInitials={invitationData.inviterInitials}
                topicName={invitationData.topicName}
                categoryName={invitationData.categoryName}
                onJoin={() => {
                    setActiveId(invitationData.groupId);
                    setSelectedGroupIdForTopics(invitationData.groupId);
                    setActiveTopicId('general');
                    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
                    setToastMessage(`Joined study session: "${invitationData.topicName}"!`);
                    toastTimeoutRef.current = setTimeout(() => setToastMessage(null), 3000);
                }}
                onDecline={() => {
                    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
                    setToastMessage("Study invitation declined");
                    toastTimeoutRef.current = setTimeout(() => setToastMessage(null), 3000);
                }}
            />
        </div>
    );
}

export default Chat;
