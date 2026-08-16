import React, { useState, useEffect, useRef } from 'react';
import { Sun, Moon, X, Search, ArrowLeft, Plus, BookOpen, Menu, UserPlus, Link, Check, CheckCheck, Paperclip, Send, Smile, Copy, Pencil, Trash2, Reply, Forward, Info, FileText, Image, FolderArchive, MessageSquare } from 'lucide-react';
import './chat.css';
import CreateGroup from '../../components/layout/create_group/create_group';
import AddMember from '../../components/layout/add_member/add_member';
import Topic from '../../components/layout/topic/topic';
import SendInvitation from '../../components/layout/send_invitation/send_invitation';
import StudyInvitation from '../../components/layout/study_invitation/study_invitation';

const CURATED_EMOJIS = ['😄', '😂', '👍', '❤️', '🔥', '💪', '✅', '🎨', '💻', '🚀', '📚', '📝', '💡', '👑', '🌟', '👏', '🎉', '👋'];

const USER_PROFILES = {
    'gs': { name: 'Gelila Sintayehu', initials: 'GS', avatarBg: '#3b82f6', online: true },
    'at': { name: 'Fanuel Goitom', initials: 'FG', avatarBg: '#8b5cf6', online: true },
    'yb': { name: 'Yonas Bekele', initials: 'YB', avatarBg: '#0d9488', online: true },
    'mh': { name: 'Meron Haile', initials: 'MH', avatarBg: '#f97316', online: false },
    'ta': { name: 'Tigist Alemu', initials: 'TA', avatarBg: '#a855f7', online: true }
};

