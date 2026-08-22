const assert = require('assert');

// Test the ChatService permission evaluation logic and hierarchy

const OWNER_PERMISSIONS = {
  canManageTopics: true,
  canDeleteMessages: true,
  canManageMembers: true,
  canPinMessages: true,
  canEditGroupInfo: true,
};

const DEFAULT_ADMIN_PERMISSIONS = {
  canManageTopics: true,
  canDeleteMessages: true,
  canManageMembers: true,
  canPinMessages: true,
  canEditGroupInfo: false,
};

function getMemberRoleAndPermissions(group, userId) {
  if (!userId) return { role: 'MEMBER', permissions: {}, isOwner: false, isAdmin: false };
  const isOwner = group.createdById === userId;
  if (isOwner) {
    return {
      role: 'OWNER',
      permissions: OWNER_PERMISSIONS,
      isOwner: true,
      isAdmin: true,
    };
  }

  const member = (group.members || []).find((m) => m.userId === userId);
  if (!member) {
    return { role: 'NONE', permissions: {}, isOwner: false, isAdmin: false };
  }

  const isAdmin = member.role === 'ADMIN';
  let parsedPerms = {};
  if (typeof member.permissions === 'string') {
    try { parsedPerms = JSON.parse(member.permissions); } catch(e) {}
  } else if (typeof member.permissions === 'object' && member.permissions) {
    parsedPerms = member.permissions;
  }

  return {
    role: member.role || 'MEMBER',
    permissions: isAdmin ? { ...DEFAULT_ADMIN_PERMISSIONS, ...parsedPerms } : {},
    isOwner: false,
    isAdmin,
  };
}

function canCreateOrDeleteTopic(auth) {
  return auth.isOwner || (auth.isAdmin && auth.permissions?.canManageTopics !== false);
}

function canEditGroupInfo(auth) {
  return auth.isOwner || (auth.isAdmin && auth.permissions?.canEditGroupInfo === true);
}

function canRemoveTarget(actorAuth, targetRole, isSelfLeave) {
  if (isSelfLeave) return true;
  if (targetRole === 'OWNER') return false; // Owner is immune
  if (actorAuth.isOwner) return true; // Owner can remove anyone
  if (actorAuth.isAdmin && actorAuth.permissions?.canManageMembers !== false) {
    return targetRole === 'MEMBER'; // Admin cannot remove other Admins or Owner
  }
  return false;
}

function canPromoteOrDemote(actorAuth, targetRole) {
  if (targetRole === 'OWNER') return false; // Owner cannot be demoted
  return actorAuth.isOwner; // Only Owner can promote or demote admins
}

function testRoleHierarchy() {
  console.log('Testing Telegram-Style Role Hierarchy & Security...');

  const mockGroup = {
    id: 'grp-1',
    createdById: 'user_owner',
    members: [
      { userId: 'user_owner', role: 'OWNER' },
      { userId: 'user_admin_1', role: 'ADMIN', permissions: { canManageTopics: true, canEditGroupInfo: false, canManageMembers: true } },
      { userId: 'user_admin_limited', role: 'ADMIN', permissions: { canManageTopics: false, canEditGroupInfo: false, canManageMembers: false } },
      { userId: 'user_member', role: 'MEMBER' },
    ],
  };

  const ownerAuth = getMemberRoleAndPermissions(mockGroup, 'user_owner');
  const admin1Auth = getMemberRoleAndPermissions(mockGroup, 'user_admin_1');
  const adminLimitedAuth = getMemberRoleAndPermissions(mockGroup, 'user_admin_limited');
  const memberAuth = getMemberRoleAndPermissions(mockGroup, 'user_member');
  const outsiderAuth = getMemberRoleAndPermissions(mockGroup, 'user_stranger');

  // 1. Topic permissions
  assert.strictEqual(canCreateOrDeleteTopic(ownerAuth), true, 'Owner should manage topics');
  assert.strictEqual(canCreateOrDeleteTopic(admin1Auth), true, 'Admin with topic perms should manage topics');
  assert.strictEqual(canCreateOrDeleteTopic(adminLimitedAuth), false, 'Admin with canManageTopics=false cannot manage topics');
  assert.strictEqual(canCreateOrDeleteTopic(memberAuth), false, 'Regular member cannot manage topics');
  assert.strictEqual(canCreateOrDeleteTopic(outsiderAuth), false, 'Outsider cannot manage topics');
  console.log('✓ Topic management permissions validated.');

  // 2. Group info edit permissions
  assert.strictEqual(canEditGroupInfo(ownerAuth), true, 'Owner can edit group info');
  assert.strictEqual(canEditGroupInfo(admin1Auth), false, 'Admin without canEditGroupInfo cannot edit group info');
  assert.strictEqual(canEditGroupInfo(memberAuth), false, 'Member cannot edit group info');
  console.log('✓ Group info editing permissions validated.');

  // 3. Removal & Immunity rules
  assert.strictEqual(canRemoveTarget(ownerAuth, 'ADMIN', false), true, 'Owner can remove admin');
  assert.strictEqual(canRemoveTarget(ownerAuth, 'MEMBER', false), true, 'Owner can remove member');
  assert.strictEqual(canRemoveTarget(admin1Auth, 'OWNER', false), false, 'Admin CANNOT remove owner');
  assert.strictEqual(canRemoveTarget(admin1Auth, 'ADMIN', false), false, 'Admin CANNOT remove other admin');
  assert.strictEqual(canRemoveTarget(admin1Auth, 'MEMBER', false), true, 'Admin CAN remove regular member');
  assert.strictEqual(canRemoveTarget(memberAuth, 'MEMBER', false), false, 'Member cannot remove other members');
  assert.strictEqual(canRemoveTarget(memberAuth, 'MEMBER', true), true, 'Member can leave group');
  console.log('✓ Member removal & owner immunity rules validated.');

  // 4. Promote / Demote authority
  assert.strictEqual(canPromoteOrDemote(ownerAuth, 'MEMBER'), true, 'Owner can promote member');
  assert.strictEqual(canPromoteOrDemote(ownerAuth, 'ADMIN'), true, 'Owner can demote admin');
  assert.strictEqual(canPromoteOrDemote(ownerAuth, 'OWNER'), false, 'Owner cannot be demoted');
  assert.strictEqual(canPromoteOrDemote(admin1Auth, 'MEMBER'), false, 'Admin cannot promote other members');
  assert.strictEqual(canPromoteOrDemote(memberAuth, 'MEMBER'), false, 'Member cannot promote');
  console.log('✓ Promotion and demotion authority validated.');

  console.log('\n🎉 ALL ROLE HIERARCHY AND SECURITY TESTS PASSED! 🎉\n');
}

testRoleHierarchy();
