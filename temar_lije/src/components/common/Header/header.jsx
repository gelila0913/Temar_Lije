import React from 'react';
import './header.css';
import logo from '../../../assets/classmind-logo.png';
import { LayoutGrid, Sparkles, LogOut, MessageSquare, Sun, Moon } from 'lucide-react';

export default function Header({
    userName = "User",
    role = "Student",
    userInitials = "U",
    currentTab = "classrooms",
    onTabChange,
    onLogout,
    darkMode,
    setDarkMode
}) {
    return (
        <header className="classmind-header">
            <div className="header-left">
                <div className="logo-container">
                    <img src={logo} alt="ClassMind-Logo" className="logo-image" />
                    <span className="logo-text">ClassMind</span>
                </div>


                <nav className="header-nav">
                    <button
                        type="button"
                        className={`nav-item ${currentTab === 'classrooms' ? 'active' : ''}`}
                        onClick={() => onTabChange?.('classrooms')}
                    >
                        <LayoutGrid size={18} />
                        <span>Classrooms</span>
                    </button>

                    <button
                        type="button"
                        className={`nav-item ${currentTab === 'study-buddy' ? 'active' : ''}`}
                        onClick={() => onTabChange?.('study-buddy')}
                    >
                        <Sparkles size={18} />
                        <span>Study Buddy</span>
                    </button>
                </nav>
            </div>

            <div className="header-right">
                {setDarkMode !== undefined && (
                    <button
                        type="button"
                        className="theme-toggle-btn-header"
                        onClick={() => setDarkMode(!darkMode)}
                        title={darkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
                    >
                        {darkMode ? <Sun size={20} /> : <Moon size={20} />}
                    </button>
                )}
                <div className="user-profile">
                    <div className="avatar">
                        {userInitials}
                    </div>
                    <div className="user-info">
                        <span className="user-name">{userName}</span>
                        <span className="user-role">{role}</span>
                    </div>
                </div>

                <button
                    type="button"
                    className="logout-button"
                    onClick={onLogout}
                    title="Log Out"
                    aria-label="Log Out"
                >
                    <LogOut size={20} />
                </button>
            </div>
        </header>
    );
}
