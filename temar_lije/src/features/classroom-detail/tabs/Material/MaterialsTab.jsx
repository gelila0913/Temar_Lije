import React, { useState } from "react";
import "./MaterialsTab.css";

const SearchIcon = ({ className }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M15.7955 15.8111L21 21M18 10.5C18 14.6421 14.6421 18 10.5 18C6.35786 18 3 14.6421 3 10.5C3 6.35786 6.35786 3 10.5 3C14.6421 3 18 6.35786 18 10.5Z"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const UploadIcon = ({ className }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M12 16V3M12 3L8 7M12 3L16 7M4 17V19C4 19.5304 4.21071 20.0391 4.58579 20.4142C4.96086 20.7893 5.46957 21 6 21H18C18.5304 21 19.0391 20.7893 19.4142 20.4142C19.7893 20.0391 20 19.5304 20 19V17"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export default function MaterialsTab({
  onUploadMaterial,
  hideNavigation = false,
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const tabs = [
    "Materials",
    "Live class",
    "Assignments",
    "Attendance",
    "Quizzes",
    "Members",
  ];
  const [activeTab, setActiveTab] = useState("Materials");

  const handleSearchChange = (e) => {
    setSearchQuery(e.target.value);
  };

  const handleUpload = () => {
    if (onUploadMaterial) {
      onUploadMaterial();
    } else {
      alert("Upload material clicked!");
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

      {/* Search & Actions Bar */}
      <div className="materials-action-row">
        <div className="materials-search-container">
          <SearchIcon className="materials-search-icon" />
          <input
            type="text"
            className="materials-search-input"
            placeholder="Search materials"
            value={searchQuery}
            onChange={handleSearchChange}
          />
        </div>
        <button className="materials-upload-btn" onClick={handleUpload}>
          <UploadIcon className="materials-upload-icon" />
          Upload material
        </button>
      </div>

      {/* Empty State Card */}
      <div className="materials-empty-state-card">
        <p className="materials-empty-state-text">
          No materials yet. Upload PDFs, slides, documents or images for this
          class.
        </p>
      </div>
    </div>
  );
}
