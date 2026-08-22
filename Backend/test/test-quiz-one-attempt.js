const assert = require('assert');

// Test Quiz One-Attempt Invariants & Logic

function formatSubmission(submission) {
  const totalMaxScore = (submission.quiz?.questions || []).reduce(
    (sum, q) => sum + (q.points || 1),
    0
  ) || 1;

  let parsedAnswers = [];
  try {
    parsedAnswers =
      typeof submission.answers === 'string'
        ? JSON.parse(submission.answers)
        : submission.answers || [];
  } catch (e) {
    parsedAnswers = [];
  }

  const questionMap = new Map((submission.quiz?.questions || []).map((q) => [q.id, q]));
  let correctCount = 0;
  let incorrectCount = 0;

  const enrichedAnswers = parsedAnswers.map((ans) => {
    const q = questionMap.get(ans.questionId);
    const isCorrect = ans.isCorrect === true;
    if (isCorrect) correctCount++;
    else incorrectCount++;

    return {
      questionId: ans.questionId,
      questionText: ans.questionText || q?.questionText || 'Question',
      selectedOptionId: ans.selectedOptionId,
      selectedText: ans.selectedText || (ans.selectedOptionId ? String(ans.selectedOptionId) : 'No answer selected'),
      correctOptionId: ans.correctOptionId || q?.correctAnswer,
      correctText: ans.correctText || q?.correctAnswer || '',
      isCorrect,
      status: isCorrect ? 'Correct' : 'Incorrect',
      pointsAwarded: ans.pointsAwarded !== undefined ? ans.pointsAwarded : (isCorrect ? (q?.points || 1) : 0),
      maxPoints: ans.maxPoints || q?.points || 1,
      explanation: ans.explanation || '',
    };
  });

  const totalQuestions = submission.quiz?.questions?.length || enrichedAnswers.length;

  return {
    id: submission.id,
    submissionId: submission.id,
    quizId: submission.quizId,
    quizTitle: submission.quiz?.title || 'Quiz Results',
    score: submission.score || 0,
    maxScore: totalMaxScore,
    percentage: totalMaxScore > 0 ? Math.round(((submission.score || 0) / totalMaxScore) * 100) : 0,
    totalQuestions,
    correctCount,
    incorrectCount,
    submittedAt: submission.submittedAt,
    alreadySubmitted: true,
    answers: enrichedAnswers,
  };
}

function evaluateStudentQuiz({ quiz, studentId, submissionsDb, answersPayload }) {
  // Check if student has already submitted this quiz
  const existingSubmission = submissionsDb.find(
    (s) => s.quizId === quiz.id && s.studentId === studentId
  );

  if (existingSubmission) {
    return {
      isNewAttempt: false,
      result: formatSubmission({ ...existingSubmission, quiz }),
    };
  }

  // Grade quiz
  const totalMaxScore = quiz.questions.reduce((sum, q) => sum + (q.points || 1), 0);
  const answeredMap = new Map((answersPayload.answers || []).map((a) => [String(a.questionId), a]));

  let totalScore = 0;
  let correctCount = 0;
  let incorrectCount = 0;
  const answerRecords = [];

  for (const question of quiz.questions) {
    const submitted = answeredMap.get(String(question.id));
    const isCorrect = submitted && String(submitted.selectedOptionId) === String(question.correctAnswer);

    if (isCorrect) correctCount++;
    else incorrectCount++;

    const pointsAwarded = isCorrect ? (question.points || 1) : 0;
    totalScore += pointsAwarded;

    answerRecords.push({
      questionId: question.id,
      questionText: question.questionText,
      selectedOptionId: submitted?.selectedOptionId || null,
      selectedText: submitted ? `Option ${submitted.selectedOptionId}` : 'No answer selected',
      correctOptionId: question.correctAnswer,
      correctText: `Option ${question.correctAnswer}`,
      isCorrect: !!isCorrect,
      status: isCorrect ? 'Correct' : 'Incorrect',
      pointsAwarded,
      maxPoints: question.points || 1,
      explanation: question.explanation || '',
    });
  }

  const newSubmission = {
    id: `sub_${Date.now()}`,
    quizId: quiz.id,
    studentId,
    score: totalScore,
    answers: JSON.stringify(answerRecords),
    attemptNumber: 1,
    isLatest: true,
    submittedAt: new Date().toISOString(),
  };

  submissionsDb.push(newSubmission);

  return {
    isNewAttempt: true,
    result: formatSubmission({ ...newSubmission, quiz }),
  };
}

function getQuizForStudent({ quiz, studentId, submissionsDb }) {
  const existingSubmission = submissionsDb.find(
    (s) => s.quizId === quiz.id && s.studentId === studentId
  );

  if (existingSubmission) {
    const formatted = formatSubmission({ ...existingSubmission, quiz });
    return {
      id: quiz.id,
      title: quiz.title,
      description: quiz.description,
      alreadySubmitted: true,
      submission: formatted,
      result: formatted,
      questions: [],
    };
  }

  return {
    id: quiz.id,
    title: quiz.title,
    description: quiz.description,
    alreadySubmitted: false,
    submission: null,
    result: null,
    questions: quiz.questions,
  };
}

function runTests() {
  console.log('--- Starting Quiz One-Attempt Rule Verification ---');

  const mockQuiz = {
    id: 'quiz-react-hooks',
    title: 'React Hooks & State Mastery',
    description: 'Test your understanding of useEffect, useMemo, and useCallback',
    questions: [
      { id: 'q1', questionText: 'What does useEffect do?', correctAnswer: 'opt_1', points: 1, explanation: 'Runs side-effects' },
      { id: 'q2', questionText: 'What is 2 + 2?', correctAnswer: 'opt_4', points: 1, explanation: 'Math arithmetic' },
      { id: 'q3', questionText: 'What is the capital of France?', correctAnswer: 'opt_paris', points: 1, explanation: 'Geography' },
    ],
  };

  const submissionsDb = [];
  const student1 = 'student_alex';

  // 1. Initial State: Student has not attempted the quiz yet
  console.log('1. Checking student initial quiz view...');
  const initialView = getQuizForStudent({ quiz: mockQuiz, studentId: student1, submissionsDb });
  assert.strictEqual(initialView.alreadySubmitted, false);
  assert.strictEqual(initialView.questions.length, 3);
  console.log('✓ Student can access question list on first visit.');

  // 2. First Submission (1 correct, 2 incorrect)
  console.log('2. Student submits answers (1 of 3 correct)...');
  const firstSubmission = evaluateStudentQuiz({
    quiz: mockQuiz,
    studentId: student1,
    submissionsDb,
    answersPayload: {
      studentId: student1,
      answers: [
        { questionId: 'q1', selectedOptionId: 'opt_wrong' },
        { questionId: 'q2', selectedOptionId: 'opt_4' },
        { questionId: 'q3', selectedOptionId: 'opt_london' },
      ],
    },
  });

  assert.strictEqual(firstSubmission.isNewAttempt, true);
  assert.strictEqual(firstSubmission.result.alreadySubmitted, true);
  assert.strictEqual(firstSubmission.result.score, 1);
  assert.strictEqual(firstSubmission.result.maxScore, 3);
  assert.strictEqual(firstSubmission.result.totalQuestions, 3);
  assert.strictEqual(firstSubmission.result.correctCount, 1);
  assert.strictEqual(firstSubmission.result.incorrectCount, 2);
  assert.strictEqual(firstSubmission.result.answers.length, 3);
  assert.strictEqual(firstSubmission.result.answers[0].status, 'Incorrect');
  assert.strictEqual(firstSubmission.result.answers[1].status, 'Correct');
  assert.strictEqual(firstSubmission.result.answers[2].status, 'Incorrect');
  assert.strictEqual(submissionsDb.length, 1);
  console.log('✓ First attempt graded and permanently stored in database.');

  // 3. Second Submission by same student (Must NOT create duplicate attempt, returns existing result)
  console.log('3. Student attempts to submit again (Retake prevention)...');
  const secondSubmission = evaluateStudentQuiz({
    quiz: mockQuiz,
    studentId: student1,
    submissionsDb,
    answersPayload: {
      studentId: student1,
      answers: [
        { questionId: 'q1', selectedOptionId: 'opt_1' }, // all correct this time
        { questionId: 'q2', selectedOptionId: 'opt_4' },
        { questionId: 'q3', selectedOptionId: 'opt_paris' },
      ],
    },
  });

  assert.strictEqual(secondSubmission.isNewAttempt, false);
  assert.strictEqual(secondSubmission.result.score, 1); // retains original score
  assert.strictEqual(submissionsDb.length, 1, 'Database must only contain 1 attempt');
  console.log('✓ Retake prevented: Returned existing attempt and rejected duplicate submission.');

  // 4. Student navigates back to quiz (Must return alreadySubmitted = true, redirect to results)
  console.log('4. Student navigates back to quiz URL / clicks quiz card...');
  const returningView = getQuizForStudent({ quiz: mockQuiz, studentId: student1, submissionsDb });
  assert.strictEqual(returningView.alreadySubmitted, true);
  assert.strictEqual(returningView.questions.length, 0, 'Questions must be empty to prevent retakes');
  assert.strictEqual(returningView.result.score, 1);
  assert.strictEqual(returningView.result.correctCount, 1);
  assert.strictEqual(returningView.result.incorrectCount, 2);
  assert.strictEqual(returningView.result.answers.length, 3);
  console.log('✓ Returning student redirected directly to complete Results breakdown.');

  console.log('\n🎉 ALL QUIZ ONE-ATTEMPT INVARIANTS AND TESTS PASSED! 🎉\n');
}

runTests();
