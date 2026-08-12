import React, { useEffect, useState } from "react";
import Landingpage from "./features/landing/landing.jsx";
import CreateAccount from "./features/auth/create_account/create_account";
import SignIn from "./features/auth/signin/signin";
import StudyBuddy from "./features/study-buddy/study-buddy";
import Chat from "./features/chat/chat";
import ClassroomDetail from "./features/classroom-detail/tabs/ClassroomDetail/ClassroomDetail.jsx";
import Header from "./components/common/Header/header";
import Classrooms from "./features/classrooms/classrooms";

const DEMO_SCREENS = [
  ["landing", "Landing"],
  ["signin", "Sign in"],
  ["create-account", "Create account"],
  ["classrooms", "Classrooms"],
  ["classroom-detail", "Classroom detail"],
  ["study-buddy", "Study Buddy"],
  ["chat", "Chat"],
];

function DemoSwitcher({ onNavigate, currentScreen }) {
  if (!import.meta.env.DEV) return null;

  return (
    <div className="demo-switcher" aria-label="Demo navigation">
      {DEMO_SCREENS.map(([screen, label]) => (
        <button
          key={screen}
          type="button"
          className={screen === currentScreen ? "active" : ""}
          onClick={() => onNavigate(screen)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

export default function App() {
  const [screen, setScreen] = useState(
    () => window.location.hash.slice(1) || "landing",
  );
  const navigate = (next) => {
    window.location.hash = next;
    setScreen(next);
  };
  useEffect(() => {
    const sync = () => setScreen(window.location.hash.slice(1) || "landing");
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);
  if (screen === "signin")
    return (
      <>
        <DemoSwitcher onNavigate={navigate} currentScreen={screen} />
        <SignIn
          onSignIn={() => navigate("classrooms")}
          onGoogleSignIn={() => navigate("classrooms")}
          onSwitchToCreateAccount={() => navigate("create-account")}
        />
      </>
    );
  if (screen === "create-account")
    return (
      <>
        <DemoSwitcher onNavigate={navigate} currentScreen={screen} />
        <CreateAccount
          onCreateAccount={() => navigate("classrooms")}
          onGoogleSignIn={() => navigate("classrooms")}
          onSwitchToSignIn={() => navigate("signin")}
        />
      </>
    );
  if (screen === "classroom-detail")
    return (
      <>
        <DemoSwitcher onNavigate={navigate} currentScreen={screen} />
        <ClassroomDetail onNavigate={navigate} />
      </>
    );
  if (screen === "study-buddy")
    return (
      <>
        <DemoSwitcher onNavigate={navigate} currentScreen={screen} />
        <Header
          currentTab="study-buddy"
          onTabChange={navigate}
          onLogout={() => navigate("landing")}
        />
        <StudyBuddy />
      </>
    );
  if (screen === "chat")
    return (
      <>
        <DemoSwitcher onNavigate={navigate} currentScreen={screen} />
        <Chat />
      </>
    );
  if (screen === "classrooms")
    return (
      <>
        <DemoSwitcher onNavigate={navigate} currentScreen={screen} />
        <Classrooms
          onLogout={() => navigate("landing")}
          onOpenClassroom={() => navigate("classroom-detail")}
        />
      </>
    );
  return (
    <>
      <DemoSwitcher onNavigate={navigate} currentScreen={screen} />
      <Landingpage
        onSignIn={() => navigate("signin")}
        onStartTeaching={() => navigate("create-account")}
        onJoinClass={() => navigate("signin")}
      />
    </>
  );
}
