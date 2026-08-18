import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const IDS = {
  teacher1: '11111111-1111-4111-8111-111111111111',
  teacher2: '22222222-2222-4222-8222-222222222222',
  student1: '33333333-3333-4333-8333-333333333333',
  student2: '44444444-4444-4444-8444-444444444444',
  admin: '55555555-5555-4555-8555-555555555555',
  classroom1: '66666666-6666-4666-8666-666666666666',
  ct1: '77777777-7777-4777-8777-777777777771',
  ct2: '77777777-7777-4777-8777-777777777772',
  cm1: '88888888-8888-4888-8888-888888888881',
  cm2: '88888888-8888-4888-8888-888888888882',
  material1: '99999999-9999-4999-8999-999999999999',
  assignment1: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  sub1: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  quiz1: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  question1: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  qsub1: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
  session1: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
  record1: '10101010-1010-4101-8101-101010101010',
  group1: '20202020-2020-4202-8202-202020202020',
  sgm1: '30303030-3030-4303-8303-303030303031',
  sgm2: '30303030-3030-4303-8303-303030303032',
  msg1: '40404040-4040-4404-8404-404040404041',
  msg2: '40404040-4040-4404-8404-404040404042',
};

async function main() {
  console.log('Seeding database (idempotent — safe to re-run)...');

  const passwordHash = await bcrypt.hash('Password123!', 10);

  const teacher1 = await prisma.users.upsert({
    where: { id: IDS.teacher1 },
    update: {},
    create: {
      id: IDS.teacher1,
      email: 'abebe.tadesse@temarlije.test',
      password_hash: passwordHash,
      full_name: 'Abebe Tadesse',
      role: 'TEACHER',
    },
  });

  const teacher2 = await prisma.users.upsert({
    where: { id: IDS.teacher2 },
    update: {},
    create: {
      id: IDS.teacher2,
      email: 'sara.mekonnen@temarlije.test',
      password_hash: passwordHash,
      full_name: 'Sara Mekonnen',
      role: 'TEACHER',
    },
  });

  const student1 = await prisma.users.upsert({
    where: { id: IDS.student1 },
    update: {},
    create: {
      id: IDS.student1,
      email: 'kebede.alemu@temarlije.test',
      password_hash: passwordHash,
      full_name: 'Kebede Alemu',
      role: 'STUDENT',
    },
  });

  const student2 = await prisma.users.upsert({
    where: { id: IDS.student2 },
    update: {},
    create: {
      id: IDS.student2,
      email: 'hana.girma@temarlije.test',
      password_hash: passwordHash,
      full_name: 'Hana Girma',
      role: 'STUDENT',
    },
  });

  await prisma.users.upsert({
    where: { id: IDS.admin },
    update: {},
    create: {
      id: IDS.admin,
      email: 'admin@temarlije.test',
      password_hash: passwordHash,
      full_name: 'Platform Admin',
      role: 'ADMIN',
    },
  });

  console.log('Users ready (2 teachers, 2 students, 1 admin)');

  const classroom = await prisma.classrooms.upsert({
    where: { id: IDS.classroom1 },
    update: {},
    create: {
      id: IDS.classroom1,
      title: 'Flutter Fundamentals',
      subject: 'Mobile Development',
      description: 'Introduction to building cross-platform apps with Flutter.',
      invite_code: 'DB7GLU',
      created_by_id: teacher1.id,
    },
  });

  console.log('Classroom ready:', classroom.title);

  await prisma.classroom_teachers.upsert({
    where: { id: IDS.ct1 },
    update: {},
    create: {
      id: IDS.ct1,
      classroom_id: classroom.id,
      user_id: teacher1.id,
      is_owner: true,
    },
  });

  await prisma.classroom_teachers.upsert({
    where: { id: IDS.ct2 },
    update: {},
    create: {
      id: IDS.ct2,
      classroom_id: classroom.id,
      user_id: teacher2.id,
      is_owner: false,
    },
  });

  await prisma.classroom_members.upsert({
    where: { id: IDS.cm1 },
    update: {},
    create: { id: IDS.cm1, classroom_id: classroom.id, user_id: student1.id },
  });

  await prisma.classroom_members.upsert({
    where: { id: IDS.cm2 },
    update: {},
    create: { id: IDS.cm2, classroom_id: classroom.id, user_id: student2.id },
  });

  console.log('Enrollment ready (2 teachers, 2 students)');

  const material = await prisma.materials.upsert({
    where: { id: IDS.material1 },
    update: {},
    create: {
      id: IDS.material1,
      title: 'Widget Structure Basics.pdf',
      file_url: 'https://storage.temarlije.test/materials/widget-structure-basics.pdf',
      file_type: 'PDF',
      file_size_bytes: BigInt(2450000),
      is_vectorized: true,
      classroom_id: classroom.id,
      uploaded_by_id: teacher1.id,
    },
  });

  console.log('Material ready:', material.title);

  const assignment = await prisma.assignments.upsert({
    where: { id: IDS.assignment1 },
    update: {},
    create: {
      id: IDS.assignment1,
      title: 'Build a Stateless Widget',
      description: 'Create a simple stateless widget that displays your name and favorite color.',
      due_date: new Date('2026-09-01T23:59:00Z'),
      total_points: 100,
      classroom_id: classroom.id,
      created_by_id: teacher1.id,
    },
  });

  await prisma.assignment_submissions.upsert({
    where: { id: IDS.sub1 },
    update: {},
    create: {
      id: IDS.sub1,
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

  console.log('Assignment + submission ready');

  const quiz = await prisma.quizzes.upsert({
    where: { id: IDS.quiz1 },
    update: {},
    create: {
      id: IDS.quiz1,
      title: 'Widget Basics Quiz',
      description: 'Quick check on stateless vs stateful widgets.',
      duration_minutes: 15,
      is_published: true,
      classroom_id: classroom.id,
    },
  });

  const question = await prisma.quiz_questions.upsert({
    where: { id: IDS.question1 },
    update: {},
    create: {
      id: IDS.question1,
      quiz_id: quiz.id,
      question_text: 'Which widget type rebuilds when its internal state changes?',
      question_type: 'MULTIPLE_CHOICE',
      options: ['StatelessWidget', 'StatefulWidget', 'InheritedWidget', 'RenderObject'],
      correct_answer: 'StatefulWidget',
      points: 10,
    },
  });

  await prisma.quiz_submissions.upsert({
    where: { id: IDS.qsub1 },
    update: {},
    create: {
      id: IDS.qsub1,
      quiz_id: quiz.id,
      student_id: student1.id,
      attempt_number: 1,
      is_latest: true,
      score: 10,
      answers: { [question.id]: 'StatefulWidget' },
    },
  });

  console.log('Quiz + question + submission ready');

  const session = await prisma.attendance_sessions.upsert({
    where: { id: IDS.session1 },
    update: {},
    create: {
      id: IDS.session1,
      classroom_id: classroom.id,
      session_code: 'CHKIN1',
      is_active: false,
      ended_at: new Date(),
    },
  });

  await prisma.attendance_records.upsert({
    where: { id: IDS.record1 },
    update: {},
    create: {
      id: IDS.record1,
      session_id: session.id,
      student_id: student1.id,
      status: 'PRESENT',
    },
  });

  console.log('Attendance session + record ready');

  const studyGroup = await prisma.study_groups.upsert({
    where: { id: IDS.group1 },
    update: {},
    create: {
      id: IDS.group1,
      name: 'Flutter Study Circle',
      classroom_id: classroom.id,
      created_by_id: student1.id,
      icon: '📱',
      color_accent: '#0D9488',
    },
  });

  await prisma.study_group_members.upsert({
    where: { id: IDS.sgm1 },
    update: {},
    create: { id: IDS.sgm1, study_group_id: studyGroup.id, user_id: student1.id },
  });

  await prisma.study_group_members.upsert({
    where: { id: IDS.sgm2 },
    update: {},
    create: { id: IDS.sgm2, study_group_id: studyGroup.id, user_id: student2.id },
  });

  console.log('Study group ready (2 members)');

  await prisma.chat_messages.upsert({
    where: { id: IDS.msg1 },
    update: {},
    create: {
      id: IDS.msg1,
      sender_id: teacher1.id,
      classroom_id: classroom.id,
      content: 'Welcome to Flutter Fundamentals! Check the Materials tab for our first reading.',
    },
  });

  await prisma.chat_messages.upsert({
    where: { id: IDS.msg2 },
    update: {},
    create: {
      id: IDS.msg2,
      sender_id: student1.id,
      study_group_id: studyGroup.id,
      content: 'Hey! Anyone want to review widgets together before the quiz?',
    },
  });

  console.log('Chat messages ready');
  console.log('Seeding complete — safe to re-run any time.');
}

main()
  .catch((e) => {
    console.error('Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });