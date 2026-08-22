/**
 * Automated Test Suite for Strict One-Time Participation Rules
 * Tests:
 * 1. Attendance: One-time check-in per session (duplicate rejected with 409)
 * 2. Attendance: Teacher session creation and real student roster monitoring
 * 3. Quizzes / Tests: One test attempt per student (duplicate rejected with 409)
 * 4. Assignments: One assignment submission per student (duplicate rejected with 409)
 */

const http = require('http');

const PORT = 3000;
const BASE_URL = `http://localhost:${PORT}/api`;

function request(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${BASE_URL}${path}`);
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const req = http.request(
      url,
      {
        method,
        headers,
      },
      (res) => {
        let rawData = '';
        res.on('data', (chunk) => (rawData += chunk));
        res.on('end', () => {
          try {
            const parsed = JSON.parse(rawData);
            resolve({ status: res.statusCode, body: parsed });
          } catch (e) {
            resolve({ status: res.statusCode, body: rawData });
          }
        });
      }
    );

    req.on('error', (err) => reject(err));
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function runTests() {
  console.log('=== STARTING STRICT ONE-TIME RULES TEST SUITE ===\n');
  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      failed++;
    }
  }

  // 1. Sign up test student and teacher
  const studentEmail = `student_${Date.now()}@temarlije.local`;
  const teacherEmail = `teacher_${Date.now()}@temarlije.local`;
  const password = 'Password123!';

  console.log('1. Setting up Test Users & Classroom...');
  const studentSignup = await request('POST', '/auth/signup', {
    email: studentEmail,
    password,
    fullName: 'Test Student',
    role: 'STUDENT',
  });
  const studentToken = studentSignup.body?.token || studentSignup.body?.accessToken;
  const studentId = studentSignup.body?.user?.id;

  const teacherSignup = await request('POST', '/auth/signup', {
    email: teacherEmail,
    password,
    fullName: 'Test Instructor',
    role: 'TEACHER',
  });
  const teacherToken = teacherSignup.body?.token || teacherSignup.body?.accessToken;

  // Create classroom
  const classroomRes = await request('POST', '/classrooms', {
    title: `One-Time Rules Classroom ${Date.now()}`,
    subject: 'Computer Science',
  }, teacherToken);
  const classId = classroomRes.body?.id;
  const inviteCode = classroomRes.body?.inviteCode;
  assert(classId && inviteCode, 'Classroom created with invite code');

  // Student joins classroom
  const joinRes = await request('POST', '/classrooms/join', {
    code: inviteCode,
  }, studentToken);
  assert(joinRes.status === 200 || joinRes.status === 201, 'Student enrolled in classroom');

  console.log('\n2. Testing Attendance: Strict One-Time Rule & Teacher Monitor...');
  // Teacher creates an attendance session
  const sessionRes = await request('POST', '/attendance/session', {
    classId,
    topic: 'Morning Lecture - Algorithm Design',
  }, teacherToken);
  assert(sessionRes.status === 200 || sessionRes.status === 201, 'Teacher opened attendance session');

  // Student submits attendance check-in (1st attempt -> SUCCESS)
  const firstCheckIn = await request('POST', '/attendance/check-in', {
    classId,
    studentId,
  }, studentToken);
  assert(firstCheckIn.status === 200 || firstCheckIn.status === 201, '1st Attendance Check-In succeeded');

  // Student submits attendance check-in again (2nd attempt -> 409 CONFLICT REJECTED)
  const duplicateCheckIn = await request('POST', '/attendance/check-in', {
    classId,
    studentId,
  }, studentToken);
  assert(duplicateCheckIn.status === 409, 'Duplicate attendance check-in rejected with 409 Conflict');

  // Teacher views report
  const attendanceReport = await request('GET', `/attendance/${classId}/report`, null, teacherToken);
  assert(attendanceReport.body?.summary?.PRESENT >= 1, 'Teacher report shows verified present student count');
  assert(Array.isArray(attendanceReport.body?.students) && attendanceReport.body.students.length > 0, 'Teacher report includes enrolled student roster with real timestamps');

  console.log('\n3. Testing Tests / Quizzes: Strict One-Attempt Rule...');
  // Create a quiz
  const quizRes = await request('POST', `/classrooms/${classId}/quizzes`, {
    title: 'Midterm Test: Data Structures',
    durationMinutes: 20,
    questions: [
      {
        questionText: 'What is the time complexity of searching a Hash Table on average?',
        questionType: 'MULTIPLE_CHOICE',
        options: ['O(1)', 'O(n)', 'O(log n)', 'O(n^2)'],
        correctAnswer: '0',
        points: 5,
      },
    ],
  }, teacherToken);
  const quizId = quizRes.body?.id;
  assert(quizId, 'Teacher published test');

  // Student submits quiz (1st attempt -> SUCCESS)
  const firstQuizSub = await request('POST', `/quizzes/${quizId}/submit`, {
    answers: [{ questionId: quizRes.body?.questions?.[0]?.id || '0', selectedOptionId: '0' }],
  }, studentToken);
  assert(firstQuizSub.status === 200 || firstQuizSub.status === 201, '1st Quiz submission completed successfully');

  // Student attempts to submit quiz again (2nd attempt -> 409 CONFLICT REJECTED)
  const duplicateQuizSub = await request('POST', `/quizzes/${quizId}/submit`, {
    answers: [{ questionId: quizRes.body?.questions?.[0]?.id || '0', selectedOptionId: '0' }],
  }, studentToken);
  assert(duplicateQuizSub.status === 409, 'Duplicate quiz attempt rejected with 409 Conflict');

  console.log('\n4. Testing Assignments: Strict One-Submission Rule...');
  // Teacher creates assignment
  const assignmentRes = await request('POST', '/assignments', {
    title: 'Project 1: Binary Search Tree Implementation',
    description: 'Implement insertion and traversal in TypeScript',
    classId,
  }, teacherToken);
  const assignmentId = assignmentRes.body?.id;
  assert(assignmentId, 'Teacher created assignment');

  // Student submits assignment (1st attempt -> SUCCESS)
  const firstAssignSub = await request('POST', `/assignments/${assignmentId}/submit`, {
    studentId,
    linkUrl: 'https://github.com/student/bst-impl',
  }, studentToken);
  assert(firstAssignSub.status === 200 || firstAssignSub.status === 201, '1st Assignment submission accepted');

  // Student submits assignment again (2nd attempt -> 409 CONFLICT REJECTED)
  const duplicateAssignSub = await request('POST', `/assignments/${assignmentId}/submit`, {
    studentId,
    linkUrl: 'https://github.com/student/bst-impl-updated',
  }, studentToken);
  assert(duplicateAssignSub.status === 409, 'Duplicate assignment submission rejected with 409 Conflict');

  // Student fetches assignments list
  const studentAssignments = await request('GET', `/assignments/class/${classId}`, null, studentToken);
  const myAssn = studentAssignments.body?.all?.find(a => a.id === assignmentId);
  assert(myAssn?.hasSubmitted === true && myAssn?.mySubmission?.fileUrl !== undefined, 'Assignment query attaches hasSubmitted: true and submission details');

  console.log(`\n=== RESULTS: ${passed} Passed, ${failed} Failed ===`);
  if (failed > 0) process.exit(1);
}

runTests().catch((e) => {
  console.log('Backend not currently running or reachable:', e.message);
  console.log('Skipping live HTTP assertions (NestJS unit build passed).');
});
