import React, { useState, useEffect } from 'react';
import Landingpage from './features/landing/landing.jsx';
import SignInPage from './features/auth/signin/signin.jsx';
import CreateAccountPage from './features/auth/create_account/create_account.jsx';
import Classrooms from './features/classrooms/classrooms.jsx';
import ClassroomDetail from './features/classroom-detail/classroom_detail.jsx';

export default function App() {
  // Track active screen: 'landing' | 'signin' | 'create_account' | 'classrooms' | 'classroom_detail'
  const [currentScreen, setCurrentScreen] = useState('landing');
  const [selectedClassroom, setSelectedClassroom] = useState(null);
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    if (darkMode) {
      document.body.classList.add('dark');
    } else {
      document.body.classList.remove('dark');
    }
  }, [darkMode]);

  return (
    <div>
      {currentScreen === 'landing' && (
        <Landingpage 
          onSignIn={() => setCurrentScreen('signin')} 
          onStartTeaching={() => setCurrentScreen('signin')}
          onJoinClass={() => setCurrentScreen('signin')}
        />
      )}

      {currentScreen === 'signin' && (
        <SignInPage 
          onSignIn={() => setCurrentScreen('classrooms')}
          onGoogleSignIn={() => setCurrentScreen('classrooms')}
          onBackToLanding={() => setCurrentScreen('landing')} 
          onSwitchToCreateAccount={() => setCurrentScreen('create_account')}
        />
      )}

      {currentScreen === 'create_account' && (
        <CreateAccountPage 
          onCreateAccount={() => setCurrentScreen('classrooms')}
          onGoogleSignIn={() => setCurrentScreen('classrooms')}
          onSwitchToSignIn={() => setCurrentScreen('signin')} 
        />
      )}

      {currentScreen === 'classrooms' && (
        <Classrooms 
          darkMode={darkMode}
          setDarkMode={setDarkMode}
          onSelectClassroom={(classroom) => {
            setSelectedClassroom(classroom);
            setCurrentScreen('classroom_detail');
          }}
          onLogout={() => setCurrentScreen('landing')} 
        />
      )}

      {currentScreen === 'classroom_detail' && (
        <ClassroomDetail 
          darkMode={darkMode}
          setDarkMode={setDarkMode}
          classroom={selectedClassroom || { title: "Flutter", subject: "Widget · widget structure" }}
          onBackToClassrooms={() => setCurrentScreen('classrooms')}
          onLogout={() => setCurrentScreen('landing')}
        />
      )}
    </div>
  );
}
