const assert = require('assert');

function toUuid(id) {
  if (!id) return '00000000-0000-4000-8000-000000000000';
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(id)) return id;
  let hex = '';
  for (let i = 0; i < id.length; i++) {
    hex += id.charCodeAt(i).toString(16).padStart(2, '0');
  }
  hex = hex.padEnd(32, '0').slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

function parseChannelRoom(roomId) {
  if (!roomId) return { parentGroupId: 'general', topicId: 'general', normalizedRoomId: 'general-general' };
  
  const trimmed = String(roomId).trim();
  const uuidTopicRegex = /^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})-(.+)$/;
  const uuidMatch = trimmed.match(uuidTopicRegex);
  if (uuidMatch) {
    const parent = uuidMatch[1];
    const topic = uuidMatch[2];
    return { parentGroupId: parent, topicId: topic, normalizedRoomId: `${parent}-${topic}` };
  }

  const uuidOnlyRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
  if (uuidOnlyRegex.test(trimmed)) {
    return { parentGroupId: trimmed, topicId: 'general', normalizedRoomId: `${trimmed}-general` };
  }

  if (trimmed.includes('-')) {
    const parts = trimmed.split('-');
    const parent = parts[0];
    const topic = parts.slice(1).join('-');
    return { parentGroupId: parent, topicId: topic || 'general', normalizedRoomId: `${parent}-${topic || 'general'}` };
  }

  return { parentGroupId: trimmed, topicId: 'general', normalizedRoomId: `${trimmed}-general` };
}

// In-memory simulator of Database & ChatService
class MockChatService {
  constructor() {
    this.groups = new Map();
    this.topics = new Map();
    this.members = new Map();
    this.classroomMembers = new Map();
    this.classroomTeachers = new Map();
    this.messages = [];
  }

  addClassroomTeacher(classroomId, teacherId) {
    this.classroomTeachers.set(`${classroomId}-${teacherId}`, { classroomId, userId: teacherId, isOwner: true });
  }

  addClassroomMember(classroomId, studentId) {
    this.classroomMembers.set(`${classroomId}-${studentId}`, { classroomId, userId: studentId, joinedAt: new Date() });
  }

  removeClassroomMember(classroomId, studentId) {
    this.classroomMembers.delete(`${classroomId}-${studentId}`);
  }

  getClassroomMembers(classroomId) {
    const teachers = Array.from(this.classroomTeachers.values()).filter(t => t.classroomId === classroomId);
    const students = Array.from(this.classroomMembers.values()).filter(m => m.classroomId === classroomId);
    return {
      classroomId,
      teachers: teachers.map(t => ({ id: t.userId, role: 'TEACHER', isOwner: t.isOwner })),
      students: students.map(s => ({ id: s.userId, role: 'STUDENT', joinedAt: s.joinedAt })),
      members: [
        ...teachers.map(t => ({ id: t.userId, role: 'TEACHER', isOwner: t.isOwner })),
        ...students.map(s => ({ id: s.userId, role: 'STUDENT', joinedAt: s.joinedAt })),
      ],
    };
  }

  createStudyGroup(groupId, name, classroomId, creatorId) {
    const g = { id: groupId, name, classroomId, createdById: creatorId };
    this.groups.set(groupId, g);
    this.members.set(`${groupId}-${creatorId}`, { studyGroupId: groupId, userId: creatorId, role: 'OWNER' });
    return g;
  }

  createTopic(groupId, slug, name) {
    const t = { id: `topic-${Date.now()}`, studyGroupId: groupId, slug, name };
    this.topics.set(`${groupId}-${slug}`, t);
    return t;
  }

  saveMessage(roomId, senderId, text) {
    const { parentGroupId, topicId, normalizedRoomId } = parseChannelRoom(roomId);
    
    // Check group membership
    const group = this.groups.get(parentGroupId);
    if (!group) throw new Error('Group not found');

    const isGroupMem = this.members.has(`${parentGroupId}-${senderId}`);
    const isClassMem = group.classroomId && this.classroomMembers.has(`${group.classroomId}-${senderId}`);
    const isClassTeacher = group.classroomId && this.classroomTeachers.has(`${group.classroomId}-${senderId}`);

    if (!isGroupMem && !isClassMem && !isClassTeacher) {
      throw new Error('Forbidden: User is not authorized in this group/classroom');
    }

    const msg = {
      id: `msg-${this.messages.length + 1}`,
      content: text,
      senderId,
      studyGroupId: parentGroupId,
      attachments: JSON.stringify({
        groupId: parentGroupId,
        topicId: topicId,
        roomId: normalizedRoomId,
        rawRoomId: roomId,
      }),
      createdAt: new Date(),
    };
    this.messages.push(msg);
    return msg;
  }

  getChatHistory(roomId) {
    const { parentGroupId, topicId, normalizedRoomId } = parseChannelRoom(roomId);
    return this.messages.filter((msg) => {
      const att = JSON.parse(msg.attachments || '{}');
      return att.groupId === parentGroupId && att.topicId === topicId;
    });
  }
}

