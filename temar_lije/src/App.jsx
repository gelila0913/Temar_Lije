import React, { useState, useEffect } from 'react';
import Landingpage from './features/landing/landing.jsx';
import SignInPage from './features/auth/signin/signin.jsx';
import CreateAccountPage from './features/auth/create_account/create_account.jsx';
import ForgotPasswordPage from './features/auth/forgot_password/forgot_password.jsx';
import ResetPasswordPage from './features/auth/reset_password/reset_password.jsx';
import VerifyEmailPage from './features/auth/verify_email/verify_email.jsx';
import Classrooms from './features/classrooms/classrooms.jsx';
import ClassroomDetail from './features/classroom-detail/classroom_detail.jsx';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import { LiveClassProvider } from './context/LiveClassContext.jsx';
import LiveClassGlobalOverlay from './components/live-class/LiveClassGlobalOverlay.jsx';

function MainApp() {
  const { user, login, register, logout, isAuthenticated, isLoading } = useAuth();

  // Extract query params and tokens on initial load
  const [urlToken, setUrlToken] = useState(() => {
    return new URLSearchParams(window.location.search).get('token') || '';
  });

  // Track active screen: 'landing' | 'signin' | 'create_account' | 'forgot_password' | 'reset_password' | 'verify_email' | 'classrooms' | 'classroom_detail'
  const [currentScreen, setCurrentScreen] = useState(() => {
    const path = window.location.pathname;
    const search = window.location.search;
    if (path.includes('/oauth/callback')) return 'classrooms';
    if (path.includes('/join/')) {
      // Stash the invite id; chat.jsx consumes it once groups are loaded
      const inviteId = decodeURIComponent(path.split('/join/')[1].split('/')[0]);
      if (inviteId) {
        sessionStorage.setItem('pending_join_id', inviteId);
      }
      return localStorage.getItem('temar_user') ? 'classrooms' : 'signin';
    }
    if (path.includes('/verify-email')) return 'verify_email';
    if (path.includes('/reset-password')) return 'reset_password';
    if (path.includes('/forgot-password')) return 'forgot_password';
    if (path.includes('/signup') || path.includes('/create-account')) return 'create_account';
    if (path.includes('/signin') || search.includes('error=oauth_failed')) return 'signin';
    return localStorage.getItem('temar_user') ? 'classrooms' : 'landing';
  });

  const [selectedClassroom, setSelectedClassroom] = useState(null);
  const [darkMode, setDarkMode] = useState(false);
  const [initialEmail, setInitialEmail] = useState('');
  const [authNotice, setAuthNotice] = useState('');

  useEffect(() => {
    if (darkMode) {
      document.body.classList.add('dark');
    } else {
      document.body.classList.remove('dark');
    }
  }, [darkMode]);

  // Handle OAuth callback resolution
  useEffect(() => {
    if (window.location.pathname.includes('/oauth/callback')) {
      if (!isLoading) {
        if (isAuthenticated) {
          setCurrentScreen('classrooms');
          window.history.replaceState({}, '', '/');
        } else {
          setCurrentScreen('signin');
          window.history.replaceState({}, '', '/signin?error=oauth_failed&message=Authentication%20failed');
        }
      }
    }
  }, [isAuthenticated, isLoading]);

  // Sync screen with auth state if user logs out or session expires
  useEffect(() => {
    if (!isLoading && !isAuthenticated && (currentScreen === 'classrooms' || currentScreen === 'classroom_detail')) {
      setCurrentScreen('landing');
    }
  }, [isAuthenticated, isLoading, currentScreen]);

  const handleSignIn = async ({ email, password }) => {
    await login({ email, password });
    setAuthNotice('');
    setCurrentScreen('classrooms');
    window.history.replaceState({}, '', '/');
  };

  const handleCreateAccount = async ({ fullName, role, email, password }) => {
    await register({ fullName, role, email, password, autoLogin: false });
    setInitialEmail(email);
    setAuthNotice('Registration successful. Please check your email to verify your account before signing in.');
    setCurrentScreen('signin');
    window.history.replaceState({}, '', '/signin');
  };

  const handleVerifyEmailSuccess = (msg) => {
    setAuthNotice(msg || 'Email verified successfully! You can now sign in.');
    setCurrentScreen('signin');
    window.history.replaceState({}, '', '/signin');
  };

  const handleResetPasswordSuccess = (result) => {
    if (result?.user) {
      setAuthNotice('');
      setCurrentScreen('classrooms');
      window.history.replaceState({}, '', '/');
    } else {
      setAuthNotice('Password reset successfully! Please sign in with your new password.');
      setCurrentScreen('signin');
      window.history.replaceState({}, '', '/signin');
    }
  };

  const handleLogout = async () => {
    await logout();
    setAuthNotice('');
    setCurrentScreen('landing');
    window.history.replaceState({}, '', '/');
  };

  const currentUser = user
    ? {
        id: user.id,
        name: user.fullName || 'User',
        role: user.role === 'TEACHER' ? 'Teacher' : 'Student',
        email: user.email,
        initials: user.initials
          || (user.fullName || '').trim().split(/\s+/).map(p => p[0]).join('').slice(0, 2).toUpperCase()
          || 'U',
        avatarBg: user.avatarBg || '#3b82f6',
      }
    : { name: 'User', role: 'Student' };

  return (
    <div>
      {currentScreen === 'landing' && (
        <Landingpage 
          onSignIn={() => {
            setAuthNotice('');
            setCurrentScreen('signin');
          }} 
          onStartTeaching={() => {
            setAuthNotice('');
            setCurrentScreen('create_account');
          }}
          onJoinClass={() => {
            setAuthNotice('');
            setCurrentScreen('create_account');
          }}
        />
      )}

      {currentScreen === 'signin' && (
        <SignInPage 
          onSignIn={handleSignIn}
          onBackToLanding={() => {
            setAuthNotice('');
            setCurrentScreen('landing');
          }} 
          onSwitchToCreateAccount={() => {
            setAuthNotice('');
            setCurrentScreen('create_account');
          }}
          onForgotPassword={() => {
            setAuthNotice('');
            setCurrentScreen('forgot_password');
          }}
          initialEmail={initialEmail}
          noticeMessage={authNotice}
        />
      )}

      {currentScreen === 'create_account' && (
        <CreateAccountPage 
          onCreateAccount={handleCreateAccount}
          onSwitchToSignIn={() => {
            setAuthNotice('');
            setCurrentScreen('signin');
          }} 
        />
      )}

      {currentScreen === 'forgot_password' && (
        <ForgotPasswordPage 
          onBackToSignIn={() => {
            setAuthNotice('');
            setCurrentScreen('signin');
          }}
        />
      )}

      {currentScreen === 'reset_password' && (
        <ResetPasswordPage 
          token={urlToken}
          onResetSuccess={handleResetPasswordSuccess}
          onBackToSignIn={() => {
            setAuthNotice('');
            setCurrentScreen('signin');
          }}
        />
      )}

      {currentScreen === 'verify_email' && (
        <VerifyEmailPage 
          token={urlToken}
          onVerified={() => handleVerifyEmailSuccess('Email verified successfully! You can now sign in.')}
          onGoToSignIn={(msg) => handleVerifyEmailSuccess(msg)}
        />
      )}

      {currentScreen === 'classrooms' && (
        <Classrooms 
          currentUser={currentUser}
          darkMode={darkMode}
          setDarkMode={setDarkMode}
          onSelectClassroom={(classroom) => {
            setSelectedClassroom(classroom);
            setCurrentScreen('classroom_detail');
          }}
          onLogout={handleLogout} 
        />
      )}

      {currentScreen === 'classroom_detail' && (
        <ClassroomDetail 
          currentUser={currentUser}
          darkMode={darkMode}
          setDarkMode={setDarkMode}
          classroom={selectedClassroom || { title: "Flutter", subject: "Widget · widget structure" }}
          onBackToClassrooms={() => setCurrentScreen('classrooms')}
          onLogout={handleLogout}
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <LiveClassProvider>
        <MainApp />
        <LiveClassGlobalOverlay />
      </LiveClassProvider>
    </AuthProvider>
  );
}
