import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Seeding database...');

  // --- Users ---
  const passwordHash = await bcrypt.hash('Password123!', 10);

  const teacher1 = await prisma.users.create({
    data: {
      email: 'abebe.tadesse@temarlije.test',
      password_hash: passwordHash,
      full_name: 'Abebe Tadesse',
      role: 'TEACHER',
    },
  });

  const teacher2 = await prisma.users.create({
    data: {
      email: 'sara.mekonnen@temarlije.test',
      password_hash: passwordHash,
      full_name: 'Sara Mekonnen',
      role: 'TEACHER',
    },
  });

  const student1 = await prisma.users.create({
    data: {
      email: 'kebede.alemu@temarlije.test',
      password_hash: passwordHash,
      full_name: 'Kebede Alemu',
      role: 'STUDENT',
    },
  });

  const student2 = await prisma.users.create({
    data: {
      email: 'hana.girma@temarlije.test',
      password_hash: passwordHash,
      full_name: 'Hana Girma',
      role: 'STUDENT',
    },
  });

  const admin = await prisma.users.create({
    data: {
      email: 'admin@temarlije.test',
      password_hash: passwordHash,
      full_name: 'Platform Admin',
      role: 'ADMIN',
    },
  });

  console.log('Created 5 users (2 teachers, 2 students, 1 admin)');

  // --- Classroom ---
  const classroom = await prisma.classrooms.create({
    data: {
      title: 'Flutter Fundamentals',
      subject: 'Mobile Development',
      description: 'Introduction to building cross-platform apps with Flutter.',
      invite_code: 'DB7GLU',
      created_by_id: teacher1.id,
    },
  });

  console.log('Created classroom:', classroom.title);

  // --- Co-teacher (BR: multiple teachers allowed) ---
  await prisma.classroom_teachers.create({
    data: {
      classroom_id: classroom.id,
      user_id: teacher1.id,
      is_owner: true,
    },
  });

  await prisma.classroom_teachers.create({
    data: {
      classroom_id: classroom.id,
      user_id: teacher2.id,
      is_owner: false,
    },
  });

  // --- Student enrollment ---
  await prisma.classroom_members.create({
    data: { classroom_id: classroom.id, user_id: student1.id },
  });

  await prisma.classroom_members.create({
    data: { classroom_id: classroom.id, user_id: student2.id },
  });

  console.log('Enrolled 2 teachers and 2 students in classroom');

  // --- Material ---
  const material = await prisma.materials.create({
    data: {
      title: 'Widget Structure Basics.pdf',
      file_url: 'https://storage.temarlije.test/materials/widget-structure-basics.pdf',
      file_type: 'PDF',
      file_size_bytes: BigInt(2_450_000),
      is_vectorized: true,
      classroom_id: classroom.id,
      uploaded_by_id: teacher1.id,
    },
  });

  console.log('Created material:', material.title);

  // --- Assignment + one submission (attempt 1, latest, graded) ---
  const assignment = await prisma.assignments.create({
    data: {
      title: 'Build a Stateless Widget',
      description: 'Create a simple stateless widget that displays your name and favorite color.',
      due_date: new Date('2026-09-01T23:59:00Z'),
      total_points: 100,
      classroom_id: classroom.id,
      created_by_id: teacher1.id,
    },
  });

  await prisma.assignment_submissions.create({
    data: {
      assignment_id: assignment.id,
      student_id: student1.id,
      attempt_number: 1,
      is_latest: true,
      submission_text: 'Here is my widget implementation, see attached file.',
      file_url: 'https://storage.temarlije.test/submissions/kebede-widget.dart',
      grade: 92.5,
      feedback: 'Great work! Minor styling improvements possible.',
    },
  });

  console.log('Created assignment with 1 graded submission');

  // --- Quiz + question + one submission ---
  const quiz = await prisma.quizzes.create({
    data: {
      title: 'Widget Basics Quiz',
      description: 'Quick check on stateless vs stateful widgets.',
      duration_minutes: 15,
      is_published: true,
      classroom_id: classroom.id,
    },
  });

  const question = await prisma.quiz_questions.create({
    data: {
      quiz_id: quiz.id,
      question_text: 'Which widget type rebuilds when its internal state changes?',
      question_type: 'MULTIPLE_CHOICE',
      options: ['StatelessWidget', 'StatefulWidget', 'InheritedWidget', 'RenderObject'],
      correct_answer: 'StatefulWidget',
      points: 10,
    },
  });

  await prisma.quiz_submissions.create({
    data: {
      quiz_id: quiz.id,
      student_id: student1.id,
      attempt_number: 1,
      is_latest: true,
      score: 10,
      answers: { [question.id]: 'StatefulWidget' },
    },
  });

  console.log('Created quiz with 1 question and 1 submission');

  // --- Attendance session + record ---
  const session = await prisma.attendance_sessions.create({
    data: {
      classroom_id: classroom.id,
      session_code: 'CHKIN1',
      is_active: false,
      ended_at: new Date(),
    },
  });

  await prisma.attendance_records.create({
    data: {
      session_id: session.id,
      student_id: student1.id,
      status: 'PRESENT',
    },
  });

  console.log('Created attendance session with 1 record');

  // --- Study group (creator NOT auto-joined, per BR-01) ---
  const studyGroup = await prisma.study_groups.create({
    data: {
      name: 'Flutter Study Circle',
      classroom_id: classroom.id,
      created_by_id: student1.id,
      icon: '📱',
      color_accent: '#0D9488',
    },
  });

  // Creator explicitly joins, same path as anyone else (BR-01)
  await prisma.study_group_members.create({
    data: { study_group_id: studyGroup.id, user_id: student1.id },
  });

  await prisma.study_group_members.create({
    data: { study_group_id: studyGroup.id, user_id: student2.id },
  });

  console.log('Created study group with 2 members');

  // --- Chat messages ---
  await prisma.chat_messages.create({
    data: {
      sender_id: teacher1.id,
      classroom_id: classroom.id,
      content: 'Welcome to Flutter Fundamentals! Check the Materials tab for our first reading.',
    },
  });

  await prisma.chat_messages.create({
    data: {
      sender_id: student1.id,
      study_group_id: studyGroup.id,
      content: 'Hey! Anyone want to review widgets together before the quiz?',
    },
  });

  console.log('Created 2 chat messages (1 classroom, 1 study group)');

  console.log('Seeding complete.');
}

main()
  .catch((e) => {
    console.error('Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });