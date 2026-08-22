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
import LiveClassNotification from './components/live-class/LiveClassNotification.jsx';

function MainApp() {
  const { user, login, register, logout, isAuthenticated, isLoading } = useAuth();

  // Extract query params and tokens
  const getUrlToken = () => new URLSearchParams(window.location.search).get('token') || '';
  const [urlToken, setUrlToken] = useState(getUrlToken);

  // Track active screen: 'landing' | 'signin' | 'create_account' | 'forgot_password' | 'reset_password' | 'verify_email' | 'classrooms' | 'classroom_detail'
  const determineScreenFromLocation = () => {
    const path = window.location.pathname;
    const search = window.location.search;
    if (path.includes('/oauth/callback')) return 'classrooms';
    if (path.includes('/join/')) {
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
    if (path.includes('/classrooms/') && path.split('/classrooms/')[1]) return 'classroom_detail';
    if (path.includes('/classrooms')) return 'classrooms';
    return localStorage.getItem('temar_user') ? 'classrooms' : 'landing';
  };

  const [currentScreen, setCurrentScreen] = useState(determineScreenFromLocation);

  const [selectedClassroom, setSelectedClassroom] = useState(() => {
    try {
      const saved = sessionStorage.getItem('temar_selected_classroom');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [darkMode, setDarkMode] = useState(false);
  const [initialEmail, setInitialEmail] = useState('');
  const [authNotice, setAuthNotice] = useState('');

  // Handle browser Back / Forward navigation (popstate)
  useEffect(() => {
    const handlePopState = () => {
      setUrlToken(getUrlToken());
      setCurrentScreen(determineScreenFromLocation());
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

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
    window.history.pushState({}, '', '/');
  };

  const handleCreateAccount = async ({ fullName, role, email, password }) => {
    await register({ fullName, role, email, password, autoLogin: false });
    setInitialEmail(email);
    setAuthNotice('Registration successful. Please check your email to verify your account before signing in.');
    setCurrentScreen('signin');
    window.history.pushState({}, '', '/signin');
  };

  const handleVerifyEmailSuccess = (msg) => {
    setAuthNotice(msg || 'Email verified successfully! You can now sign in.');
    setCurrentScreen('signin');
    window.history.pushState({}, '', '/signin');
  };

  const handleResetPasswordSuccess = (result) => {
    if (result?.user) {
      setAuthNotice('');
      setCurrentScreen('classrooms');
      window.history.pushState({}, '', '/');
    } else {
      setAuthNotice('Password reset successfully! Please sign in with your new password.');
      setCurrentScreen('signin');
      window.history.pushState({}, '', '/signin');
    }
  };

  const handleLogout = async () => {
    await logout();
    setAuthNotice('');
    sessionStorage.removeItem('temar_selected_classroom');
    setSelectedClassroom(null);
    setCurrentScreen('landing');
    window.history.pushState({}, '', '/');
  };

  const handleSelectClassroom = (classroom) => {
    setSelectedClassroom(classroom);
    if (classroom) {
      sessionStorage.setItem('temar_selected_classroom', JSON.stringify(classroom));
    }
    setCurrentScreen('classroom_detail');
    window.history.pushState({}, '', `/classrooms/${classroom?.id || 'detail'}`);
  };

  const handleBackToClassrooms = () => {
    setCurrentScreen('classrooms');
    window.history.pushState({}, '', '/');
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
          onSelectClassroom={handleSelectClassroom}
          onLogout={handleLogout} 
        />
      )}

      {currentScreen === 'classroom_detail' && (
        <ClassroomDetail 
          currentUser={currentUser}
          darkMode={darkMode}
          setDarkMode={setDarkMode}
          classroom={selectedClassroom || { id: 'default', title: "Flutter", subject: "Widget · widget structure" }}
          onBackToClassrooms={handleBackToClassrooms}
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
        <LiveClassNotification />
      </LiveClassProvider>
    </AuthProvider>
  );
}
