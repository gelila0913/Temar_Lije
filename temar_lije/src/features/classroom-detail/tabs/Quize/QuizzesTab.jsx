import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Sparkles,
  Plus,
  Trash2,
  CheckCircle2,
  XCircle,
  Clock,
  Award,
  AlertCircle,
  ChevronRight,
  ChevronLeft,
  Send,
  BarChart3,
  BookOpen,
  Loader2,
  Eye,
  Download,
  AlertTriangle,
  Lightbulb,
} from 'lucide-react';
import {
  getQuizzes,
  createQuiz,
  publishQuiz,
  getQuizDetails,
  submitQuiz,
  getSubmissionResult,
  getQuizAnalytics,
  deleteQuiz,
  generateAIQuiz,
} from '../../../../services/apiClient';

export default function QuizzesTab({
  classId = '',
  isTeacher = false,
  currentUser = { name: 'User', role: 'Student' },
}) {
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Teacher: Create Quiz Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [newQuizTitle, setNewQuizTitle] = useState('');
  const [newQuizDesc, setNewQuizDesc] = useState('');
  const [newQuizDuration, setNewQuizDuration] = useState(15);
  const [newQuizPublish, setNewQuizPublish] = useState(true);
  const [questions, setQuestions] = useState([
    {
      id: 'q1',
      text: '',
      type: 'MULTIPLE_CHOICE',
      points: 1,
      explanation: '',
      options: [
        { id: 'opt_1', text: '', isCorrect: true },
        { id: 'opt_2', text: '', isCorrect: false },
      ],
    },
  ]);

  // Teacher: AI Quiz Generator Modal
  const [showAIModal, setShowAIModal] = useState(false);
  const [aiTopic, setAiTopic] = useState('');
  const [aiCount, setAiCount] = useState(5);
  const [aiDifficulty, setAiDifficulty] = useState('Medium');
  const [generatingAI, setGeneratingAI] = useState(false);
  const [aiError, setAiError] = useState('');

  // Teacher: Analytics Modal
  const [analyticsQuiz, setAnalyticsQuiz] = useState(null);
  const [analyticsData, setAnalyticsData] = useState(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);

  // Student: Quiz Taking State
  const [takingQuiz, setTakingQuiz] = useState(null);
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [studentAnswers, setStudentAnswers] = useState({}); // { [questionId]: selectedOptionId }
  const [submittingQuiz, setSubmittingQuiz] = useState(false);
  const [takeError, setTakeError] = useState('');
  const [secondsLeft, setSecondsLeft] = useState(null);
  const [tabSwitches, setTabSwitches] = useState(0);

  // Student: Quiz Results Modal
  const [resultModal, setResultModal] = useState(null);

  // Deleting Quiz
  const [deletingId, setDeletingId] = useState(null);

  // Load quizzes for current classroom
  const loadQuizzesList = useCallback(async () => {
    if (!classId) return;
    setLoading(true);
    setError('');
    try {
      const data = await getQuizzes(classId);
      const list = Array.isArray(data) ? data : data?.all || [];
      setQuizzes(list);
    } catch (err) {
      console.warn('Failed to load quizzes:', err);
      setError('Could not load quizzes. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [classId]);

  useEffect(() => {
    loadQuizzesList();
  }, [loadQuizzesList]);

  // Tab switch detection during quiz taking
  useEffect(() => {
    if (!takingQuiz) {
      setTabSwitches(0);
      return;
    }

    const handleVisibilityChange = () => {
      if (document.hidden) {
        setTabSwitches((prev) => prev + 1);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [takingQuiz]);

  // Live Countdown Timer with Auto-Submit
  const studentAnswersRef = useRef(studentAnswers);
  studentAnswersRef.current = studentAnswers;
  const takingQuizRef = useRef(takingQuiz);
  takingQuizRef.current = takingQuiz;

  const handleAutoSubmit = useCallback(async () => {
    const quiz = takingQuizRef.current;
    if (!quiz) return;

    setSubmittingQuiz(true);
    setTakeError('');
    try {
      const answersList = (quiz.questions || []).map((q) => ({
        questionId: q.id,
        selectedOptionId: studentAnswersRef.current[q.id] !== undefined ? studentAnswersRef.current[q.id] : null,
      }));

      const answersPayload = {
        studentId: currentUser?.id,
        answers: answersList,
      };

      const result = await submitQuiz(quiz.id, answersPayload);
      setTakingQuiz(null);
      setSecondsLeft(null);
      setResultModal(result);
      await loadQuizzesList();
    } catch (err) {
      setTakeError(err.message || 'Auto-submission failed. Please click Submit Quiz.');
    } finally {
      setSubmittingQuiz(false);
    }
  }, [currentUser?.id, loadQuizzesList]);

  useEffect(() => {
    if (!takingQuiz) {
      setSecondsLeft(null);
      return;
    }

    const duration = Math.max(1, Number(takingQuiz.durationMinutes) || 15);
    setSecondsLeft(duration * 60);

    const timer = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev === null) return null;
        if (prev <= 1) {
          clearInterval(timer);
          handleAutoSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [takingQuiz, handleAutoSubmit]);

  // Format seconds to mm:ss
  const formatTimer = (totalSeconds) => {
    if (totalSeconds === null || totalSeconds === undefined) return '--:--';
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // --- Question Builder Handlers (Teacher) ---
  const handleAddQuestion = () => {
    setQuestions((prev) => [
      ...prev,
      {
        id: `q_${Date.now()}`,
        text: '',
        type: 'MULTIPLE_CHOICE',
        points: 1,
        explanation: '',
        options: [
          { id: `opt_1_${Date.now()}`, text: '', isCorrect: true },
          { id: `opt_2_${Date.now()}`, text: '', isCorrect: false },
        ],
      },
    ]);
  };

  const handleRemoveQuestion = (idx) => {
    if (questions.length <= 1) {
      alert('A quiz must contain at least one question.');
      return;
    }
    setQuestions((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleQuestionChange = (idx, field, value) => {
    setQuestions((prev) =>
      prev.map((q, i) => {
        if (i !== idx) return q;
        if (field === 'type' && value === 'TRUE_FALSE') {
          return {
            ...q,
            type: value,
            options: [
              { id: 'tf_true', text: 'True', isCorrect: true },
              { id: 'tf_false', text: 'False', isCorrect: false },
            ],
          };
        }
        if (field === 'type' && value === 'MULTIPLE_CHOICE' && q.type === 'TRUE_FALSE') {
          return {
            ...q,
            type: value,
            options: [
              { id: `opt_1_${Date.now()}`, text: '', isCorrect: true },
              { id: `opt_2_${Date.now()}`, text: '', isCorrect: false },
            ],
          };
        }
        return { ...q, [field]: value };
      })
    );
  };

  const handleOptionTextChange = (qIdx, optIdx, text) => {
    setQuestions((prev) =>
      prev.map((q, i) => {
        if (i !== qIdx) return q;
        const newOptions = q.options.map((opt, oi) =>
          oi === optIdx ? { ...opt, text } : opt
        );
        return { ...q, options: newOptions };
      })
    );
  };

  const handleSetCorrectOption = (qIdx, optIdx) => {
    setQuestions((prev) =>
      prev.map((q, i) => {
        if (i !== qIdx) return q;
        const newOptions = q.options.map((opt, oi) => ({
          ...opt,
          isCorrect: oi === optIdx,
        }));
        return { ...q, options: newOptions };
      })
    );
  };

  const handleAddOption = (qIdx) => {
    setQuestions((prev) =>
      prev.map((q, i) => {
        if (i !== qIdx) return q;
        if (q.options.length >= 6) return q;
        return {
          ...q,
          options: [
            ...q.options,
            { id: `opt_${q.options.length + 1}_${Date.now()}`, text: '', isCorrect: false },
          ],
        };
      })
    );
  };

  const handleRemoveOption = (qIdx, optIdx) => {
    setQuestions((prev) =>
      prev.map((q, i) => {
        if (i !== qIdx) return q;
        if (q.options.length <= 2) return q;
        const remaining = q.options.filter((_, oi) => oi !== optIdx);
        const hasCorrect = remaining.some((o) => o.isCorrect);
        if (!hasCorrect && remaining.length > 0) {
          remaining[0].isCorrect = true;
        }
        return { ...q, options: remaining };
      })
    );
  };

  // AI Quiz Generator Action
  const handleGenerateAIQuiz = async (e) => {
    e.preventDefault();
    if (!aiTopic.trim()) {
      setAiError('Please enter a topic for the quiz.');
      return;
    }

    setGeneratingAI(true);
    setAiError('');
    try {
      const generated = await generateAIQuiz({
        topic: aiTopic.trim(),
        questionCount: Number(aiCount) || 5,
        difficulty: aiDifficulty,
        classroomId: classId,
      });

      setNewQuizTitle(generated.title || `${aiTopic.trim()} Assessment`);
      setNewQuizDesc(generated.description || `Assessment on ${aiTopic.trim()}`);
      setNewQuizDuration(generated.durationMinutes || 15);
      if (Array.isArray(generated.questions) && generated.questions.length > 0) {
        setQuestions(generated.questions);
      }

      setShowAIModal(false);
      setShowCreateModal(true);
    } catch (err) {
      setAiError(err.message || 'Failed to generate AI quiz. Please try again.');
    } finally {
      setGeneratingAI(false);
    }
  };

  // Create Quiz Form Submission
  const handleSaveQuiz = async (e) => {
    e.preventDefault();
    setCreateError('');

    if (!newQuizTitle.trim()) {
      setCreateError('Please enter a quiz title.');
      return;
    }

    // Validate questions
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.text.trim()) {
        setCreateError(`Question ${i + 1} is missing question text.`);
        return;
      }
      for (let j = 0; j < q.options.length; j++) {
        if (!q.options[j].text.trim()) {
          setCreateError(`Option ${j + 1} in Question ${i + 1} cannot be empty.`);
          return;
        }
      }
      const correctCount = q.options.filter((o) => o.isCorrect).length;
      if (correctCount !== 1) {
        setCreateError(`Question ${i + 1} must have exactly one correct answer selected.`);
        return;
      }
    }

    setCreating(true);
    try {
      await createQuiz(classId, {
        title: newQuizTitle.trim(),
        description: newQuizDesc.trim() || undefined,
        durationMinutes: Number(newQuizDuration) || 15,
        isPublished: newQuizPublish,
        questions: questions.map((q) => ({
          text: q.text.trim(),
          type: q.type,
          points: Number(q.points) || 1,
          explanation: q.explanation ? q.explanation.trim() : undefined,
          options: q.options.map((o) => ({
            id: o.id,
            text: o.text.trim(),
            isCorrect: o.isCorrect,
          })),
        })),
      });

      setShowCreateModal(false);
      setNewQuizTitle('');
      setNewQuizDesc('');
      setNewQuizDuration(15);
      setQuestions([
        {
          id: 'q1',
          text: '',
          type: 'MULTIPLE_CHOICE',
          points: 1,
          explanation: '',
          options: [
            { id: 'opt_1', text: '', isCorrect: true },
            { id: 'opt_2', text: '', isCorrect: false },
          ],
        },
      ]);
      await loadQuizzesList();
    } catch (err) {
      setCreateError(err.message || 'Failed to create quiz');
    } finally {
      setCreating(false);
    }
  };

  // Publish Quiz
  const handlePublish = async (quizId) => {
    try {
      await publishQuiz(quizId);
      await loadQuizzesList();
    } catch (err) {
      alert(err.message || 'Failed to publish quiz');
    }
  };

  // Delete Quiz
  const handleDelete = async (quizId) => {
    if (!window.confirm('Are you sure you want to delete this quiz?')) return;
    setDeletingId(quizId);
    try {
      await deleteQuiz(quizId);
      await loadQuizzesList();
    } catch (err) {
      alert(err.message || 'Failed to delete quiz');
    } finally {
      setDeletingId(null);
    }
  };

  // Teacher: View Analytics
  const handleOpenAnalytics = async (quiz) => {
    setAnalyticsQuiz(quiz);
    setLoadingAnalytics(true);
    try {
      const data = await getQuizAnalytics(quiz.id);
      setAnalyticsData(data);
    } catch (err) {
      console.error(err);
      setAnalyticsData(null);
    } finally {
      setLoadingAnalytics(false);
    }
  };

  // Teacher: Export CSV Gradebook
  const handleExportCSV = () => {
    if (!analyticsData || !analyticsData.submissions) return;
    const headers = ['Student Name', 'Student Email', 'Score', 'Max Points', 'Percentage', 'Submission Date'];
    const rows = analyticsData.submissions.map((s) => [
      `"${(s.studentName || '').replace(/"/g, '""')}"`,
      `"${(s.studentEmail || '').replace(/"/g, '""')}"`,
      s.score,
      s.maxScore,
      `${s.percentage}%`,
      `"${new Date(s.submittedAt).toLocaleString()}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Gradebook_${(analyticsQuiz?.title || 'Quiz').replace(/\s+/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Student: Start Taking Quiz (Strict One Attempt Rule)
  const handleStartTakingQuiz = async (quiz) => {
    if (quiz.submitted) {
      handleViewResult(quiz.id);
      return;
    }
    setTakeError('');
    setLoading(true);
    try {
      const details = await getQuizDetails(quiz.id);
      if (details.alreadySubmitted && (details.result || details.submission)) {
        setTakingQuiz(null);
        setResultModal(details.result || details.submission);
        await loadQuizzesList();
        return;
      }
      setTakingQuiz(details);
      setCurrentQuestionIdx(0);
      setStudentAnswers({});
      setTabSwitches(0);
    } catch (err) {
      alert(err.message || 'Failed to load quiz');
    } finally {
      setLoading(false);
    }
  };

  // Student: Answer selection
  const handleSelectOption = (questionId, optionId) => {
    setStudentAnswers((prev) => ({
      ...prev,
      [questionId]: optionId,
    }));
  };

  // Student: Submit Answers
  const handleSubmitQuizAnswers = async () => {
    if (!takingQuiz) return;
    const answeredCount = Object.keys(studentAnswers).length;
    const totalCount = takingQuiz.questions?.length || 0;

    if (
      answeredCount < totalCount &&
      !window.confirm(
        `You have answered ${answeredCount} of ${totalCount} questions. Are you sure you want to submit? Unanswered questions will receive 0 points.`
      )
    ) {
      return;
    }

    setSubmittingQuiz(true);
    setTakeError('');
    try {
      const answersList = (takingQuiz.questions || []).map((q) => ({
        questionId: q.id,
        selectedOptionId: studentAnswers[q.id] !== undefined ? studentAnswers[q.id] : null,
      }));

      const answersPayload = {
        studentId: currentUser?.id,
        answers: answersList,
      };

      const result = await submitQuiz(takingQuiz.id, answersPayload);
      setTakingQuiz(null);
      setSecondsLeft(null);
      setResultModal(result);
      await loadQuizzesList();
    } catch (err) {
      setTakeError(err.message || 'Submission failed. Please try again.');
    } finally {
      setSubmittingQuiz(false);
    }
  };

  // Student: View Past Result
  const handleViewResult = async (quizId) => {
    setLoadingResult(true);
    try {
      const data = await getSubmissionResult(quizId);
      setResultModal(data);
    } catch (err) {
      alert(err.message || 'Failed to load quiz results');
    } finally {
      setLoadingResult(false);
    }
  };

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', textAlign: 'left' }}>
      {/* Header Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '24px',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div>
          <h2
            style={{
              fontSize: '1.4rem',
              fontWeight: '700',
              margin: '0 0 4px 0',
              color: '#16181b',
            }}
          >
            {isTeacher ? 'Classroom Quizzes' : 'Available Quizzes'}
          </h2>
          <p style={{ margin: 0, fontSize: '0.875rem', color: '#6b7280' }}>
            {isTeacher
              ? 'Create deterministic assessments, generate questions with AI, and analyze student analytics.'
              : 'Test your knowledge with live countdown timers, instant feedback, and answer explanations.'}
          </p>
        </div>

        {isTeacher && (
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '10px 16px',
                background: '#f0fdf4',
                color: '#15803d',
                border: '1px solid #bbf7d0',
                borderRadius: '20px',
                fontSize: '0.875rem',
                fontWeight: '600',
                cursor: 'pointer',
              }}
              onClick={() => {
                setAiTopic('');
                setAiError('');
                setShowAIModal(true);
              }}
            >
              <Sparkles size={16} /> AI Quiz Generator
            </button>

            <button
              type="button"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '10px 18px',
                background: '#14785c',
                color: '#ffffff',
                border: 'none',
                borderRadius: '20px',
                fontSize: '0.875rem',
                fontWeight: '600',
                cursor: 'pointer',
                boxShadow: '0 2px 4px rgba(20, 120, 92, 0.2)',
              }}
              onClick={() => setShowCreateModal(true)}
            >
              <Plus size={16} /> Create Quiz
            </button>
          </div>
        )}
      </div>

      {error && (
        <div
          style={{
            padding: '12px 16px',
            backgroundColor: '#fee2e2',
            color: '#b91c1c',
            borderRadius: '10px',
            marginBottom: '16px',
            fontSize: '0.875rem',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {/* Quizzes Grid */}
      {loading ? (
        <div
          style={{
            padding: '60px 20px',
            textAlign: 'center',
            background: '#ffffff',
            borderRadius: '16px',
            border: '1px solid #e5e7eb',
          }}
        >
          <Loader2
            size={32}
            className="animate-spin"
            style={{ margin: '0 auto 12px', color: '#14785c' }}
          />
          <p style={{ color: '#6b7280', margin: 0 }}>Loading quizzes...</p>
        </div>
      ) : quizzes.length === 0 ? (
        <div
          style={{
            padding: '60px 20px',
            textAlign: 'center',
            background: '#ffffff',
            borderRadius: '16px',
            border: '1px solid #e5e7eb',
          }}
        >
          <BookOpen
            size={40}
            style={{ margin: '0 auto 12px', color: '#9ca3af', opacity: 0.8 }}
          />
          <h3 style={{ margin: '0 0 6px 0', fontSize: '1.1rem', color: '#16181b' }}>
            No Quizzes Available
          </h3>
          <p style={{ color: '#6b7280', margin: 0, fontSize: '0.875rem' }}>
            {isTeacher
              ? 'Click "AI Quiz Generator" or "Create Quiz" to publish your first assessment.'
              : 'There are no active quizzes in this classroom right now.'}
          </p>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 280px), 1fr))',
            gap: '16px',
          }}
        >
          {quizzes.map((quiz) => {
            const isSubmitted = quiz.submitted === true;
            const scorePercentage =
              quiz.maxScore && quiz.maxScore > 0
                ? Math.round((quiz.score / quiz.maxScore) * 100)
                : null;

            return (
              <div
                key={quiz.id}
                style={{
                  background: '#ffffff',
                  border: '1px solid #e5e7eb',
                  borderRadius: '16px',
                  padding: '20px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '14px',
                  transition: 'all 0.15s ease',
                }}
              >
                <div
                  onClick={() => {
                    if (!isTeacher && isSubmitted) {
                      handleViewResult(quiz.id);
                    }
                  }}
                  style={{ cursor: !isTeacher && isSubmitted ? 'pointer' : 'default' }}
                >
                  {/* Top Badges */}
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '10px',
                      gap: '8px',
                    }}
                  >
                    <span
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: '600',
                        color: '#0369a1',
                        background: '#e0f2fe',
                        padding: '3px 8px',
                        borderRadius: '6px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      <Clock size={12} /> {quiz.durationMinutes || 15} mins · {quiz.questionCount || 0} Qs
                    </span>

                    {isTeacher ? (
                      <span
                        style={{
                          fontSize: '0.72rem',
                          fontWeight: '600',
                          color: quiz.isPublished ? '#15803d' : '#b45309',
                          background: quiz.isPublished ? '#dcfce7' : '#fef3c7',
                          padding: '3px 8px',
                          borderRadius: '6px',
                        }}
                      >
                        {quiz.isPublished ? 'Published' : 'Draft'}
                      </span>
                    ) : isSubmitted ? (
                      <span
                        style={{
                          fontSize: '0.75rem',
                          fontWeight: '600',
                          color: '#15803d',
                          background: '#dcfce7',
                          padding: '3px 8px',
                          borderRadius: '6px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        <CheckCircle2 size={12} /> Completed ({scorePercentage}%)
                      </span>
                    ) : null}
                  </div>

                  <h3
                    style={{
                      margin: '0 0 6px 0',
                      fontSize: '1.05rem',
                      fontWeight: '700',
                      color: '#16181b',
                    }}
                  >
                    {quiz.title}
                  </h3>

                  {quiz.description && (
                    <p
                      style={{
                        margin: 0,
                        fontSize: '0.825rem',
                        color: '#6b7280',
                        lineHeight: 1.4,
                      }}
                    >
                      {quiz.description}
                    </p>
                  )}
                </div>

                {/* Footer Actions */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingTop: '12px',
                    borderTop: '1px solid #f3f4f6',
                    gap: '8px',
                  }}
                >
                  {isTeacher ? (
                    <>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          type="button"
                          style={{
                            padding: '6px 12px',
                            borderRadius: '8px',
                            border: '1px solid #d1d5db',
                            background: '#fff',
                            color: '#374151',
                            fontSize: '0.8rem',
                            fontWeight: '600',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                          onClick={() => handleOpenAnalytics(quiz)}
                        >
                          <BarChart3 size={14} /> Analytics
                        </button>

                        {!quiz.isPublished && (
                          <button
                            type="button"
                            style={{
                              padding: '6px 12px',
                              borderRadius: '8px',
                              border: 'none',
                              background: '#14785c',
                              color: '#fff',
                              fontSize: '0.8rem',
                              fontWeight: '600',
                              cursor: 'pointer',
                            }}
                            onClick={() => handlePublish(quiz.id)}
                          >
                            Publish
                          </button>
                        )}
                      </div>

                      <button
                        type="button"
                        style={{
                          padding: '6px',
                          background: 'none',
                          border: 'none',
                          color: '#ef4444',
                          cursor: 'pointer',
                        }}
                        disabled={deletingId === quiz.id}
                        onClick={() => handleDelete(quiz.id)}
                        title="Delete Quiz"
                      >
                        {deletingId === quiz.id ? (
                          <Loader2 size={16} className="animate-spin" />
                        ) : (
                          <Trash2 size={16} />
                        )}
                      </button>
                    </>
                  ) : (
                    <div style={{ display: 'flex', width: '100%', gap: '8px' }}>
                      {isSubmitted ? (
                        <button
                          type="button"
                          style={{
                            width: '100%',
                            padding: '8px 14px',
                            borderRadius: '8px',
                            border: '1px solid #d1d5db',
                            background: '#f8fafc',
                            color: '#1e293b',
                            fontSize: '0.825rem',
                            fontWeight: '600',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                          }}
                          onClick={() => handleViewResult(quiz.id)}
                        >
                          <Eye size={14} /> Review Results ({quiz.score}/{quiz.maxScore} pts)
                        </button>
                      ) : (
                        <button
                          type="button"
                          style={{
                            width: '100%',
                            padding: '8px 16px',
                            borderRadius: '8px',
                            border: 'none',
                            background: '#14785c',
                            color: '#fff',
                            fontSize: '0.85rem',
                            fontWeight: '600',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                          }}
                          onClick={() => handleStartTakingQuiz(quiz)}
                        >
                          Start Test <ChevronRight size={16} />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* TEACHER: AI Quiz Generator Modal */}
      {showAIModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1050,
            padding: '20px',
          }}
        >
          <div
            style={{
              backgroundColor: '#fff',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '500px',
              padding: '24px',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.15)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Sparkles size={20} style={{ color: '#14785c' }} />
                <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#16181b' }}>AI Quiz Generator</h3>
              </div>
              <button
                type="button"
                style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: '#9ca3af' }}
                onClick={() => setShowAIModal(false)}
              >
                ✕
              </button>
            </div>

            {aiError && (
              <div
                style={{
                  padding: '10px 14px',
                  backgroundColor: '#fee2e2',
                  color: '#b91c1c',
                  borderRadius: '8px',
                  marginBottom: '14px',
                  fontSize: '0.85rem',
                }}
              >
                {aiError}
              </div>
            )}

            <form onSubmit={handleGenerateAIQuiz}>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>
                  Lesson Topic / Subject *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Flutter Widget Structure, React Hooks, SQL Joins"
                  value={aiTopic}
                  onChange={(e) => setAiTopic(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid #d1d5db',
                    boxSizing: 'border-box',
                  }}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '18px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>
                    Number of Questions
                  </label>
                  <select
                    value={aiCount}
                    onChange={(e) => setAiCount(Number(e.target.value))}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '1px solid #d1d5db',
                    }}
                  >
                    <option value={3}>3 Questions</option>
                    <option value={5}>5 Questions</option>
                    <option value={8}>8 Questions</option>
                    <option value={10}>10 Questions</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>
                    Difficulty Level
                  </label>
                  <select
                    value={aiDifficulty}
                    onChange={(e) => setAiDifficulty(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '1px solid #d1d5db',
                    }}
                  >
                    <option value="Easy">Easy (Fundamentals)</option>
                    <option value="Medium">Medium (Applied)</option>
                    <option value="Hard">Hard (Advanced)</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button
                  type="button"
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    border: '1px solid #d1d5db',
                    background: '#fff',
                    color: '#374151',
                    fontWeight: '600',
                    cursor: 'pointer',
                  }}
                  onClick={() => setShowAIModal(false)}
                  disabled={generatingAI}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={generatingAI}
                  style={{
                    padding: '8px 18px',
                    borderRadius: '8px',
                    border: 'none',
                    background: '#14785c',
                    color: '#fff',
                    fontWeight: '600',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  {generatingAI ? (
                    <>
                      <Loader2 size={16} className="animate-spin" /> Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles size={16} /> Generate Quiz
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TEACHER: Create Quiz Modal */}
      {showCreateModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px',
          }}
        >
          <div
            style={{
              backgroundColor: '#fff',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '680px',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '28px',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h3 style={{ margin: '0 0 4px 0', fontSize: '1.3rem', color: '#16181b' }}>Create Classroom Quiz</h3>
                <span style={{ fontSize: '0.8rem', color: '#6b7280' }}>
                  Design assessment questions, set correct options, and add answer explanations
                </span>
              </div>
              <button
                type="button"
                style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: '#9ca3af' }}
                onClick={() => setShowCreateModal(false)}
              >
                ✕
              </button>
            </div>

            {createError && (
              <div
                style={{
                  padding: '10px 14px',
                  backgroundColor: '#fee2e2',
                  color: '#b91c1c',
                  borderRadius: '8px',
                  marginBottom: '16px',
                  fontSize: '0.85rem',
                }}
              >
                {createError}
              </div>
            )}

            <form onSubmit={handleSaveQuiz}>
              {/* General Info */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '20px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>
                    Quiz Title *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Flutter Widget Fundamentals"
                    value={newQuizTitle}
                    onChange={(e) => setNewQuizTitle(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '1px solid #d1d5db',
                      boxSizing: 'border-box',
                    }}
                    required
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>
                    Description (optional)
                  </label>
                  <input
                    type="text"
                    placeholder="Brief summary of what this quiz evaluates"
                    value={newQuizDesc}
                    onChange={(e) => setNewQuizDesc(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '1px solid #d1d5db',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>
                      Duration (Minutes)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="180"
                      value={newQuizDuration}
                      onChange={(e) => setNewQuizDuration(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: '8px',
                        border: '1px solid #d1d5db',
                        boxSizing: 'border-box',
                      }}
                      required
                    />
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingTop: '24px' }}>
                    <input
                      type="checkbox"
                      id="publishNow"
                      checked={newQuizPublish}
                      onChange={(e) => setNewQuizPublish(e.target.checked)}
                      style={{ width: '16px', height: '16px', accentColor: '#14785c' }}
                    />
                    <label htmlFor="publishNow" style={{ fontSize: '0.85rem', color: '#374151', fontWeight: '500', cursor: 'pointer' }}>
                      Publish to students immediately
                    </label>
                  </div>
                </div>
              </div>

              {/* Questions Section */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <h4 style={{ margin: 0, fontSize: '1rem', color: '#16181b' }}>
                    Questions ({questions.length})
                  </h4>
                  <button
                    type="button"
                    onClick={handleAddQuestion}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '6px 12px',
                      background: '#f3f4f6',
                      color: '#374151',
                      border: '1px solid #d1d5db',
                      borderRadius: '8px',
                      fontSize: '0.8rem',
                      fontWeight: '600',
                      cursor: 'pointer',
                    }}
                  >
                    <Plus size={14} /> Add Question
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {questions.map((q, qIdx) => (
                    <div
                      key={q.id || qIdx}
                      style={{
                        border: '1px solid #e5e7eb',
                        borderRadius: '12px',
                        padding: '16px',
                        background: '#fafafa',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                        <span style={{ fontWeight: '600', fontSize: '0.9rem', color: '#16181b' }}>
                          Question {qIdx + 1}
                        </span>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <select
                            value={q.type}
                            onChange={(e) => handleQuestionChange(qIdx, 'type', e.target.value)}
                            style={{
                              padding: '4px 8px',
                              borderRadius: '6px',
                              border: '1px solid #d1d5db',
                              fontSize: '0.8rem',
                            }}
                          >
                            <option value="MULTIPLE_CHOICE">Multiple Choice</option>
                            <option value="TRUE_FALSE">True / False</option>
                          </select>

                          <button
                            type="button"
                            onClick={() => handleRemoveQuestion(qIdx)}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: '#ef4444',
                              cursor: 'pointer',
                              padding: '4px',
                            }}
                            title="Remove Question"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>

                      <input
                        type="text"
                        placeholder="Enter question text here..."
                        value={q.text}
                        onChange={(e) => handleQuestionChange(qIdx, 'text', e.target.value)}
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          borderRadius: '6px',
                          border: '1px solid #d1d5db',
                          boxSizing: 'border-box',
                          marginBottom: '10px',
                        }}
                        required
                      />

                      {/* Options */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
                        <span style={{ fontSize: '0.75rem', color: '#6b7280', fontWeight: '500' }}>
                          Select the radio button next to the correct answer:
                        </span>

                        {q.options.map((opt, optIdx) => (
                          <div key={opt.id || optIdx} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <input
                              type="radio"
                              name={`correct_${qIdx}`}
                              checked={opt.isCorrect}
                              onChange={() => handleSetCorrectOption(qIdx, optIdx)}
                              style={{ width: '16px', height: '16px', accentColor: '#14785c' }}
                              title="Mark as correct answer"
                            />

                            <input
                              type="text"
                              placeholder={`Option ${optIdx + 1}`}
                              value={opt.text}
                              onChange={(e) => handleOptionTextChange(qIdx, optIdx, e.target.value)}
                              readOnly={q.type === 'TRUE_FALSE'}
                              style={{
                                flex: 1,
                                padding: '6px 10px',
                                borderRadius: '6px',
                                border: '1px solid #d1d5db',
                                fontSize: '0.85rem',
                                background: q.type === 'TRUE_FALSE' ? '#f3f4f6' : '#fff',
                              }}
                              required
                            />

                            {q.type === 'MULTIPLE_CHOICE' && q.options.length > 2 && (
                              <button
                                type="button"
                                onClick={() => handleRemoveOption(qIdx, optIdx)}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: '#9ca3af',
                                  cursor: 'pointer',
                                  padding: '2px',
                                }}
                              >
                                ✕
                              </button>
                            )}
                          </div>
                        ))}

                        {q.type === 'MULTIPLE_CHOICE' && q.options.length < 6 && (
                          <button
                            type="button"
                            onClick={() => handleAddOption(qIdx)}
                            style={{
                              alignSelf: 'flex-start',
                              padding: '4px 8px',
                              background: 'none',
                              border: 'none',
                              color: '#14785c',
                              fontSize: '0.8rem',
                              fontWeight: '600',
                              cursor: 'pointer',
                            }}
                          >
                            + Add Option
                          </button>
                        )}
                      </div>

                      {/* Educational Explanation */}
                      <div>
                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: '#4b5563', marginBottom: '4px' }}>
                          💡 Answer Explanation & Concept (Shown to students after submission):
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. StatefulWidget is required because it maintains state across widget rebuilds."
                          value={q.explanation || ''}
                          onChange={(e) => handleQuestionChange(qIdx, 'explanation', e.target.value)}
                          style={{
                            width: '100%',
                            padding: '6px 10px',
                            borderRadius: '6px',
                            border: '1px solid #d1d5db',
                            fontSize: '0.825rem',
                            boxSizing: 'border-box',
                            background: '#ffffff',
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Form Footer */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: '10px',
                  marginTop: '24px',
                  borderTop: '1px solid #e5e7eb',
                  paddingTop: '16px',
                }}
              >
                <button
                  type="button"
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    border: '1px solid #d1d5db',
                    background: '#fff',
                    color: '#374151',
                    fontWeight: '600',
                    cursor: 'pointer',
                  }}
                  onClick={() => setShowCreateModal(false)}
                  disabled={creating}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  style={{
                    padding: '8px 20px',
                    borderRadius: '8px',
                    border: 'none',
                    background: '#14785c',
                    color: '#fff',
                    fontWeight: '600',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  {creating ? (
                    <>
                      <Loader2 size={16} className="animate-spin" /> Saving...
                    </>
                  ) : (
                    'Save & Create Quiz'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TEACHER: Analytics Modal */}
      {analyticsQuiz && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px',
          }}
        >
          <div
            style={{
              backgroundColor: '#fff',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '660px',
              maxHeight: '85vh',
              overflowY: 'auto',
              padding: '24px',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h3 style={{ margin: '0 0 4px 0', fontSize: '1.2rem', color: '#16181b' }}>
                  Analytics: {analyticsQuiz.title}
                </h3>
                <span style={{ fontSize: '0.8rem', color: '#6b7280' }}>
                  Class-wide grading metrics, question difficulty & student scorebook
                </span>
              </div>
              <button
                type="button"
                style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: '#9ca3af' }}
                onClick={() => setAnalyticsQuiz(null)}
              >
                ✕
              </button>
            </div>

            {loadingAnalytics ? (
              <div style={{ padding: '40px 0', textAlign: 'center' }}>
                <Loader2 size={28} className="animate-spin" style={{ margin: '0 auto 8px', color: '#14785c' }} />
                <p style={{ color: '#6b7280' }}>Loading analytics...</p>
              </div>
            ) : !analyticsData ? (
              <p style={{ color: '#6b7280', textAlign: 'center', padding: '20px 0' }}>
                No analytics data available.
              </p>
            ) : (
              <div>
                {/* Stats Row */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: '12px',
                    marginBottom: '16px',
                  }}
                >
                  <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                    <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>Submissions</span>
                    <strong style={{ fontSize: '1.25rem', color: '#1e293b' }}>{analyticsData.totalSubmissions || 0}</strong>
                  </div>

                  <div style={{ background: '#f0fdf4', padding: '12px', borderRadius: '10px', border: '1px solid #bbf7d0', textAlign: 'center' }}>
                    <span style={{ fontSize: '0.75rem', color: '#166534', display: 'block' }}>Class Average</span>
                    <strong style={{ fontSize: '1.25rem', color: '#15803d' }}>{analyticsData.averageScore || 0} pts</strong>
                  </div>

                  <div style={{ background: '#f0f9ff', padding: '12px', borderRadius: '10px', border: '1px solid #bae6fd', textAlign: 'center' }}>
                    <span style={{ fontSize: '0.75rem', color: '#0369a1', display: 'block' }}>High / Low</span>
                    <strong style={{ fontSize: '1.25rem', color: '#0284c7' }}>
                      {analyticsData.highestScore || 0} / {analyticsData.lowestScore || 0}
                    </strong>
                  </div>
                </div>

                {/* Question Performance Breakdown */}
                {Array.isArray(analyticsData.questionStats) && analyticsData.questionStats.length > 0 && (
                  <div style={{ marginBottom: '20px' }}>
                    <h4 style={{ margin: '0 0 8px 0', fontSize: '0.925rem', color: '#16181b' }}>
                      Question Performance Breakdown
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {analyticsData.questionStats.map((qs) => (
                        <div
                          key={qs.questionId}
                          style={{
                            padding: '8px 12px',
                            background: '#fafafa',
                            border: '1px solid #e5e7eb',
                            borderRadius: '8px',
                            fontSize: '0.8rem',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                          }}
                        >
                          <span style={{ color: '#374151', flex: 1, marginRight: '10px' }}>
                            <strong>Q{qs.questionNumber}:</strong> {qs.questionText}
                          </span>
                          <span
                            style={{
                              fontWeight: '700',
                              color: qs.passRate >= 70 ? '#15803d' : qs.passRate >= 40 ? '#b45309' : '#dc2626',
                            }}
                          >
                            {qs.passRate}% correct ({qs.correctCount}/{qs.totalAnswers})
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Submissions List Header & Export */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <h4 style={{ margin: 0, fontSize: '0.95rem', color: '#16181b' }}>Student Submissions</h4>
                  {analyticsData.submissions?.length > 0 && (
                    <button
                      type="button"
                      onClick={handleExportCSV}
                      style={{
                        padding: '4px 10px',
                        borderRadius: '6px',
                        border: '1px solid #14785c',
                        background: '#f0fdf4',
                        color: '#15803d',
                        fontSize: '0.75rem',
                        fontWeight: '600',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      <Download size={13} /> Export CSV
                    </button>
                  )}
                </div>

                {analyticsData.submissions?.length === 0 ? (
                  <p style={{ color: '#8b9491', fontSize: '0.875rem' }}>No students have submitted this quiz yet.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '240px', overflowY: 'auto' }}>
                    {analyticsData.submissions.map((sub) => (
                      <div
                        key={sub.id}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '10px 14px',
                          border: '1px solid #e5e7eb',
                          borderRadius: '8px',
                          background: '#ffffff',
                        }}
                      >
                        <div>
                          <strong style={{ fontSize: '0.875rem', color: '#16181b' }}>{sub.studentName}</strong>
                          <span style={{ display: 'block', fontSize: '0.75rem', color: '#6b7280' }}>{sub.studentEmail}</span>
                        </div>

                        <div style={{ textAlign: 'right' }}>
                          <span style={{ fontWeight: '700', color: '#15803d', fontSize: '0.9rem' }}>
                            {sub.percentage}% ({sub.score}/{sub.maxScore} pts)
                          </span>
                          <span style={{ display: 'block', fontSize: '0.7rem', color: '#9ca3af' }}>
                            {new Date(sub.submittedAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
              <button
                type="button"
                style={{
                  padding: '8px 18px',
                  borderRadius: '8px',
                  border: '1px solid #d1d5db',
                  background: '#fff',
                  color: '#374151',
                  fontWeight: '600',
                  cursor: 'pointer',
                }}
                onClick={() => setAnalyticsQuiz(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STUDENT: Quiz Taking Interactive View */}
      {takingQuiz && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px',
          }}
        >
          <div
            style={{
              backgroundColor: '#fff',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '680px',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '28px',
              boxShadow: '0 25px 30px -5px rgba(0,0,0,0.15)',
            }}
          >
            {/* Header & Live Countdown Timer */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '14px',
                borderBottom: '1px solid #e5e7eb',
                paddingBottom: '12px',
              }}
            >
              <div>
                <h3 style={{ margin: '0 0 2px 0', fontSize: '1.25rem', color: '#16181b' }}>{takingQuiz.title}</h3>
                <span style={{ fontSize: '0.8rem', color: '#6b7280' }}>
                  Question {currentQuestionIdx + 1} of {takingQuiz.questions?.length || 0}
                </span>
              </div>

              {/* Countdown Timer Pill */}
              <div
                style={{
                  fontSize: '0.85rem',
                  fontWeight: '700',
                  color:
                    secondsLeft !== null && secondsLeft <= 30
                      ? '#b91c1c'
                      : secondsLeft !== null && secondsLeft <= 120
                      ? '#b45309'
                      : '#0369a1',
                  background:
                    secondsLeft !== null && secondsLeft <= 30
                      ? '#fee2e2'
                      : secondsLeft !== null && secondsLeft <= 120
                      ? '#fef3c7'
                      : '#e0f2fe',
                  border:
                    secondsLeft !== null && secondsLeft <= 30
                      ? '1px solid #fca5a5'
                      : secondsLeft !== null && secondsLeft <= 120
                      ? '1px solid #fde68a'
                      : '1px solid #bae6fd',
                  padding: '5px 12px',
                  borderRadius: '20px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  animation: secondsLeft !== null && secondsLeft <= 30 ? 'pulse 1s infinite' : 'none',
                }}
              >
                <Clock size={15} /> Time Left: {formatTimer(secondsLeft)}
              </div>
            </div>

            {/* Tab switch warning */}
            {tabSwitches > 0 && (
              <div
                style={{
                  padding: '8px 12px',
                  backgroundColor: '#fffbeb',
                  border: '1px solid #fde68a',
                  color: '#b45309',
                  borderRadius: '8px',
                  marginBottom: '14px',
                  fontSize: '0.8rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <AlertTriangle size={15} />
                <span>
                  Notice: Tab switch detected (<strong>{tabSwitches}</strong>). Please keep this quiz tab active until completion.
                </span>
              </div>
            )}

            {/* Question Navigator Grid / Palette */}
            {Array.isArray(takingQuiz.questions) && takingQuiz.questions.length > 1 && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  marginBottom: '18px',
                  overflowX: 'auto',
                  paddingBottom: '4px',
                }}
              >
                <span style={{ fontSize: '0.75rem', fontWeight: '600', color: '#6b7280', marginRight: '4px' }}>
                  Jump to:
                </span>
                {takingQuiz.questions.map((q, idx) => {
                  const isAnswered = studentAnswers[q.id] !== undefined && studentAnswers[q.id] !== null;
                  const isCurrent = currentQuestionIdx === idx;

                  return (
                    <button
                      key={q.id || idx}
                      type="button"
                      onClick={() => setCurrentQuestionIdx(idx)}
                      style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '8px',
                        border: isCurrent ? '2px solid #14785c' : '1px solid #d1d5db',
                        background: isAnswered ? '#dcfce7' : '#f9fafb',
                        color: isAnswered ? '#15803d' : '#374151',
                        fontSize: '0.8rem',
                        fontWeight: isCurrent || isAnswered ? '700' : '500',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {idx + 1}
                    </button>
                  );
                })}
              </div>
            )}

            {takeError && (
              <div
                style={{
                  padding: '10px 14px',
                  backgroundColor: '#fee2e2',
                  color: '#b91c1c',
                  borderRadius: '8px',
                  marginBottom: '16px',
                  fontSize: '0.85rem',
                }}
              >
                {takeError}
              </div>
            )}

            {/* Current Question */}
            {takingQuiz.questions && takingQuiz.questions[currentQuestionIdx] && (
              <div>
                <div
                  style={{
                    fontSize: '1.05rem',
                    fontWeight: '600',
                    color: '#16181b',
                    marginBottom: '18px',
                    lineHeight: 1.4,
                  }}
                >
                  {takingQuiz.questions[currentQuestionIdx].text}
                </div>

                {/* Options List */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {takingQuiz.questions[currentQuestionIdx].options.map((opt) => {
                    const questionId = takingQuiz.questions[currentQuestionIdx].id;
                    const isSelected = studentAnswers[questionId] === opt.id;

                    return (
                      <div
                        key={opt.id}
                        onClick={() => handleSelectOption(questionId, opt.id)}
                        style={{
                          padding: '12px 16px',
                          borderRadius: '10px',
                          border: isSelected ? '2px solid #14785c' : '1px solid #e5e7eb',
                          backgroundColor: isSelected ? '#f3f7f5' : '#ffffff',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <div
                          style={{
                            width: '18px',
                            height: '18px',
                            borderRadius: '50%',
                            border: isSelected ? '5px solid #14785c' : '2px solid #d1d5db',
                            backgroundColor: '#fff',
                            flexShrink: 0,
                          }}
                        />
                        <span
                          style={{
                            fontSize: '0.92rem',
                            color: isSelected ? '#14785c' : '#374151',
                            fontWeight: isSelected ? '600' : '400',
                          }}
                        >
                          {opt.text}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Question Navigation & Submit */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginTop: '28px',
                borderTop: '1px solid #e5e7eb',
                paddingTop: '16px',
              }}
            >
              <button
                type="button"
                onClick={() => setCurrentQuestionIdx((prev) => Math.max(0, prev - 1))}
                disabled={currentQuestionIdx === 0}
                style={{
                  padding: '8px 14px',
                  borderRadius: '8px',
                  border: '1px solid #d1d5db',
                  background: '#fff',
                  color: currentQuestionIdx === 0 ? '#9ca3af' : '#374151',
                  cursor: currentQuestionIdx === 0 ? 'not-allowed' : 'pointer',
                  fontWeight: '600',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <ChevronLeft size={16} /> Previous
              </button>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setTakingQuiz(null)}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '8px',
                    border: '1px solid #d1d5db',
                    background: '#fff',
                    color: '#6b7280',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>

                {currentQuestionIdx < (takingQuiz.questions?.length || 0) - 1 ? (
                  <button
                    type="button"
                    onClick={() =>
                      setCurrentQuestionIdx((prev) =>
                        Math.min((takingQuiz.questions?.length || 1) - 1, prev + 1)
                      )
                    }
                    style={{
                      padding: '8px 18px',
                      borderRadius: '8px',
                      border: 'none',
                      background: '#14785c',
                      color: '#fff',
                      fontWeight: '600',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    Next <ChevronRight size={16} />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleSubmitQuizAnswers}
                    disabled={submittingQuiz}
                    style={{
                      padding: '8px 22px',
                      borderRadius: '8px',
                      border: 'none',
                      background: '#14785c',
                      color: '#fff',
                      fontWeight: '700',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    {submittingQuiz ? (
                      <>
                        <Loader2 size={16} className="animate-spin" /> Submitting...
                      </>
                    ) : (
                      <>
                        <Send size={15} /> Submit Quiz
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* STUDENT: Quiz Results & Educational Explanations Modal */}
      {resultModal && (() => {
        const totalQuestions = resultModal.totalQuestions || resultModal.answers?.length || 0;
        const correctCount = resultModal.correctCount !== undefined
          ? resultModal.correctCount
          : (resultModal.answers?.filter(a => a.isCorrect).length || 0);
        const incorrectCount = resultModal.incorrectCount !== undefined
          ? resultModal.incorrectCount
          : Math.max(0, totalQuestions - correctCount);
        const submittedDateStr = resultModal.submittedAt
          ? new Date(resultModal.submittedAt).toLocaleString(undefined, {
              dateStyle: 'medium',
              timeStyle: 'short',
            })
          : 'Recorded';

        return (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(0,0,0,0.6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000,
              padding: '20px',
            }}
          >
            <div
              style={{
                backgroundColor: '#fff',
                borderRadius: '16px',
                width: '100%',
                maxWidth: '680px',
                maxHeight: '88vh',
                overflowY: 'auto',
                padding: '28px',
                boxShadow: '0 25px 30px -5px rgba(0,0,0,0.15)',
              }}
            >
              {/* Header with Title & Completion Badge */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px', gap: '12px' }}>
                <div>
                  <span
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: '700',
                      color: '#15803d',
                      background: '#dcfce7',
                      padding: '3px 8px',
                      borderRadius: '6px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      marginBottom: '6px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                    }}
                  >
                    <CheckCircle2 size={13} /> Quiz Completed · 1 Attempt Only
                  </span>
                  <h3 style={{ margin: '0 0 4px 0', fontSize: '1.35rem', fontWeight: '800', color: '#16181b' }}>
                    {resultModal.quizTitle || 'Quiz Results'}
                  </h3>
                  <p style={{ margin: 0, fontSize: '0.825rem', color: '#6b7280' }}>
                    Submitted on <strong>{submittedDateStr}</strong>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setResultModal(null)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#9ca3af',
                    cursor: 'pointer',
                    fontSize: '1.2rem',
                    padding: '4px',
                  }}
                >
                  ✕
                </button>
              </div>

              {/* Score Banner & Stats Grid */}
              <div
                style={{
                  padding: '18px 20px',
                  borderRadius: '12px',
                  background: resultModal.percentage >= 70 ? '#f0fdf4' : '#fff7ed',
                  border: resultModal.percentage >= 70 ? '1px solid #bbf7d0' : '1px solid #ffedd5',
                  marginBottom: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '16px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div
                    style={{
                      width: '48px',
                      height: '48px',
                      borderRadius: '12px',
                      background: resultModal.percentage >= 70 ? '#dcfce7' : '#ffedd5',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: resultModal.percentage >= 70 ? '#15803d' : '#c2410c',
                    }}
                  >
                    <Award size={28} />
                  </div>
                  <div>
                    <div style={{ fontSize: '1.5rem', fontWeight: '800', color: '#16181b', lineHeight: 1 }}>
                      {resultModal.percentage}%
                    </div>
                    <div style={{ fontSize: '0.85rem', color: '#4b5563', marginTop: '2px' }}>
                      Score: <strong>{resultModal.score}</strong> / {resultModal.maxScore} pts
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                  <div style={{ padding: '6px 12px', background: '#ffffff', borderRadius: '8px', border: '1px solid #e5e7eb', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.75rem', color: '#6b7280', fontWeight: '500' }}>Total Questions</div>
                    <div style={{ fontSize: '0.95rem', fontWeight: '700', color: '#16181b' }}>{totalQuestions}</div>
                  </div>
                  <div style={{ padding: '6px 12px', background: '#ffffff', borderRadius: '8px', border: '1px solid #e5e7eb', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.75rem', color: '#15803d', fontWeight: '600' }}>Correct</div>
                    <div style={{ fontSize: '0.95rem', fontWeight: '700', color: '#15803d' }}>{correctCount}</div>
                  </div>
                  <div style={{ padding: '6px 12px', background: '#ffffff', borderRadius: '8px', border: '1px solid #e5e7eb', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.75rem', color: '#dc2626', fontWeight: '600' }}>Incorrect</div>
                    <div style={{ fontSize: '0.95rem', fontWeight: '700', color: '#dc2626' }}>{incorrectCount}</div>
                  </div>
                </div>
              </div>

              {/* Answer Breakdown */}
              <h4 style={{ margin: '0 0 12px 0', fontSize: '1rem', fontWeight: '700', color: '#16181b' }}>
                Question Breakdown & Correct Answers
              </h4>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {resultModal.answers?.map((ans, idx) => (
                  <div
                    key={ans.questionId || idx}
                    style={{
                      padding: '16px',
                      border: ans.isCorrect ? '1px solid #bbf7d0' : '1px solid #fecaca',
                      borderRadius: '12px',
                      background: ans.isCorrect ? '#fcfdfd' : '#fffcfc',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        gap: '8px',
                      }}
                    >
                      <span style={{ fontWeight: '700', fontSize: '0.92rem', color: '#16181b' }}>
                        Question {idx + 1}: {ans.questionText}
                      </span>
                      <span
                        style={{
                          fontSize: '0.75rem',
                          fontWeight: '700',
                          color: ans.isCorrect ? '#15803d' : '#dc2626',
                          background: ans.isCorrect ? '#dcfce7' : '#fee2e2',
                          padding: '2px 8px',
                          borderRadius: '6px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          flexShrink: 0,
                        }}
                      >
                        {ans.isCorrect ? (
                          <>
                            <CheckCircle2 size={13} /> Correct (+{ans.pointsAwarded} pt)
                          </>
                        ) : (
                          <>
                            <XCircle size={13} /> Incorrect (0 pt)
                          </>
                        )}
                      </span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '2px' }}>
                      <div style={{ fontSize: '0.85rem', color: '#4b5563' }}>
                        <span style={{ fontWeight: '600' }}>Your answer: </span>
                        <strong style={{ color: ans.isCorrect ? '#15803d' : '#dc2626' }}>
                          {ans.selectedText || 'No answer selected'}
                        </strong>
                      </div>

                      <div style={{ fontSize: '0.85rem', color: '#15803d' }}>
                        <span style={{ fontWeight: '600', color: '#374151' }}>Correct answer: </span>
                        <strong style={{ color: '#15803d' }}>
                          {ans.correctText || 'Answer recorded'}
                        </strong>
                      </div>

                      <div style={{ fontSize: '0.825rem', color: '#6b7280' }}>
                        <span>Status: </span>
                        <strong style={{ color: ans.isCorrect ? '#15803d' : '#dc2626' }}>
                          {ans.isCorrect ? 'Correct' : 'Incorrect'}
                        </strong>
                      </div>
                    </div>

                    {ans.explanation && (
                      <div
                        style={{
                          marginTop: '4px',
                          padding: '8px 12px',
                          borderRadius: '8px',
                          backgroundColor: '#f8fafc',
                          border: '1px solid #e2e8f0',
                          fontSize: '0.825rem',
                          color: '#475569',
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: '8px',
                        }}
                      >
                        <Lightbulb size={15} style={{ color: '#eab308', flexShrink: 0, marginTop: '2px' }} />
                        <span>
                          <strong>Explanation:</strong> {ans.explanation}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '24px' }}>
                <button
                  type="button"
                  style={{
                    padding: '8px 24px',
                    borderRadius: '8px',
                    border: 'none',
                    background: '#14785c',
                    color: '#fff',
                    fontWeight: '700',
                    cursor: 'pointer',
                  }}
                  onClick={() => setResultModal(null)}
                >
                  Close Results
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
