import React, { useState } from "react";
import "./AttendanceTab.css";

const AttendanceIcon = ({ className }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export default function AttendanceTab({
  onTakeAttendance,
  hideNavigation = false,
}) {
  const [checkInName, setCheckInName] = useState("");
  const tabs = [
    "Materials",
    "Live class",
    "Assignments",
    "Attendance",
    "Quizzes",
    "Members",
  ];
  const [activeTab, setActiveTab] = useState("Attendance");

  const handleInputChange = (e) => {
    setCheckInName(e.target.value);
  };

  const handleTakeAttendance = (e) => {
    e.preventDefault();
    if (onTakeAttendance) {
      onTakeAttendance(checkInName);
    } else {
      alert(`Taking attendance for: ${checkInName || "Unnamed Check-in"}`);
    }
  };

  return (
    <div className="classroom-detail-container">
      {!hideNavigation && (
        <div className="classroom-tabs-bar">
          {tabs.map((tab) => (
            <button
              key={tab}
              type="button"
              className={`classroom-tab-pill ${tab === activeTab ? "active" : ""}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </button>
          ))}
        </div>
      )}

      {/* Attendance Control Panel */}
      <div className="attendance-control-card">
        <form onSubmit={handleTakeAttendance} className="attendance-action-row">
          <input
            type="text"
            className="attendance-input"
            placeholder="Check-in name (optional)"
            value={checkInName}
            onChange={handleInputChange}
          />
          <button type="submit" className="attendance-btn">
            <AttendanceIcon className="attendance-btn-icon" />
            Take attendance
          </button>
        </form>
      </div>

      {/* Empty State Card */}
      <div className="attendance-empty-state-card">
        <p className="attendance-empty-state-text">
          No check-ins yet. Start one while you teach live.
        </p>
      </div>
    </div>
  );
}
