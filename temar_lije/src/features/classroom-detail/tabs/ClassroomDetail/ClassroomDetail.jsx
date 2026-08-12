import React, { useMemo, useState } from "react";
import Header from "../../../../components/common/Header/header";
import LiveClassTab from "../LiveClassTab/LiveClassTab";
import AssignmentsTab from "../AssignmentsTab/AssignmentsTab";
import TeacherMemberTab from "../TeacherMemberTab/TeacherMemberTab";
import MaterialsTab from "../Material/MaterialsTab";
import AttendanceTab from "../Attendance/AttendanceTab";
import "./ClassroomDetail.css";

const TAB_ORDER = [
  "Materials",
  "Live class",
  "Assignments",
  "Attendance",
  "Quizzes",
  "Members",
];

const DEFAULT_CLASSROOM = {
  name: "Flutter",
  subtitle: "Widget · widget structure",
  invitationCode: "DB7GLU",
};

export default function ClassroomDetail({
  onNavigate,
  role = "Teacher",
  classroom = DEFAULT_CLASSROOM,
}) {
  const [activeTab, setActiveTab] = useState("Live class");

  const tabContent = useMemo(
    () => ({
      Materials: <MaterialsTab hideNavigation />,
      "Live class": <LiveClassTab />,
      Assignments: <AssignmentsTab />,
      Attendance: <AttendanceTab hideNavigation />,
      Quizzes: (
        <div className="classroom-placeholder">Quizzes will appear here.</div>
      ),
      Members: <TeacherMemberTab />,
    }),
    [],
  );

  return (
    <div className="classroom-detail-page">
      <Header
        role={role}
        currentTab="classrooms"
        onTabChange={onNavigate}
        onLogout={() => onNavigate?.("signin")}
      />

      <main className="classroom-detail-main">
        <button
          className="back-button"
          type="button"
          onClick={() => onNavigate?.("classrooms")}
        >
          ← Classrooms
        </button>

        <section className="classroom-summary" aria-label="Classroom summary">
          <div className="classroom-summary-copy">
            <p className="classroom-kicker">Classroom detail</p>
            <h1>{classroom.name}</h1>
            <p className="classroom-subtitle">{classroom.subtitle}</p>
          </div>

          <div className="invitation-code" aria-label="Invitation code">
            <span>INVITATION CODE</span>
            <strong>{classroom.invitationCode}</strong>
          </div>
        </section>

        <nav className="classroom-tab-list" aria-label="Classroom sections">
          {TAB_ORDER.map((tab) => (
            <button
              key={tab}
              type="button"
              className={activeTab === tab ? "active" : ""}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </button>
          ))}
        </nav>

        <section className="classroom-panel">{tabContent[activeTab]}</section>
      </main>
    </div>
  );
}
