import React, { useCallback, useState, useEffect } from 'react';
import { Trash2, Loader2, FileText, CheckCircle, CheckCircle2, Megaphone, Eye, X, ExternalLink } from 'lucide-react';
import { getAssignments, createAssignment, submitAssignment, getSubmissions, getFileUrl, deleteAssignment } from '../../../../services/apiClient';
import styles from './AssignmentsTab.module.css';

function formatDeadline(deadline) {
  if (!deadline) return 'No deadline';
  const date = new Date(deadline);
  if (Number.isNaN(date.getTime())) return 'No deadline';
  return `Due ${date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`;
}

function formatSubmissions(count) {
  if (!count && count !== 0) return 'No submissions yet.';
  return `${count} submission${count === 1 ? '' : 's'}`;
}

export default function AssignmentsTab({
  classId = '66666666-6666-4666-8666-666666666666',
  isTeacher = true,
  currentUserId = '33333333-3333-4333-8333-333333333333',
  currentUser,
}) {
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAnnounceForm, setShowAnnounceForm] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [deadline, setDeadline] = useState('');
  const [isAnnouncing, setIsAnnouncing] = useState(false);
  const [announceError, setAnnounceError] = useState('');
  const [deletingId, setDeletingId] = useState(null);

  // Student submission modal state
  const [submittingAssignment, setSubmittingAssignment] = useState(null);
  const [submissionFile, setSubmissionFile] = useState(null);
  const [submissionLink, setSubmissionLink] = useState('');
  const [isSubmittingWork, setIsSubmittingWork] = useState(false);
  const [submissionSuccess, setSubmissionSuccess] = useState('');
  const [submissionError, setSubmissionError] = useState('');

  // Student view my submission modal state
  const [viewingMySubmission, setViewingMySubmission] = useState(null);

  // Teacher submissions modal state
  const [viewingSubmissionsAssignment, setViewingSubmissionsAssignment] = useState(null);
  const [submissionsList, setSubmissionsList] = useState([]);
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);

  const loadAssignments = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getAssignments(classId);
      const list = data?.all || (Array.isArray(data) ? data : []);
      setAssignments(list);
    } catch (err) {
      console.error('Failed to load assignments:', err);
    } finally {
      setLoading(false);
    }
  }, [classId]);

  useEffect(() => {
    loadAssignments();
  }, [loadAssignments]);

  const handleDeleteAssignment = async (id) => {
    if (!window.confirm('Are you sure you want to delete this assignment?')) return;
    setDeletingId(id);
    try {
      await deleteAssignment(id);
      await loadAssignments();
    } catch (err) {
      alert(err.message || 'Could not delete assignment.');
    } finally {
      setDeletingId(null);
    }
  };

  const handleOpenSubmissions = async (assignment) => {
    const targetUrl = `/classrooms/${classId}/assignments/${assignment.id}/submissions`;
    window.history.pushState({}, '', targetUrl);
    window.dispatchEvent(
      new CustomEvent('view-assignment-submissions', {
        detail: { assignmentId: assignment.id, classId },
      })
    );

    setViewingSubmissionsAssignment(assignment);
    setLoadingSubmissions(true);
    try {
      const data = await getSubmissions(assignment.id);
      setSubmissionsList(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      setSubmissionsList([]);
    } finally {
      setLoadingSubmissions(false);
    }
  };

  const handleAnnounceSubmit = useCallback(
    async (e) => {
      e?.preventDefault();
      if (isAnnouncing) return;
      if (!title.trim() && !description.trim()) {
        setAnnounceError('Please enter an assignment title or instructions.');
        return;
      }

      setIsAnnouncing(true);
      setAnnounceError('');
      try {
        await createAssignment({
          title: title.trim() || 'Untitled assignment',
          description: description.trim() || '',
          deadline: deadline || undefined,
          classId,
        });

        setTitle('');
        setDescription('');
        setDeadline('');
        setShowAnnounceForm(false);
        await loadAssignments();
      } catch (err) {
        setAnnounceError(err.message || 'Could not announce assignment. Try again.');
      } finally {
        setIsAnnouncing(false);
      }
    },
    [isAnnouncing, title, description, deadline, classId, loadAssignments]
  );

  const handleSubmitWork = async (e) => {
    e.preventDefault();
    if (!submittingAssignment) return;
    if (!submissionFile && !submissionLink.trim()) {
      setSubmissionError('Please select a PDF file to upload or enter a link URL.');
      return;
    }

    setIsSubmittingWork(true);
    setSubmissionError('');
    setSubmissionSuccess('');

    try {
      const formData = new FormData();
      formData.append('studentId', currentUser?.id || currentUserId);
      if (submissionFile) formData.append('file', submissionFile);
      if (submissionLink) formData.append('linkUrl', submissionLink.trim());

      await submitAssignment(submittingAssignment.id, formData);
      setSubmissionSuccess('Work submitted successfully!');
      setTimeout(() => {
        setSubmittingAssignment(null);
        setSubmissionFile(null);
        setSubmissionLink('');
        setSubmissionSuccess('');
      }, 1200);
      await loadAssignments();
    } catch (err) {
      setSubmissionError(err.message || 'Submission failed.');
      await loadAssignments();
    } finally {
      setIsSubmittingWork(false);
    }
  };

  return (
    <div className={styles.container}>
      {/* Teacher Top Header Action */}
      {isTeacher && (
        <>
          {!showAnnounceForm ? (
            <button
              type="button"
              className={styles.announceButton}
              onClick={() => setShowAnnounceForm(true)}
            >
              <Megaphone className={styles.buttonIcon} />
              <span>Announce assignment</span>
            </button>
          ) : (
            <form onSubmit={handleAnnounceSubmit} className={styles.announceForm}>
              <div className={styles.formRow}>
                <label className={styles.fieldLabel} htmlFor="assignment-title">
                  Title
                </label>
                <input
                  id="assignment-title"
                  type="text"
                  className={styles.titleInput}
                  placeholder="e.g. Essay #1 - React Hooks Deep Dive"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  disabled={isAnnouncing}
                />
              </div>

              <div className={styles.formRow}>
                <label className={styles.fieldLabel} htmlFor="assignment-desc">
                  Instructions
                </label>
                <textarea
                  id="assignment-desc"
                  className={styles.textarea}
                  placeholder="Share details, guidelines, or attach references..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  disabled={isAnnouncing}
                />
              </div>

              <div className={styles.formRow}>
                <label className={styles.fieldLabel} htmlFor="assignment-deadline">
                  Due date (optional)
                </label>
                <input
                  id="assignment-deadline"
                  type="date"
                  className={styles.deadlineInput}
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  disabled={isAnnouncing}
                />
              </div>

              <div className={styles.formActions}>
                <button
                  type="button"
                  className={styles.cancelButton}
                  onClick={() => {
                    setShowAnnounceForm(false);
                    setTitle('');
                    setDescription('');
                    setDeadline('');
                    setAnnounceError('');
                  }}
                  disabled={isAnnouncing}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={styles.submitButton}
                  disabled={isAnnouncing}
                >
                  {isAnnouncing ? (
                    <Loader2 className={`${styles.spinner} animate-spin`} />
                  ) : (
                    <span>Post Assignment</span>
                  )}
                </button>
              </div>
            </form>
          )}
        </>
      )}

      {announceError && (
        <p className={styles.inlineError} role="alert">
          {announceError}
        </p>
      )}

      {loading ? (
        <div className={styles.emptyCard}>
          <Loader2 className={`${styles.spinner} animate-spin`} style={{ margin: '0 auto 1rem' }} />
          <p className={styles.emptyState}>Loading assignments...</p>
        </div>
      ) : assignments.length === 0 ? (
        <div className={styles.emptyCard}>
          <p className={styles.emptyState}>
            {isTeacher
              ? 'No assignments announced yet. Click "Announce assignment" to create one.'
              : 'No assignments assigned yet. Check back soon!'}
          </p>
        </div>
      ) : (
        <ul className={styles.assignmentList}>
          {assignments.map((assignment) => {
            const count = assignment._count?.submissions ?? assignment.submissionCount ?? 0;
            const dueDateObj = assignment.dueDate || assignment.deadline;
            const isPastDeadline = dueDateObj ? new Date() > new Date(dueDateObj) : false;
            const isSubmitted = assignment.hasSubmitted || !!assignment.mySubmission;

            return (
              <li key={assignment.id} className={styles.assignmentCard}>
                <div className={styles.assignmentHeader}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <h3 className={styles.assignmentTitle}>{assignment.title}</h3>
                    {!isTeacher && isSubmitted && (
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          backgroundColor: '#dcfce7',
                          color: '#15803d',
                          padding: '2px 8px',
                          borderRadius: '12px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        <CheckCircle2 size={12} /> Assignment Submitted
                      </span>
                    )}
                  </div>

                  {isTeacher && (
                    <button
                      type="button"
                      className={styles.deleteButton}
                      onClick={() => handleDeleteAssignment(assignment.id)}
                      disabled={deletingId === assignment.id}
                      title="Delete assignment"
                    >
                      {deletingId === assignment.id ? (
                        <Loader2 className={`${styles.spinner} animate-spin`} />
                      ) : (
                        <Trash2 className={styles.deleteIcon} />
                      )}
                    </button>
                  )}
                </div>

                {assignment.description && (
                  <p className={styles.assignmentDescription}>{assignment.description}</p>
                )}
                <p className={styles.assignmentDeadline}>
                  {formatDeadline(dueDateObj)}
                </p>

                <div className={styles.assignmentFooter}>
                  <p className={styles.assignmentSubmissions}>{formatSubmissions(count)}</p>
                  {isTeacher ? (
                    <button
                      type="button"
                      onClick={() => handleOpenSubmissions(assignment)}
                      style={{
                        backgroundColor: '#f3f7f5',
                        color: '#14785c',
                        border: '1px solid #c2ded6',
                        borderRadius: '6px',
                        padding: '6px 14px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        marginTop: '8px',
                      }}
                    >
                      View Submissions
                    </button>
                  ) : (
                    <div style={{ marginTop: '8px' }}>
                      {isSubmitted ? (
                        <button
                          type="button"
                          onClick={() => setViewingMySubmission(assignment)}
                          style={{
                            backgroundColor: '#f1f5f9',
                            color: '#0f172a',
                            border: '1px solid #cbd5e1',
                            borderRadius: '6px',
                            padding: '6px 14px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                          }}
                        >
                          <Eye size={14} /> View My Submission
                        </button>
                      ) : isPastDeadline ? (
                        <span
                          style={{
                            fontSize: '12px',
                            fontWeight: 600,
                            color: '#c0402f',
                            backgroundColor: '#fbeae7',
                            padding: '4px 10px',
                            borderRadius: '6px',
                            display: 'inline-block',
                          }}
                        >
                          Deadline Passed (Closed)
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setSubmittingAssignment(assignment)}
                          style={{
                            backgroundColor: '#14785c',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '6px',
                            padding: '6px 14px',
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          Submit Work
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* Student Work Submission Modal */}
      {submittingAssignment && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
        >
          <div
            style={{
              backgroundColor: '#fff',
              borderRadius: '12px',
              width: '90%',
              maxWidth: '480px',
              padding: '24px',
              position: 'relative',
            }}
          >
            <h3 style={{ marginTop: 0, color: '#16181b' }}>
              Submit Work: {submittingAssignment.title}
            </h3>

            {submissionSuccess && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#16a34a', marginBottom: '12px' }}>
                <CheckCircle size={18} /> {submissionSuccess}
              </div>
            )}
            {submissionError && <p style={{ color: '#dc2626', fontSize: '14px', marginBottom: '12px' }}>{submissionError}</p>}

            <form onSubmit={handleSubmitWork} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>
                  Upload File (PDF / Doc)
                </label>
                <input
                  type="file"
                  onChange={(e) => setSubmissionFile(e.target.files[0])}
                  style={{ fontSize: '14px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>
                  Or Submission Link URL
                </label>
                <input
                  type="url"
                  placeholder="https://github.com/..."
                  value={submissionLink}
                  onChange={(e) => setSubmissionLink(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid #ccc',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => {
                    setSubmittingAssignment(null);
                    setSubmissionFile(null);
                    setSubmissionLink('');
                    setSubmissionError('');
                  }}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '6px',
                    border: '1px solid #ccc',
                    backgroundColor: '#fff',
                    cursor: 'pointer',
                  }}
                  disabled={isSubmittingWork}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingWork}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '6px',
                    border: 'none',
                    backgroundColor: '#14785c',
                    color: '#fff',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {isSubmittingWork ? 'Submitting...' : 'Submit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Student View My Submission Modal */}
      {viewingMySubmission && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
        >
          <div
            style={{
              backgroundColor: '#fff',
              borderRadius: '12px',
              width: '90%',
              maxWidth: '500px',
              padding: '24px',
              position: 'relative',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, color: '#16181b', fontSize: '1.15rem' }}>
                My Submission: {viewingMySubmission.title}
              </h3>
              <button
                type="button"
                onClick={() => setViewingMySubmission(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={20} />
              </button>
            </div>

            <div
              style={{
                backgroundColor: '#f0fdf4',
                border: '1px solid #bbf7d0',
                borderRadius: '8px',
                padding: '12px 16px',
                marginBottom: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                color: '#15803d',
                fontSize: '14px',
                fontWeight: 600,
              }}
            >
              <CheckCircle2 size={18} /> Assignment Submitted & Recorded
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '14px' }}>
              <div>
                <span style={{ color: '#64748b', fontSize: '13px' }}>Submitted On:</span>
                <p style={{ margin: '2px 0 0', fontWeight: 600, color: '#1e293b' }}>
                  {viewingMySubmission.mySubmission?.submittedAt
                    ? new Date(viewingMySubmission.mySubmission.submittedAt).toLocaleString()
                    : 'Recorded'}
                </p>
              </div>

              {viewingMySubmission.mySubmission?.fileUrl && (
                <div>
                  <span style={{ color: '#64748b', fontSize: '13px' }}>Attached File / Document:</span>
                  <p style={{ margin: '4px 0 0' }}>
                    <a
                      href={getFileUrl(viewingMySubmission.mySubmission.fileUrl)}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        color: '#0284c7',
                        textDecoration: 'underline',
                        fontWeight: 600,
                      }}
                    >
                      <FileText size={16} /> Open Submitted Document <ExternalLink size={14} />
                    </a>
                  </p>
                </div>
              )}

              {viewingMySubmission.mySubmission?.submissionText && (
                <div>
                  <span style={{ color: '#64748b', fontSize: '13px' }}>Submission Notes / Link:</span>
                  <p style={{ margin: '2px 0 0', color: '#1e293b' }}>
                    {viewingMySubmission.mySubmission.submissionText}
                  </p>
                </div>
              )}

              {viewingMySubmission.mySubmission?.grade !== undefined && viewingMySubmission.mySubmission?.grade !== null && (
                <div style={{ marginTop: '8px', padding: '12px', backgroundColor: '#f8fafc', borderRadius: '8px' }}>
                  <span style={{ color: '#64748b', fontSize: '13px' }}>Instructor Grade:</span>
                  <h4 style={{ margin: '4px 0 0', color: '#14785c', fontSize: '18px' }}>
                    {viewingMySubmission.mySubmission.grade} / {viewingMySubmission.totalPoints || 100} pts
                  </h4>
                  {viewingMySubmission.mySubmission.feedback && (
                    <p style={{ margin: '6px 0 0', fontSize: '13px', color: '#475569' }}>
                      Feedback: {viewingMySubmission.mySubmission.feedback}
                    </p>
                  )}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
              <button
                type="button"
                onClick={() => setViewingMySubmission(null)}
                style={{
                  padding: '8px 18px',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: '#14785c',
                  color: '#fff',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Teacher View Submissions Modal */}
      {viewingSubmissionsAssignment && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
        >
          <div
            style={{
              backgroundColor: '#fff',
              borderRadius: '12px',
              width: '90%',
              maxWidth: '640px',
              maxHeight: '80vh',
              overflowY: 'auto',
              padding: '24px',
              position: 'relative',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, color: '#16181b' }}>
                Submissions: {viewingSubmissionsAssignment.title}
              </h3>
              <button
                type="button"
                onClick={() => setViewingSubmissionsAssignment(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={20} />
              </button>
            </div>

            {loadingSubmissions ? (
              <div style={{ textAlign: 'center', padding: '30px 0' }}>
                <Loader2 className="animate-spin" style={{ margin: '0 auto 8px', color: '#14785c' }} />
                <p style={{ color: '#64748b', margin: 0 }}>Loading submissions...</p>
              </div>
            ) : submissionsList.length === 0 ? (
              <p style={{ color: '#64748b', textAlign: 'center', padding: '30px 0' }}>
                No student submissions yet.
              </p>
            ) : (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {submissionsList.map((sub, idx) => (
                  <li
                    key={sub.id || idx}
                    style={{
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      padding: '12px 16px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      backgroundColor: '#f8fafc',
                    }}
                  >
                    <div>
                      <h4 style={{ margin: '0 0 4px', fontSize: '14px', color: '#1e293b' }}>
                        {sub.student?.fullName || sub.student?.name || 'Student'}
                      </h4>
                      <span style={{ fontSize: '12px', color: '#64748b' }}>
                        Submitted {new Date(sub.submittedAt).toLocaleString()}
                      </span>
                    </div>

                    <div>
                      {sub.fileUrl && (
                        <a
                          href={getFileUrl(sub.fileUrl)}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            color: '#0284c7',
                            fontSize: '13px',
                            fontWeight: 600,
                            textDecoration: 'none',
                          }}
                        >
                          <FileText size={15} /> View Work
                        </a>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}