const assert = require('assert');
const { PrismaClient } = require('@prisma/client');

const db = new PrismaClient();

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

async function runTests() {
  console.log('--- Starting Telegram-Style Group & Topics System Tests ---');

  const ownerId = 'test_owner_' + Date.now();
  const adminId = 'test_admin_' + Date.now();
  const memberId = 'test_member_' + Date.now();
  const outsiderId = 'test_outsider_' + Date.now();

  const ownerUuid = toUuid(ownerId);
  const adminUuid = toUuid(adminId);
  const memberUuid = toUuid(memberId);
  const outsiderUuid = toUuid(outsiderId);

  // Setup test users
  await db.user.createMany({
    data: [
      { id: ownerUuid, email: `${ownerId}@example.com`, fullName: 'Owner User', initials: 'OU' },
      { id: adminUuid, email: `${adminId}@example.com`, fullName: 'Admin User', initials: 'AU' },
      { id: memberUuid, email: `${memberId}@example.com`, fullName: 'Member User', initials: 'MU' },
      { id: outsiderUuid, email: `${outsiderId}@example.com`, fullName: 'Outsider User', initials: 'XU' },
    ],
    skipDuplicates: true,
  });

  const groupUuid = toUuid('test_grp_' + Date.now());

  // 1. Create Group with Owner
  console.log('1. Creating Study Group with permanent OWNER...');
  const group = await db.studyGroup.create({
    data: {
      id: groupUuid,
      name: 'Advanced React Native',
      description: 'A place to discuss architecture and native modules',
      icon: '📱',
      colorAccent: '#6366f1',
      createdById: ownerUuid,
      members: {
        create: [
          {
            userId: ownerUuid,
            role: 'OWNER',
            permissions: JSON.stringify({
              canManageTopics: true,
              canDeleteMessages: true,
              canManageMembers: true,
              canPinMessages: true,
              canEditGroupInfo: true,
            }),
          },
          { userId: adminUuid, role: 'MEMBER' },
          { userId: memberUuid, role: 'MEMBER' },
        ],
      },
    },
    include: {
      members: true,
    },
  });

  assert.strictEqual(group.name, 'Advanced React Native');
  assert.strictEqual(group.createdById, ownerUuid);
  assert.strictEqual(group.members.length, 3);
  const ownerMember = group.members.find((m) => m.userId === ownerUuid);
  assert.strictEqual(ownerMember.role, 'OWNER');
  console.log('✓ Group created with creator as OWNER.');

  // 2. Create Permanent Topics
  console.log('2. Creating Permanent Database Topics...');
  const topic1 = await db.groupTopic.create({
    data: {
      studyGroupId: group.id,
      name: 'Navigation & Deep Linking',
      slug: 'navigation-deep-linking',
      icon: '#',
      color: '#0d9488',
      createdById: ownerUuid,
    },
  });

  const topic2 = await db.groupTopic.create({
    data: {
      studyGroupId: group.id,
      name: 'State Management',
      slug: 'state-management',
      icon: '#',
      color: '#0d9488',
      createdById: ownerUuid,
    },
  });

  const storedTopics = await db.groupTopic.findMany({
    where: { studyGroupId: group.id },
  });

  assert.strictEqual(storedTopics.length, 2);
  console.log('✓ Permanent topics stored in DB and persist across queries.');

  // 3. Promote Member to Admin with Granular Permissions
  console.log('3. Promoting Member to ADMIN with custom permissions...');
  const adminPermissions = {
    canManageTopics: true,
    canDeleteMessages: true,
    canManageMembers: true,
    canPinMessages: true,
    canEditGroupInfo: false,
  };

  await db.studyGroupMember.update({
    where: {
      studyGroupId_userId: {
        studyGroupId: group.id,
        userId: adminUuid,
      },
    },
    data: {
      role: 'ADMIN',
      permissions: JSON.stringify(adminPermissions),
    },
  });

  const updatedAdmin = await db.studyGroupMember.findUnique({
    where: {
      studyGroupId_userId: {
        studyGroupId: group.id,
        userId: adminUuid,
      },
    },
  });

  assert.strictEqual(updatedAdmin.role, 'ADMIN');
  const parsedPerms = JSON.parse(updatedAdmin.permissions);
  assert.strictEqual(parsedPerms.canManageTopics, true);
  assert.strictEqual(parsedPerms.canEditGroupInfo, false);
  console.log('✓ Member promoted to ADMIN with custom granular permissions.');

  // 4. Delete a topic
  console.log('4. Deleting a topic from DB...');
  await db.groupTopic.deleteMany({
    where: { studyGroupId: group.id, slug: 'navigation-deep-linking' },
  });

  const remainingTopics = await db.groupTopic.findMany({
    where: { studyGroupId: group.id },
  });
  assert.strictEqual(remainingTopics.length, 1);
  assert.strictEqual(remainingTopics[0].slug, 'state-management');
  console.log('✓ Topic deleted cleanly from DB.');

  // 5. Demote Admin back to Member
  console.log('5. Demoting ADMIN back to regular MEMBER...');
  await db.studyGroupMember.update({
    where: {
      studyGroupId_userId: {
        studyGroupId: group.id,
        userId: adminUuid,
      },
    },
    data: {
      role: 'MEMBER',
      permissions: null,
    },
  });

  const demotedMember = await db.studyGroupMember.findUnique({
    where: {
      studyGroupId_userId: {
        studyGroupId: group.id,
        userId: adminUuid,
      },
    },
  });
  assert.strictEqual(demotedMember.role, 'MEMBER');
  assert.strictEqual(demotedMember.permissions, null);
  console.log('✓ Admin successfully demoted to Member.');

  // 6. Cleanup
  console.log('6. Cleaning up test data...');
  await db.studyGroup.delete({ where: { id: group.id } });
  await db.user.deleteMany({
    where: { id: { in: [ownerUuid, adminUuid, memberUuid, outsiderUuid] } },
  });
  console.log('✓ Cleanup complete.');

  console.log('\n🎉 ALL TELEGRAM-STYLE GROUP & TOPICS TESTS PASSED SUCCESSFULLY! 🎉\n');
}

runTests()
  .catch((err) => {
    console.error('Test failed with error:', err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
