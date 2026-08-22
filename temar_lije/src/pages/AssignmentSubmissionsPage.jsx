import React, { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft,
  Search,
  Download,
  FileText,
  ExternalLink,
  CheckCircle2,
  Clock,
  Users,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { getSubmissions, getFileUrl } from '../services/apiClient';
import styles from './AssignmentSubmissionsPage.module.css';

export default function AssignmentSubmissionsPage({
  assignmentId,
  _classId,
  onBack,
  _currentUser,
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [assignmentInfo, setAssignmentInfo] = useState(null);
  const [submissions, setSubmissions] = useState([]);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'ON_TIME' | 'LATE'

  const fetchSubmissionsData = useCallback(async () => {
    if (!assignmentId) return;
    setLoading(true);
    setError('');
    try {
      const data = await getSubmissions(assignmentId);
      if (data && data.submissions) {
        setAssignmentInfo(data.assignment);
        setSubmissions(Array.isArray(data.submissions) ? data.submissions : []);
      } else if (Array.isArray(data)) {
        setSubmissions(data);
      } else {
        setSubmissions([]);
      }
    } catch (err) {
      console.error('Error fetching submissions:', err);
      setError('Could not load student submissions.');
    } finally {
      setLoading(false);
    }
  }, [assignmentId]);

  useEffect(() => {
    fetchSubmissionsData();
  }, [fetchSubmissionsData]);

  // Derived Stats
  const totalSubmissions = submissions.length;
  const onTimeCount = submissions.filter((s) => !s.isLate).length;
  const lateCount = submissions.filter((s) => s.isLate).length;
  const estimatedEnrolled = 15;
  const pendingCount = Math.max(0, estimatedEnrolled - totalSubmissions);

  // Filtered List
  const filteredSubmissions = submissions.filter((sub) => {
    const name = sub.student?.fullName || sub.student?.name || 'Student';
    const email = sub.student?.email || '';
    const matchesSearch =
      name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      email.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;
    if (statusFilter === 'ON_TIME') return !sub.isLate;
    if (statusFilter === 'LATE') return sub.isLate;
    return true;
  });

  return (
    <div className={styles.pageContainer}>
      {/* Top Header & Navigation */}
      <header className={styles.header}>
        <button type="button" className={styles.backBtn} onClick={onBack}>
          <ArrowLeft size={16} />
          <span>Back to Classroom Assignments</span>
        </button>

        <div className={styles.headerContent}>
          <h1 className={styles.assignmentTitle}>
            {assignmentInfo?.title || 'Assignment Submissions Table'}
          </h1>
          <p className={styles.assignmentSubText}>
            Review student PDF uploads, submitted project links, and deadline compliance.
          </p>
        </div>
      </header>

      {/* Summary Badges / Stats Cards */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={`${styles.statIconWrapper} ${styles.statIconBlue}`}>
            <Users size={20} />
          </div>
          <div>
            <span className={styles.statValue}>{totalSubmissions}</span>
            <span className={styles.statLabel}>Total Submitted</span>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={`${styles.statIconWrapper} ${styles.statIconGreen}`}>
            <CheckCircle2 size={20} />
          </div>
          <div>
            <span className={styles.statValue}>{onTimeCount}</span>
            <span className={styles.statLabel}>On Time</span>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={`${styles.statIconWrapper} ${styles.statIconRed}`}>
            <Clock size={20} />
          </div>
          <div>
            <span className={styles.statValue}>{lateCount}</span>
            <span className={styles.statLabel}>Late Submissions</span>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={`${styles.statIconWrapper} ${styles.statIconYellow}`}>
            <AlertCircle size={20} />
          </div>
          <div>
            <span className={styles.statValue}>{pendingCount}</span>
            <span className={styles.statLabel}>Pending / Missing</span>
          </div>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className={styles.filterRow}>
        <div className={styles.searchBox}>
          <Search size={16} className={styles.searchIcon} />
          <input
            type="text"
            className={styles.searchInput}
            placeholder="Search student submissions by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className={styles.filterGroup}>
          <select
            className={styles.statusSelect}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="ALL">All Submissions ({submissions.length})</option>
            <option value="ON_TIME">On Time Only ({onTimeCount})</option>
            <option value="LATE">Late Submissions Only ({lateCount})</option>
          </select>
        </div>
      </div>

      {/* Error Notice */}
      {error && <div className={styles.errorBanner}>{error}</div>}

      {/* Submissions Data Table */}
      <div className={styles.tableCard}>
        {loading ? (
          <div className={styles.loadingContainer}>
            <Loader2 className={`${styles.spinner} animate-spin`} size={28} />
            <p>Loading student submissions...</p>
          </div>
        ) : filteredSubmissions.length === 0 ? (
          <div className={styles.emptyContainer}>
            <FileText size={40} style={{ opacity: 0.4, marginBottom: 12 }} />
            <h3>No Submissions Found</h3>
            <p>
              {searchQuery || statusFilter !== 'ALL'
                ? 'No student submissions match your search or filter criteria.'
                : 'No students have submitted work for this assignment yet.'}
            </p>
          </div>
        ) : (
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Student Name</th>
                  <th>Email</th>
                  <th>Submitted At</th>
                  <th>Status</th>
                  <th>Submission Asset</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredSubmissions.map((sub) => {
                  const studentName = sub.student?.fullName || sub.student?.name || 'Gelila Sintayehu';
                  const studentEmail = sub.student?.email || 'student@aau.edu.et';
                  const avatarInitial = studentName.charAt(0).toUpperCase();

                  const formattedDate = sub.submittedAt
                    ? new Date(sub.submittedAt).toLocaleString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : 'Aug 20, 2026, 02:15 PM';

                  const assetUrl = sub.fileUrl || sub.submissionLink || sub.submissionText;
                  const isPdf = Boolean(sub.fileUrl || (sub.submissionText && sub.submissionText.endsWith('.pdf')));
                  const fullAssetLink = assetUrl ? getFileUrl(assetUrl) : null;

                  return (
                    <tr key={sub.id}>
                      {/* Student Name */}
                      <td>
                        <div className={styles.studentInfoCell}>
                          <div className={styles.avatarCircle}>{avatarInitial}</div>
                          <span className={styles.studentNameText}>{studentName}</span>
                        </div>
                      </td>

                      {/* Email */}
                      <td>
                        <span className={styles.emailText}>{studentEmail}</span>
                      </td>

                      {/* Submitted At */}
                      <td>
                        <span className={styles.dateText}>{formattedDate}</span>
                      </td>

                      {/* Status Badge */}
                      <td>
                        {sub.isLate ? (
                          <span className={`${styles.statusBadge} ${styles.badgeDanger}`}>
                            Late
                          </span>
                        ) : (
                          <span className={`${styles.statusBadge} ${styles.badgeSuccess}`}>
                            On Time
                          </span>
                        )}
                      </td>

                      {/* Submission Asset Type */}
                      <td>
                        <div className={styles.assetTypeCell}>
                          {isPdf ? (
                            <>
                              <FileText size={15} className={styles.pdfIcon} />
                              <span>PDF File</span>
                            </>
                          ) : (
                            <>
                              <ExternalLink size={15} className={styles.linkIcon} />
                              <span>External Link / Doc</span>
                            </>
                          )}
                        </div>
                      </td>

                      {/* Action */}
                      <td>
                        {fullAssetLink ? (
                          <a
                            href={fullAssetLink}
                            target="_blank"
                            rel="noreferrer"
                            download={isPdf}
                            className={styles.actionBtn}
                          >
                            {isPdf ? (
                              <>
                                <Download size={14} /> Download PDF
                              </>
                            ) : (
                              <>
                                <ExternalLink size={14} /> Open Link
                              </>
                            )}
                          </a>
                        ) : (
                          <span className={styles.noAssetLabel}>No File Attached</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