async function runTests() {
  console.log('--- Starting Topic Isolation and Classroom Enrollment Invariant Tests ---');
  let passed = 0;
  let failed = 0;

  function test(desc, fn) {
    try {
      fn();
      console.log(`✅ PASS: ${desc}`);
      passed++;
    } catch (e) {
      console.error(`❌ FAIL: ${desc}`);
      console.error(e);
      failed++;
    }
  }

  const service = new MockChatService();
  const teacherId = 'teacher-100';
  const studentAlice = 'student-alice';
  const studentBob = 'student-bob';
  const outsider = 'outsider-eve';
  const classId = 'class-flutter-101';

  // Setup Classroom
  service.addClassroomTeacher(classId, teacherId);
  service.addClassroomMember(classId, studentAlice);

  test('Classroom Members List strictly includes enrolled student and teacher', () => {
    const membersData = service.getClassroomMembers(classId);
    assert.strictEqual(membersData.teachers.length, 1);
    assert.strictEqual(membersData.teachers[0].id, teacherId);
    assert.strictEqual(membersData.teachers[0].role, 'TEACHER');

    assert.strictEqual(membersData.students.length, 1);
    assert.strictEqual(membersData.students[0].id, studentAlice);
    assert.strictEqual(membersData.students[0].role, 'STUDENT');

    // Bob and Eve should NOT be in the enrolled student list
    assert.strictEqual(membersData.students.some(s => s.id === studentBob), false);
    assert.strictEqual(membersData.students.some(s => s.id === outsider), false);
  });

  test('Enrolling new student updates Members Tab list', () => {
    service.addClassroomMember(classId, studentBob);
    const membersData = service.getClassroomMembers(classId);
    assert.strictEqual(membersData.students.length, 2);
    assert.strictEqual(membersData.students.some(s => s.id === studentBob), true);
  });

  test('Un-enrolling a student removes them from Members Tab list', () => {
    service.removeClassroomMember(classId, studentBob);
    const membersData = service.getClassroomMembers(classId);
    assert.strictEqual(membersData.students.length, 1);
    assert.strictEqual(membersData.students.some(s => s.id === studentBob), false);
  });

  // Setup Study Group & Topics
  const groupId = toUuid('group-algorithms-555');
  service.createStudyGroup(groupId, 'Algorithms Group', classId, teacherId);
  service.createTopic(groupId, 'dynamic-programming', 'Dynamic Programming');
  service.createTopic(groupId, 'graph-theory', 'Graph Theory');

  test('Authorized student Alice and Teacher can post to Topic A and Topic B', () => {
    const msg1 = service.saveMessage(`${groupId}-dynamic-programming`, studentAlice, 'Alice on DP');
    const msg2 = service.saveMessage(`${groupId}-graph-theory`, teacherId, 'Teacher on Graphs');
    const msg3 = service.saveMessage(`${groupId}-general`, studentAlice, 'Alice on General chat');

    assert.strictEqual(msg1.content, 'Alice on DP');
    assert.strictEqual(msg2.content, 'Teacher on Graphs');
    assert.strictEqual(msg3.content, 'Alice on General chat');
  });

  test('Topic Messages are strictly isolated - Topic A only returns Topic A messages', () => {
    const historyA = service.getChatHistory(`${groupId}-dynamic-programming`);
    assert.strictEqual(historyA.length, 1);
    assert.strictEqual(historyA[0].content, 'Alice on DP');

    const historyB = service.getChatHistory(`${groupId}-graph-theory`);
    assert.strictEqual(historyB.length, 1);
    assert.strictEqual(historyB[0].content, 'Teacher on Graphs');

    const historyGen = service.getChatHistory(`${groupId}-general`);
    assert.strictEqual(historyGen.length, 1);
    assert.strictEqual(historyGen[0].content, 'Alice on General chat');
  });

  test('Topic A messages NEVER bleed into Topic B or General', () => {
    const historyB = service.getChatHistory(`${groupId}-graph-theory`);
    assert.strictEqual(historyB.some(m => m.content.includes('DP')), false);
    assert.strictEqual(historyB.some(m => m.content.includes('General')), false);

    const historyGen = service.getChatHistory(`${groupId}-general`);
    assert.strictEqual(historyGen.some(m => m.content.includes('DP')), false);
    assert.strictEqual(historyGen.some(m => m.content.includes('Graphs')), false);
  });

  test('Outsider user cannot post messages into topics of the classroom/group', () => {
    assert.throws(() => {
      service.saveMessage(`${groupId}-dynamic-programming`, outsider, 'Spam message');
    }, /Forbidden/);
  });

  test('Room parser accurately handles UUIDs, named channels, and topics', () => {
    const res1 = parseChannelRoom('01cfee37-7b19-4dd9-9f78-3305b3790e40-state-management');
    assert.strictEqual(res1.parentGroupId, '01cfee37-7b19-4dd9-9f78-3305b3790e40');
    assert.strictEqual(res1.topicId, 'state-management');

    const res2 = parseChannelRoom('01cfee37-7b19-4dd9-9f78-3305b3790e40');
    assert.strictEqual(res2.parentGroupId, '01cfee37-7b19-4dd9-9f78-3305b3790e40');
    assert.strictEqual(res2.topicId, 'general');

    const res3 = parseChannelRoom('flutter-widgets');
    assert.strictEqual(res3.parentGroupId, 'flutter');
    assert.strictEqual(res3.topicId, 'widgets');
  });

  console.log(`\nResults: ${passed} passed, ${failed} failed.`);
  if (failed > 0) process.exit(1);
}

runTests();
