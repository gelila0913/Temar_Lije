import React, { useState, useEffect } from "react";
import "./classrooms.css";
import temarLijeLogo from "../../assets/temar-lije-logo.png";
import CreateClassRoom from "../../components/layout/create_class_room/create_class_room";

export default function Classrooms({
  currentUser = { name: "Teacher User", role: "Teacher" },
  initialClassrooms = [],
  onLogout = () => alert("Signing out..."),
  onOpenClassroom = () => {},
}) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("classrooms");

  const [classroomsList, setClassroomsList] = useState(() => {
    const saved = localStorage.getItem("temar_classrooms");
    return saved ? JSON.parse(saved) : initialClassrooms;
  });

  useEffect(() => {
    localStorage.setItem("temar_classrooms", JSON.stringify(classroomsList));
  }, [classroomsList]);

  const avatarInitial = currentUser?.name
    ? currentUser.name.charAt(0).toUpperCase()
    : "U";

  const handleCreateClassroom = (newClassroomData) => {
    const randomCode = Math.random().toString(36).substring(2, 8).toUpperCase();

    const newClass = {
      id: Date.now(),
      title: newClassroomData.title,
      subject: newClassroomData.subject,
      description: newClassroomData.description,
      code: randomCode,
    };

    setClassroomsList((prev) => [...prev, newClass]);
  };

  const handleCopyCode = (e, code) => {
    e.stopPropagation();
    navigator.clipboard.writeText(code);
    alert(`Classroom invitation code "${code}" copied to clipboard!`);
  };

  return (
    <div className="classrooms-container">
      {/* Top Navbar */}
      <header className="classrooms-header">
        <div className="header-left">
          <div className="logo-brand">
            <img
              src={temarLijeLogo}
              alt="Temar Lije Logo"
              className="brand-logo-img"
            />
            <span className="brand-title">Temar Lije</span>
          </div>

          <nav className="header-nav">
            <button
              className={`nav-tab ${activeTab === "classrooms" ? "active" : ""}`}
              onClick={() => setActiveTab("classrooms")}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <rect x="3" y="3" width="7" height="7" rx="1"></rect>
                <rect x="14" y="3" width="7" height="7" rx="1"></rect>
                <rect x="14" y="14" width="7" height="7" rx="1"></rect>
                <rect x="3" y="14" width="7" height="7" rx="1"></rect>
              </svg>
              Classrooms
            </button>
            <button
              className={`nav-tab ${activeTab === "study-buddy" ? "active" : ""}`}
              onClick={() => setActiveTab("study-buddy")}
            >
              <span style={{ fontSize: "1rem" }}>✨</span> Study Buddy
            </button>
          </nav>
        </div>

        {/* User Profile Info */}
        <div className="header-right">
          <div className="user-profile">
            <div className="avatar-circle">{avatarInitial}</div>
            <div className="user-info">
              <span className="user-name">{currentUser.name}</span>
              <span className="user-role-badge">{currentUser.role}</span>
            </div>
          </div>
          <button className="btn-logout" onClick={onLogout} title="Sign out">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
              <polyline points="16 17 21 12 16 7"></polyline>
              <line x1="21" y1="12" x2="9" y2="12"></line>
            </svg>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="classrooms-main">
        {activeTab === "classrooms" ? (
          <>
            <div className="main-top-bar">
              <div>
                <h1 className="page-title">Your classrooms</h1>
                <p className="page-subtitle">
                  Create a classroom, share the invitation code and upload
                  lesson materials.
                </p>
              </div>

              <button
                className="btn-new-classroom"
                onClick={() => setIsModalOpen(true)}
              >
                <span>+</span> New classroom
              </button>
            </div>

            {/* Empty State vs Classroom Cards */}
            {classroomsList.length === 0 ? (
              <div
                style={{
                  textAlign: "center",
                  padding: "4rem 1rem",
                  color: "#64748b",
                }}
              >
                <p
                  style={{
                    fontSize: "1.1rem",
                    fontWeight: 500,
                    marginBottom: "0.5rem",
                  }}
                >
                  No classrooms created yet
                </p>
                <p style={{ fontSize: "0.875rem" }}>
                  Click <strong>"+ New classroom"</strong> above to get started.
                </p>
              </div>
            ) : (
              <div className="classrooms-grid">
                {classroomsList.map((classroom) => (
                  <div
                    className="classroom-card"
                    key={classroom.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => onOpenClassroom(classroom)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onOpenClassroom(classroom);
                      }
                    }}
                  >
                    <div>
                      <div className="card-top-bar"></div>
                      <h2 className="card-title">{classroom.title}</h2>
                      {classroom.subject && (
                        <p className="card-subject">{classroom.subject}</p>
                      )}
                      {classroom.description && (
                        <p className="card-description">
                          {classroom.description}
                        </p>
                      )}
                    </div>

                    <div className="card-footer">
                      <div className="card-type">
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                          <circle cx="9" cy="7" r="4"></circle>
                          <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                          <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                        </svg>
                        <span>Classroom</span>
                      </div>

                      <span
                        className="card-code"
                        onClick={(e) => handleCopyCode(e, classroom.code)}
                        title="Click to copy code"
                        style={{ cursor: "pointer" }}
                      >
                        {classroom.code}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <div
            style={{
              textAlign: "center",
              padding: "4rem 1rem",
              color: "#64748b",
            }}
          >
            <h2
              style={{
                fontSize: "1.5rem",
                color: "#0f172a",
                marginBottom: "0.5rem",
              }}
            >
              ✨ Study Buddy
            </h2>
            <p>AI assistance and study companion features will load here.</p>
          </div>
        )}
      </main>

      {/* Modal Popup */}
      <CreateClassRoom
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onCreate={handleCreateClassroom}
      />
    </div>
  );
}