function Chat({
    hideSidebar = false,
    activeId: propActiveId,
    setActiveId: propSetActiveId,
    showCreateGroupDirectly = false,
    onCloseCreateGroupDirectly,
    studyGroups: propStudyGroups,
    setStudyGroups: propSetStudyGroups,
    darkMode: propDarkMode,
    setDarkMode: propSetDarkMode
}) {
    const [localDarkMode, setLocalDarkMode] = useState(false);
    const darkMode = propDarkMode !== undefined ? propDarkMode : localDarkMode;
    const setDarkMode = propSetDarkMode !== undefined ? propSetDarkMode : setLocalDarkMode;
    const [searchQuery, setSearchQuery] = useState('');

    const [localActiveId, setLocalActiveId] = useState('widget-kings');
    const activeId = propActiveId !== undefined ? propActiveId : localActiveId;
    const setActiveId = propSetActiveId !== undefined ? propSetActiveId : setLocalActiveId;

    const [inputValue, setInputValue] = useState('');
    const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

    // Rich Interactive States
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [attachedImage, setAttachedImage] = useState(null);
    const [showAddModal, setShowAddModal] = useState({ open: false, type: 'group' });
    const [newGroupName, setNewGroupName] = useState('');
    const [newGroupDesc, setNewGroupDesc] = useState('');
    const [typingUser, setTypingUser] = useState(null);
    const [editingMessageId, setEditingMessageId] = useState(null);
    const [toastMessage, setToastMessage] = useState(null);
    const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0, message: null });
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

    const [topicsByGroup, setTopicsByGroup] = useState({
        'widget-kings': [
            { id: 'general', name: 'General', icon: '#', color: '#64748b', subtitle: 'You: Perfect, that leaves me UI patch and...', time: 'Mon' },
            { id: 'project', name: 'Project', icon: 'P', color: '#ef4444', subtitle: 'Lala G: In addition to this next to the .jsx file...', time: '9:18 PM' },
            { id: 'profile', name: 'profile', icon: 'p', color: '#f97316', subtitle: 'Fikrte: Fikrte Gebretsadkan CTC-5776-26', time: 'Fri' },
            { id: 'resources', name: 'Resources', icon: 'R', color: '#10b981', subtitle: 'Lala G: Here is flutte11e ppt', time: 'Thu' },
            { id: 'tools', name: 'Tools', icon: 'T', color: '#84cc16', subtitle: 'Lala G: this is base 44, used to give you...', time: 'Tue' },
            { id: 'daily-challenges', name: 'Daily challenges', icon: 'D', color: '#be185d', subtitle: 'Fikrte: 📷 Photo', time: '8/1/2026' }
        ],
        'vd': [
            { id: 'general', name: 'General', icon: '#', color: '#64748b', subtitle: 'No messages yet', time: '' }
        ],
        'packages': [
            { id: 'general', name: 'General', icon: '#', color: '#64748b', subtitle: 'No messages yet', time: '' }
        ]
    });

    // Refs
    const conversationPaneRef = useRef(null);
    const fileInputRef = useRef(null);
    const prevActiveIdRef = useRef(activeId);
    const toastTimeoutRef = useRef(null);

    // Mock list of Classrooms
    const [classrooms, setClassrooms] = useState([
        { id: 'flutter', name: 'Flutter', subtitle: 'Samuel: Post your lifecycle qu...', isClassroom: true, time: '1:56 PM' },
        { id: 'react-native', name: 'React Native', subtitle: 'Mobile development', isClassroom: true, time: '' }
    ]);

    // Mock list of Study Groups
    const [localStudyGroups, setLocalStudyGroups] = useState([
        { id: 'widget-kings', name: 'Widget Kings 👑', subtitle: 'Abebe: Deadline Sunday midni...', isClassroom: false, time: '2:54 PM', members: ['gs', 'at', 'yb'], icon: '🦋', color: '#6366f1' },
        { id: 'vd', name: 'vd', subtitle: 'No messages yet', isClassroom: false, time: '', members: ['gs'], icon: '💻', color: '#0d9488' },
        { id: 'packages', name: 'packages', subtitle: 'No messages yet', isClassroom: false, time: '', members: ['gs'], icon: '📚', color: '#06b6d4' }
    ]);
    const studyGroups = propStudyGroups !== undefined ? propStudyGroups : localStudyGroups;
    const setStudyGroups = propSetStudyGroups !== undefined ? propSetStudyGroups : setLocalStudyGroups;

    // Messages log by group/classroom ID
    const [messagesByGroup, setMessagesByGroup] = useState({
        'widget-kings-general': [
            { id: 'sys-1', type: 'system', text: 'Abebe Tadesse created the group "Widget Kings 👑"' },
            { id: 'sys-2', type: 'system', text: 'Gelila Sintayehu joined via invite link' },
            {
                id: 'msg-1',
                sender: 'Abebe Tadesse',
                initials: 'AT',
                avatarClass: 'at',
                text: "Alright squad, let's divide the project. I'll handle the widget tree architecture.",
                time: '2:14 PM',
                incoming: true,
                reactions: [
                    { emoji: '💪', count: 2, userReacted: false }
                ]
            },
            {
                id: 'msg-2',
                sender: 'Yonas Bekele',
                initials: 'YB',
                avatarClass: 'yb',
                text: "I can take state management — Redux vs Provider comparison.",
                time: '2:19 PM',
                incoming: true,
                reactions: [
                    { emoji: '👍', count: 1, userReacted: false }
                ]
            },
            {
                id: 'msg-3',
                sender: 'Gelila Sintayehu',
                initials: 'GS',
                avatarClass: 'gs',
                text: "Perfect, that leaves me UI polish and animations 🎨",
                time: '2:24 PM',
                incoming: false,
                reactions: [
                    { emoji: '🔥', count: 2, userReacted: false }
                ]
            },
            {
                id: 'msg-4',
                sender: 'Abebe Tadesse',
                initials: 'AT',
                avatarClass: 'at',
                text: "Deadline Sunday midnight. Sync Saturday 10am?",
                time: '2:54 PM',
                incoming: true,
                reactions: [
                    { emoji: '✅', count: 2, userReacted: false }
                ]
            }
        ],
        'widget-kings-project': [
            { id: 'sys-proj-1', type: 'system', text: 'Topic "Project" created' },
            {
                id: 'msg-proj-2',
                sender: 'Lala G',
                initials: 'LG',
                avatarBg: '#d97706',
                text: "In addition to this next to the .jsx file do not forget to create the .css file ...",
                time: '9:18 PM',
                incoming: true,
                reactions: []
            }
        ],
        'widget-kings-profile': [
            { id: 'sys-prof-1', type: 'system', text: 'Topic "profile" created' },
            {
                id: 'msg-prof-2',
                sender: 'Fikrte',
                initials: 'F',
                avatarBg: '#ea580c',
                text: "Fikrte Gebretsadkan CTC-5776-26",
                time: 'Fri',
                incoming: true,
                reactions: []
            }
        ],
        'widget-kings-resources': [
            { id: 'sys-res-1', type: 'system', text: 'Topic "Resources" created' },
            {
                id: 'msg-res-2',
                sender: 'Lala G',
                initials: 'LG',
                avatarBg: '#d97706',
                text: "Here is flutte11e ppt",
                time: 'Thu',
                incoming: true,
                reactions: []
            }
        ],
        'widget-kings-tools': [
            { id: 'sys-tool-1', type: 'system', text: 'Topic "Tools" created' },
            {
                id: 'msg-tool-2',
                sender: 'Lala G',
                initials: 'LG',
                avatarBg: '#d97706',
                text: "this is base 44, used to give you the ui of the website you like check it",
                time: 'Tue',
                incoming: true,
                reactions: []
            }
        ],
        'widget-kings-daily-challenges': [
            { id: 'sys-dc-1', type: 'system', text: 'Topic "Daily challenges" created' },
            {
                id: 'msg-dc-2',
                sender: 'Fikrte',
                initials: 'F',
                avatarBg: '#ea580c',
                text: "Daily challenge photo uploaded",
                image: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400&q=80",
                time: '8/1/2026',
                incoming: true,
                reactions: []
            }
        ],
        'flutter': [
            { id: 'sys-f1', type: 'system', text: 'Flutter Classroom started' },
            {
                id: 'msg-f2',
                sender: 'Samuel',
                initials: 'S',
                avatarClass: 'at',
                text: "Post your lifecycle questions here. We will discuss them in the live class.",
                time: '1:56 PM',
                incoming: true,
                reactions: []
            }
        ],
        'react-native': [
            { id: 'sys-rn1', type: 'system', text: 'Welcome to React Native Mobile development!' }
        ],
        'vd-general': [],
        'packages-general': []
    });

    // Active item and active messages key helpers
    const activeItem =
        studyGroups.find(g => g.id === activeId) ||
        classrooms.find(c => c.id === activeId) ||
        { name: 'Select Conversation', subtitle: '' };

    const activeMessagesKey = activeItem.isClassroom ? activeId : `${activeId}-${activeTopicId}`;
    const activeMessages = messagesByGroup[activeMessagesKey] || messagesByGroup[activeId] || [];

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
    }, [activeId]);

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
    const handleSendPendingFiles = (sendMode) => {
        const timeString = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        if (sendMode === 'grouped') {
            // Group all selected files as a single composite album/gallery message
            const promises = pendingFiles.map(file => {
                return new Promise((resolve) => {
                    const isImage = file.type.startsWith('image/');
                    const reader = new FileReader();

                    reader.onload = (e) => {
                        resolve({
                            name: file.name,
                            size: formatBytes(file.size),
                            icon: getFileIcon(file.name),
                            data: e.target.result,
                            isImage: true
                        });
                    };

                    if (isImage) {
                        reader.readAsDataURL(file);
                    } else {
                        resolve({
                            name: file.name,
                            size: formatBytes(file.size),
                            icon: getFileIcon(file.name),
                            data: null,
                            isImage: false
                        });
                    }
                });
            });

            Promise.all(promises).then(groupedItems => {
                const newMessage = {
                    id: `msg-group-${Date.now()}`,
                    sender: 'Gelila Sintayehu',
                    initials: 'GS',
                    avatarClass: 'gs',
                    type: 'grouped',
                    files: groupedItems,
                    time: timeString,
                    incoming: false,
                    reactions: []
                };

                setMessagesByGroup(prev => ({
                    ...prev,
                    [activeMessagesKey]: [...(prev[activeMessagesKey] || []), newMessage]
                }));

                // Update sidebar preview
                const previewText = `sent ${pendingFiles.length} grouped files`;
                if (studyGroups.some(g => g.id === activeId)) {
                    setStudyGroups(prev =>
                        prev.map(g => (g.id === activeId ? { ...g, subtitle: `You: ${previewText}`, time: timeString } : g))
                    );
                    if (!activeItem.isClassroom) {
                        setTopicsByGroup(prev => {
                            const groupTopics = prev[activeId] || [];
                            const updated = groupTopics.map(t => (t.id === activeTopicId ? { ...t, subtitle: `You: ${previewText}`, time: timeString } : t));
                            return { ...prev, [activeId]: updated };
                        });
                    }
                } else if (classrooms.some(c => c.id === activeId)) {
                    setClassrooms(prev =>
                        prev.map(c => (c.id === activeId ? { ...c, subtitle: `You: ${previewText}`, time: timeString } : c))
                    );
                }
            });

        } else {
            // Send each file as an individual message (either compressed image bubble or document bubble)
            pendingFiles.forEach((file, index) => {
                const isImage = file.type.startsWith('image/');
                const reader = new FileReader();

                reader.onload = (e) => {
                    const newMessage = {
                        id: `msg-file-${Date.now()}-${index}`,
                        sender: 'Gelila Sintayehu',
                        initials: 'GS',
                        avatarClass: 'gs',
                        time: timeString,
                        incoming: false,
                        reactions: []
                    };

                    if (isImage && sendMode === 'compressed') {
                        newMessage.image = e.target.result;
                        newMessage.text = '';
                    } else {
                        newMessage.type = 'document';
                        newMessage.fileName = file.name;
                        newMessage.fileSize = formatBytes(file.size);
                        newMessage.fileIcon = getFileIcon(file.name);
                        newMessage.fileDataUrl = isImage ? e.target.result : null;
                    }

                    setMessagesByGroup(prev => ({
                        ...prev,
                        [activeMessagesKey]: [...(prev[activeMessagesKey] || []), newMessage]
                    }));

                    // Update sidebar preview
                    const previewText = newMessage.image ? '📷 Image attachment' : `📄 ${file.name}`;
                    if (studyGroups.some(g => g.id === activeId)) {
                        setStudyGroups(prev =>
                            prev.map(g => (g.id === activeId ? { ...g, subtitle: `You: ${previewText}`, time: timeString } : g))
                        );
                        if (!activeItem.isClassroom) {
                            setTopicsByGroup(prev => {
                                const groupTopics = prev[activeId] || [];
                                const updated = groupTopics.map(t => (t.id === activeTopicId ? { ...t, subtitle: `You: ${previewText}`, time: timeString } : t));
                                return { ...prev, [activeId]: updated };
                            });
                        }
                    } else if (classrooms.some(c => c.id === activeId)) {
                        setClassrooms(prev =>
                            prev.map(c => (c.id === activeId ? { ...c, subtitle: `You: ${previewText}`, time: timeString } : c))
                        );
                    }
                };

                if (isImage) {
                    reader.readAsDataURL(file);
                } else {
                    // Instantly trigger for non-images
                    const newMessage = {
                        id: `msg-file-${Date.now()}-${index}`,
                        sender: 'Gelila Sintayehu',
                        initials: 'GS',
                        avatarClass: 'gs',
                        time: timeString,
                        incoming: false,
                        reactions: [],
                        type: 'document',
                        fileName: file.name,
                        fileSize: formatBytes(file.size),
                        fileIcon: getFileIcon(file.name),
                        fileDataUrl: null
                    };
                    setMessagesByGroup(prev => ({
                        ...prev,
                        [activeMessagesKey]: [...(prev[activeMessagesKey] || []), newMessage]
                    }));

                    const previewText = `📄 ${file.name}`;
                    if (studyGroups.some(g => g.id === activeId)) {
                        setStudyGroups(prev =>
                            prev.map(g => (g.id === activeId ? { ...g, subtitle: `You: ${previewText}`, time: timeString } : g))
                        );
                        if (!activeItem.isClassroom) {
                            setTopicsByGroup(prev => {
                                const groupTopics = prev[activeId] || [];
                                const updated = groupTopics.map(t => (t.id === activeTopicId ? { ...t, subtitle: `You: ${previewText}`, time: timeString } : t));
                                return { ...prev, [activeId]: updated };
                            });
                        }
                    } else if (classrooms.some(c => c.id === activeId)) {
                        setClassrooms(prev =>
                            prev.map(c => (c.id === activeId ? { ...c, subtitle: `You: ${previewText}`, time: timeString } : c))
                        );
                    }
                }
            });
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

            setEditingMessageId(null);
        } else {
            // Send new message
            const newMessage = {
                id: `msg-${Date.now()}`,
                sender: 'Gelila Sintayehu',
                initials: 'GS',
                avatarClass: 'gs',
                text: inputValue,
                time: timeString,
                incoming: false,
                reactions: []
            };

            if (attachedImage) {
                newMessage.image = attachedImage;
            }

            // Quoted Reply Details
            if (replyingTo) {
                newMessage.replyTo = {
                    id: replyingTo.id,
                    sender: replyingTo.sender,
                    text: replyingTo.text
                };
            }

            // Update messages log
            setMessagesByGroup(prev => ({
                ...prev,
                [activeMessagesKey]: [...(prev[activeMessagesKey] || []), newMessage]
            }));

            // Update time and preview in the sidebar
            const previewText = attachedImage ? '📷 Image attachment' : inputValue;
            if (studyGroups.some(g => g.id === activeId)) {
                setStudyGroups(prev =>
                    prev.map(g => (g.id === activeId ? { ...g, subtitle: `You: ${previewText}`, time: timeString } : g))
                );
                if (!activeItem.isClassroom) {
                    setTopicsByGroup(prev => {
                        const groupTopics = prev[activeId] || [];
                        const updated = groupTopics.map(t => (t.id === activeTopicId ? { ...t, subtitle: `You: ${previewText}`, time: timeString } : t));
                        return { ...prev, [activeId]: updated };
                    });
                }
            } else if (classrooms.some(c => c.id === activeId)) {
                setClassrooms(prev =>
                    prev.map(c => (c.id === activeId ? { ...c, subtitle: `You: ${previewText}`, time: timeString } : c))
                );
            }
        }

        setInputValue('');
        setAttachedImage(null);
        setShowEmojiPicker(false);
        setReplyingTo(null);
    };

    // Handle deleting a message
    const handleDeleteMessage = (messageId) => {
        setMessagesByGroup(prev => {
            const activeMessagesList = prev[activeMessagesKey] || [];
            const filteredMessages = activeMessagesList.filter(msg => msg.id !== messageId);
            return {
                ...prev,
                [activeMessagesKey]: filteredMessages
            };
        });

        // Update sidebar preview to "Message deleted" if it was the last preview
        setMessagesByGroup(current => {
            const activeMessagesList = current[activeMessagesKey] || [];
            const wasLastMessage = activeMessagesList.length > 0 && activeMessagesList[activeMessagesList.length - 1].id === messageId;
            if (wasLastMessage) {
                const textPreview = 'Message deleted';
                if (studyGroups.some(g => g.id === activeId)) {
                    setStudyGroups(prev =>
                        prev.map(g => (g.id === activeId ? { ...g, subtitle: textPreview } : g))
                    );
                    if (!activeItem.isClassroom) {
                        setTopicsByGroup(prev => {
                            const groupTopics = prev[activeId] || [];
                            const updated = groupTopics.map(t => (t.id === activeTopicId ? { ...t, subtitle: textPreview } : t));
                            return { ...prev, [activeId]: updated };
                        });
                    }
                } else if (classrooms.some(c => c.id === activeId)) {
                    setClassrooms(prev =>
                        prev.map(c => (c.id === activeId ? { ...c, subtitle: textPreview } : c))
                    );
                }
            }
            return current;
        });
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
        const newForwardMsg = {
            id: `msg-${Date.now()}`,
            sender: 'Gelila Sintayehu',
            initials: 'GS',
            avatarClass: 'gs',
            text: forwardingMessage.text,
            image: forwardingMessage.image,
            time: timeString,
            incoming: false,
            reactions: [],
            forwardedFrom: forwardingMessage.sender
        };

        setMessagesByGroup(prev => ({
            ...prev,
            [targetChannelId]: [...(prev[targetChannelId] || []), newForwardMsg]
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

        setForwardingMessage(null);

        // Display toast notice
        if (toastTimeoutRef.current) {
            clearTimeout(toastTimeoutRef.current);
        }
        setToastMessage(`Message forwarded to "${targetItem?.name}"!`);
        toastTimeoutRef.current = setTimeout(() => {
            setToastMessage(null);
        }, 3000);
    };

    // Copy to clipboard from context menu
    const handleCopyMessageText = (msg) => {
        if (!msg.text) return;
        navigator.clipboard.writeText(msg.text)
            .then(() => {
                if (toastTimeoutRef.current) {
                    clearTimeout(toastTimeoutRef.current);
                }
                setToastMessage('Message copied to clipboard!');
                toastTimeoutRef.current = setTimeout(() => {
                    setToastMessage(null);
                }, 2000);
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
        const addedText = `Gelila Sintayehu added ${addedUser?.name || memberId} to the group`;

        setMessagesByGroup(prev => ({
            ...prev,
            [activeId]: [
                ...(prev[activeId] || []),
                { id: `sys-added-${Date.now()}`, type: 'system', text: addedText }
            ]
        }));

        if (toastTimeoutRef.current) {
            clearTimeout(toastTimeoutRef.current);
        }
        setToastMessage(`${addedUser?.name} added to the group!`);
        toastTimeoutRef.current = setTimeout(() => {
            setToastMessage(null);
        }, 3000);
    };

    // Render message text with clickable URL links
    const renderMessageText = (text, isIncoming) => {
        if (!text) return null;

        const urlRegex = /(https?:\/\/[^\s]+|classmind\.app\/invite\/[^\s]+|localhost:\d+\/join\/[^\s]+|[^\s]+\.com[^\s]*)/gi;
        const parts = text.split(urlRegex);

        if (parts.length === 1) return <div>{text}</div>;

        // Dynamic link color based on incoming vs outgoing bubble legibility
        const linkColor = isIncoming
            ? (darkMode ? '#60a5fa' : '#2563eb')
            : '#ffffff';

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
                    return part;
                })}
            </div>
        );
    };

    // Toggle emoji reactions (clicked on reaction badge under message bubble)
    const handleReactionClick = (messageId, emojiIndex) => {
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
    };

    // Add a quick reaction emoji directly if not already present (from hover bar)
    const handleAddEmojiReaction = (messageId, emoji) => {
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
    };

    // Handle creating a new study group or classroom
    const handleCreateItem = () => {
        if (!newGroupName.trim()) return;

        const itemId = newGroupName.toLowerCase().replace(/\s+/g, '-');
        const descText = newGroupDesc.trim() || 'No messages yet';

        if (showAddModal.type === 'classroom') {
            const newClassroomObj = {
                id: itemId,
                name: newGroupName,
                subtitle: descText,
                isClassroom: true,
                time: ''
            };
            setClassrooms(prev => [...prev, newClassroomObj]);
            setMessagesByGroup(prev => ({
                ...prev,
                [itemId]: [{ id: `sys-${Date.now()}`, type: 'system', text: `Classroom "${newGroupName}" created` }]
            }));
            setActiveId(itemId);
        } else {
            const newGroupObj = {
                id: itemId,
                name: newGroupName,
                subtitle: descText,
                isClassroom: false,
                time: '',
                members: ['gs'],
                icon: '👥',
                color: '#8b5cf6'
            };
            setStudyGroups(prev => [...prev, newGroupObj]);
            setMessagesByGroup(prev => ({
                ...prev,
                [`${itemId}-general`]: [{ id: `sys-${Date.now()}`, type: 'system', text: `You created the group "${newGroupName}"` }]
            }));
            setTopicsByGroup(prev => ({
                ...prev,
                [itemId]: [{ id: 'general', name: 'General', icon: '#', color: '#64748b', subtitle: 'You created group', time: '' }]
            }));
            setSelectedGroupIdForTopics(itemId);
            setActiveTopicId('general');
            setActiveId(itemId);
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
                    <span>🔗</span>
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
                                GS
                                <span className="online-dot"></span>
                            </div>
                            <div className="profile-details">
                                <span className="profile-name">Gelila Sintayehu</span>
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
                                    {/* Topic Group Header */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 14px', borderBottom: '1px solid var(--border-color)', marginBottom: '8px' }}>
                                        <button
                                            onClick={() => setSelectedGroupIdForTopics(null)}
                                            style={{ background: 'none', border: 'none', color: 'var(--text-main)', cursor: 'pointer', fontSize: '18px', padding: '4px', display: 'flex', alignItems: 'center' }}
                                            title="Back to Chats"
                                        >
                                            <ArrowLeft size={18} />
                                        </button>
                                        <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                                            <div style={{ fontSize: '14.5px', fontWeight: '700', color: 'var(--text-main)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                                                {activeGrp.name}
                                            </div>
                                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                                {activeGrp.members ? activeGrp.members.length : 1} members
                                            </div>
                                        </div>
                                        <button
                                            className="add-group-btn"
                                            onClick={() => setShowCreateTopicModal(true)}
                                            title="Create Topic"
                                        >
                                            <Plus size={16} />
                                        </button>
                                    </div>

                                    {/* List of topics */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                        {topics.map(t => (
                                            <div
                                                key={t.id}
                                                className={`sidebar-item ${activeTopicId === t.id ? 'active' : ''}`}
                                                onClick={() => {
                                                    setActiveTopicId(t.id);
                                                    setMobileSidebarOpen(false);
                                                }}
                                                style={{ padding: '8px 12px', borderRadius: '12px' }}
                                            >
                                                <div
                                                    className="item-avatar"
                                                    style={{
                                                        background: t.color || '#64748b',
                                                        width: '38px',
                                                        height: '38px',
                                                        fontSize: '14px',
                                                        borderRadius: '50%',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        color: 'white',
                                                        fontWeight: '700',
                                                        boxShadow: 'none'
                                                    }}
                                                >
                                                    {t.icon}
                                                </div>
                                                <div className="item-text-container" style={{ marginLeft: '10px' }}>
                                                    <div className="item-title-row">
                                                        <span className="item-title" style={{ fontSize: '13.5px', fontWeight: '700' }}>{t.name}</span>
                                                        {t.time && <span className="item-time" style={{ fontSize: '10.5px' }}>{t.time}</span>}
                                                    </div>
                                                    <span className="item-subtitle" style={{ fontSize: '12px', color: 'var(--text-muted)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', display: 'block' }}>
                                                        {t.subtitle}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
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
                                        <div className="item-text-container">
                                            <div className="item-title-row">
                                                <span className="item-title">{g.name}</span>
                                                {g.time && <span className="item-time">{g.time}</span>}
                                            </div>
                                            <span className="item-subtitle">{g.subtitle}</span>
                                        </div>
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
                            <span className="header-title">{activeItem.name}</span>
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
                            <button className="invite-btn" title="Create Study Topic" onClick={() => setShowCreateTopicModal(true)} style={{ marginRight: '8px' }}>
                                <BookOpen size={18} />
                            </button>
                        )}
                        <button className="invite-btn" title="Copy Invite Link" onClick={() => setShowAddMemberModal(true)}>
                            <Link size={18} />
                        </button>
                    </div>
                </div>

                {/* Conversation Message Pane */}
                <div className="conversation-pane" ref={conversationPaneRef}>
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
                                    className={`message-row ${msg.incoming ? 'incoming' : 'outgoing'}`}
                                    onContextMenu={(e) => handleContextMenu(e, msg)}
                                >
                                    {msg.incoming && (
                                        <div className={`message-avatar ${msg.avatarClass}`}>
                                            {msg.initials}
                                        </div>
                                    )}
                                    <div className="message-content-wrapper">
                                        {/* Hover Quick-Reaction Bar */}
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

                                        {msg.incoming && (
                                            <span className={`sender-name ${msg.sender.startsWith('Abebe') ? 'abebe' : 'yonas'}`}>
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
                                            {msg.text && renderMessageText(msg.text, msg.incoming)}
                                            {msg.image && (
                                                <img
                                                    src={msg.image}
                                                    alt="attachment"
                                                    className="message-image"
                                                    onClick={() => {
                                                        const w = window.open();
                                                        w.document.write(`<img src="${msg.image}" style="max-width:100%; max-height:100%; display:block; margin:auto;" />`);
                                                    }}
                                                />
                                            )}

                                            {/* Document Attachment bubble */}
                                            {msg.type === 'document' && (
                                                <div className="document-attachment-card" style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px', backgroundColor: msg.incoming ? 'var(--search-bg)' : 'rgba(255,255,255,0.15)', borderRadius: '12px', marginTop: '6px', border: '1px solid var(--border-color)', minWidth: '220px' }}>
                                                    <div style={{ fontSize: '24px', backgroundColor: 'var(--sidebar-bg)', width: '42px', height: '42px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 5px rgba(0,0,0,0.1)' }}>
                                                        {msg.fileIcon || '📄'}
                                                    </div>
                                                    <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', textAlign: 'left' }}>
                                                        <span className="file-name" style={{ fontSize: '13px', fontWeight: '600', color: msg.incoming ? 'var(--text-main)' : '#ffffff', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                                                            {msg.fileName}
                                                        </span>
                                                        <span className="file-size" style={{ fontSize: '11px', color: msg.incoming ? 'var(--text-muted)' : 'rgba(255,255,255,0.7)', marginTop: '2px' }}>
                                                            {msg.fileSize}
                                                        </span>
                                                    </div>
                                                    {msg.fileDataUrl ? (
                                                        <a href={msg.fileDataUrl} download={msg.fileName} style={{ fontSize: '18px', color: msg.incoming ? 'var(--active-item-border)' : '#ffffff', cursor: 'pointer', textDecoration: 'none' }}>
                                                            📥
                                                        </a>
                                                    ) : (
                                                        <span style={{ fontSize: '18px', opacity: 0.6, cursor: 'default' }}>
                                                            📄
                                                        </span>
                                                    )}
                                                </div>
                                            )}

                                            {/* Grouped album gallery attachments bubble */}
                                            {msg.type === 'grouped' && msg.files && (
                                                <div className="grouped-attachments-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '8px', marginTop: '6px', minWidth: '240px' }}>
                                                    {msg.files.map((file, idx) => (
                                                        <div key={idx} style={{ display: 'flex', flexDirection: 'column', padding: '8px', backgroundColor: msg.incoming ? 'var(--search-bg)' : 'rgba(255,255,255,0.15)', borderRadius: '12px', border: '1px solid var(--border-color)', overflow: 'hidden', textAlign: 'left' }}>
                                                            {file.isImage && file.data ? (
                                                                <img src={file.data} alt={file.name} style={{ width: '100%', height: '80px', objectFit: 'cover', borderRadius: '8px', marginBottom: '6px', cursor: 'pointer' }} onClick={() => {
                                                                    const w = window.open();
                                                                    w.document.write(`<img src="${file.data}" style="max-width:100%; max-height:100%; display:block; margin:auto;" />`);
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
                                                        key={rIdx}
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
                        <button className="input-action-btn" title="Attach files" onClick={triggerFileSelect}>
                            <Paperclip size={20} />
                        </button>

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

                        {/* Send Button */}
                        <button
                            className="send-btn"
                            onClick={handleSendMessage}
                            disabled={!inputValue.trim() && !attachedImage}
                            title={editingMessageId ? "Update Message" : "Send Message"}
                        >
                            {editingMessageId ? (
                                <Check size={18} color="var(--active-item-border)" />
                            ) : (
                                <Send size={18} />
                            )}
                        </button>
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
                    const itemId = groupDetails.name.toLowerCase().replace(/\s+/g, '-');
                    const memberList = ['gs', ...groupDetails.members];
                    const newGroupObj = {
                        id: itemId,
                        name: `${groupDetails.icon} ${groupDetails.name}`,
                        subtitle: 'No messages yet',
                        isClassroom: false,
                        time: '',
                        members: memberList
                    };

                    const memberNames = groupDetails.members.map(mId => USER_PROFILES[mId]?.name || mId);
                    let joinedText = '';
                    if (memberNames.length > 0) {
                        if (memberNames.length === 1) {
                            joinedText = `Gelila Sintayehu added ${memberNames[0]} to the group`;
                        } else if (memberNames.length === 2) {
                            joinedText = `Gelila Sintayehu added ${memberNames[0]} and ${memberNames[1]} to the group`;
                        } else {
                            const last = memberNames.pop();
                            joinedText = `Gelila Sintayehu added ${memberNames.join(', ')}, and ${last} to the group`;
                        }
                    }

                    setStudyGroups(prev => [...prev, newGroupObj]);
                    setMessagesByGroup(prev => ({
                        ...prev,
                        [itemId]: [
                            { id: `sys-create-${Date.now()}`, type: 'system', text: `You created the study group "${groupDetails.name}"` },
                            ...(joinedText ? [{ id: `sys-added-${Date.now()}`, type: 'system', text: joinedText }] : [])
                        ]
                    }));
                    setActiveId(itemId);
                    setShowAddModal({ open: false, type: 'group' });
                    onCloseCreateGroupDirectly?.();
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
            {contextMenu.visible && (
                <div
                    className="custom-context-menu"
                    style={{ top: `${contextMenu.y}px`, left: `${contextMenu.x}px` }}
                    onClick={(e) => e.stopPropagation()}
                >
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
                            <h3 style={{ margin: '0 0 4px 0', fontSize: '20px', fontWeight: '700' }}>{activeItem.name}</h3>
                            <p style={{ margin: 0, fontSize: '12.5px', color: 'var(--text-muted)' }}>
                                {activeItem.members ? activeItem.members.length : 1} members · {
                                    activeItem.members ? activeItem.members.filter(m => USER_PROFILES[m]?.online).length : 1
                                } online
                            </p>
                        </div>

                        {/* Description & Invite Link Section */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '20px' }}>
                            {/* Description */}
                            <div>
                                <label className="field-label-text">Group Description</label>
                                <div style={{ fontSize: '13.5px', color: 'var(--text-main)', backgroundColor: 'var(--search-bg)', padding: '12px 16px', borderRadius: '12px', border: '1px solid var(--border-color)', marginTop: '6px', lineHeight: '1.45' }}>
                                    {activeItem.subtitle || "No description set for this group."}
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
                                            <span className={`member-role-badge ${memberId === 'gs' ? 'owner' : ''}`}>
                                                {memberId === 'gs' ? 'Owner' : 'Member'}
                                            </span>
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
                const isMember = previewItem.members?.includes('gs') || previewItem.isClassroom;

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
                                            members: [...(g.members || []), 'gs']
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
                                    { id: `sys-joined-req-${Date.now()}`, type: 'system', text: 'Gelila Sintayehu joined the group via join request' }
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
                invitedMembers={activeItem.members ? activeItem.members.filter(m => m !== 'gs') : ['at', 'yb']}
                onCreate={(topicName) => {
                    setCreatedTopicName(topicName);
                    setShowSendInvitationModal(true);
                }}
            />

            {/* Send Invitation Modal */}
            <SendInvitation
                isOpen={showSendInvitationModal}
                onClose={() => setShowSendInvitationModal(false)}
                topicName={createdTopicName}
                invitedMembers={activeItem.members ? activeItem.members.filter(m => m !== 'gs') : ['at', 'yb']}
                userProfiles={USER_PROFILES}
                onSend={(topicName) => {
                    const topicId = topicName.toLowerCase().replace(/\s+/g, '-');
                    const timeString = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                    const targetGroupKey = selectedGroupIdForTopics || activeId;
                    setTopicsByGroup(prev => ({
                        ...prev,
                        [targetGroupKey]: [
                            ...(prev[targetGroupKey] || []),
                            { id: topicId, name: topicName, icon: topicName[0].toUpperCase(), color: '#0d9488', subtitle: 'Topic created', time: timeString }
                        ]
                    }));

                    setMessagesByGroup(prev => ({
                        ...prev,
                        [`${targetGroupKey}-${topicId}`]: [
                            { id: `sys-topic-${Date.now()}`, type: 'system', text: `Gelila Sintayehu created the study topic: "${topicName}" and sent invitations!` }
                        ]
                    }));

                    setActiveTopicId(topicId);

                    if (toastTimeoutRef.current) {
                        clearTimeout(toastTimeoutRef.current);
                    }
                    setToastMessage(`Invitations sent for topic: "${topicName}"!`);
                    toastTimeoutRef.current = setTimeout(() => {
                        setToastMessage(null);
                    }, 3000);

                    // Simulate receiving an incoming invitation pop out
                    setTimeout(() => {
                        setShowStudyInvitationModal(true);
                    }, 1200);
                }}
            />

            {/* Incoming Study Invitation Modal */}
            <StudyInvitation
                isOpen={showStudyInvitationModal}
                onClose={() => setShowStudyInvitationModal(false)}
                inviterName="Gelila Sintayehu"
                inviterInitials="GS"
                topicName={createdTopicName || "StatefulWidget Lifecycle"}
                categoryName="Flutter · Widget Structure"
                onJoin={() => {
                    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
                    setToastMessage(`Joined study session: "${createdTopicName || 'StatefulWidget Lifecycle'}"!`);
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
