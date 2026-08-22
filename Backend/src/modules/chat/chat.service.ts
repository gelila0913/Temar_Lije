import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

function toUuid(id: string): string {
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

export interface AdminPermissions {
  canManageTopics?: boolean;
  canDeleteMessages?: boolean;
  canManageMembers?: boolean;
  canPinMessages?: boolean;
  canEditGroupInfo?: boolean;
}

const DEFAULT_ADMIN_PERMISSIONS: AdminPermissions = {
  canManageTopics: true,
  canDeleteMessages: true,
  canManageMembers: true,
  canPinMessages: true,
  canEditGroupInfo: false,
};

const OWNER_PERMISSIONS: AdminPermissions = {
  canManageTopics: true,
  canDeleteMessages: true,
  canManageMembers: true,
  canPinMessages: true,
  canEditGroupInfo: true,
};

@Injectable()
export class ChatService {
  constructor(private readonly db: DatabaseService) {}

  private groupReactions(reactions: Array<{ userId: string; emoji: string }>) {
    const grouped: Record<string, { emoji: string; count: number; userIds: string[] }> = {};
    for (const r of reactions || []) {
      if (!r || !r.emoji) continue;
      if (!grouped[r.emoji]) {
        grouped[r.emoji] = { emoji: r.emoji, count: 0, userIds: [] };
      }
      grouped[r.emoji].count++;
      grouped[r.emoji].userIds.push(r.userId);
    }
    return Object.values(grouped);
  }

  private formatMessage(msg: any) {
    let attachments: any = {};
    if (typeof msg.attachments === 'string') {
      try {
        attachments = JSON.parse(msg.attachments);
      } catch {
        attachments = {};
      }
    } else if (typeof msg.attachments === 'object' && msg.attachments) {
      attachments = msg.attachments;
    }
    const senderObj = msg.sender
      ? {
          id: msg.sender.id,
          name: msg.sender.fullName || `User ${msg.sender.id}`,
          initials: msg.sender.initials,
          avatarBg: msg.sender.avatarBg,
        }
      : null;

    const roomKey =
      attachments.roomId || attachments.groupId || msg.studyGroupId || msg.classroomId;
    return {
      id: msg.id,
      text: msg.content,
      content: msg.content,
      senderId: msg.senderId,
      sender: senderObj,
      createdAt: msg.createdAt,
      groupId: attachments.groupId || (roomKey && roomKey.includes('-') ? roomKey.split('-')[0] : roomKey),
      topicId: attachments.topicId || (roomKey && roomKey.includes('-') ? roomKey.split('-').slice(1).join('-') : 'general'),
      roomId: roomKey,
      image: attachments.image,
      type: attachments.type || 'text',
      fileName: attachments.fileName,
      fileSize: attachments.fileSize,
      fileIcon: attachments.fileIcon,
      replyToId: attachments.replyToId,
      replyTo: attachments.replyTo,
      forwardedFrom: attachments.forwardedFrom,
      isPinned: !!attachments.isPinned,
      reactions: attachments.reactions || [],
      reactionsGrouped: this.groupReactions(attachments.reactions || []),
    };
  }

  async ensureUserExists(
    userId: string,
    name?: string,
    initials?: string,
    avatarBg?: string,
  ) {
    const validId = toUuid(userId);
    const existing = await this.db.user.findUnique({
      where: { id: validId },
    });

    if (existing) {
      return existing;
    }

    const sanitizedEmail = userId.replace(/[^a-zA-Z0-9]/g, '');
    try {
      return await this.db.user.create({
        data: {
          id: validId,
          email: `${sanitizedEmail || 'user'}@placeholder.com`,
          fullName: name || `User ${userId}`,
          initials: initials || userId.substring(0, 2).toUpperCase(),
          avatarBg: avatarBg || '#3b82f6',
        },
      });
    } catch (err: any) {
      if (err?.code === 'P2002') {
        const winner = await this.db.user.findUnique({
          where: { id: validId },
        });
        if (winner) return winner;
      }
      throw err;
    }
  }

  /**
   * Evaluates user's permission in a group.
   */
  async getMemberRoleAndPermissions(groupId: string, userId?: string) {
    if (!userId) {
      return { role: 'MEMBER', permissions: {}, isOwner: false, isAdmin: false };
    }

    const groupUuid = toUuid(groupId);
    const userUuid = toUuid(userId);

    const group = await this.db.studyGroup.findUnique({
      where: { id: groupUuid },
      include: {
        members: {
          where: { userId: userUuid },
        },
      },
    });

    if (!group) {
      throw new NotFoundException('Group not found');
    }

    const isOwner = group.createdById === userUuid || group.createdById === userId;
    if (isOwner) {
      return {
        role: 'OWNER',
        permissions: OWNER_PERMISSIONS,
        isOwner: true,
        isAdmin: true,
      };
    }

    const member = group.members[0];
    if (!member) {
      return { role: 'NONE', permissions: {}, isOwner: false, isAdmin: false };
    }

    let parsedPerms: AdminPermissions = {};
    if (typeof (member as any).permissions === 'string') {
      try {
        parsedPerms = JSON.parse((member as any).permissions);
      } catch (e) {}
    } else if (typeof (member as any).permissions === 'object' && (member as any).permissions) {
      parsedPerms = (member as any).permissions;
    }

    const memberRole = (member as any).role || 'MEMBER';
    const isAdmin = memberRole === 'ADMIN';

    return {
      role: memberRole,
      permissions: isAdmin ? { ...DEFAULT_ADMIN_PERMISSIONS, ...parsedPerms } : {},
      isOwner: false,
      isAdmin,
    };
  }

  private async _assertGroupAccess(groupId: string, userId?: string) {
    const validGroupUuid = toUuid(groupId);
    const validUserUuid = userId ? toUuid(userId) : undefined;
    const group = await this.db.studyGroup.findUnique({
      where: { id: validGroupUuid },
      include: {
        members: {
          select: { userId: true },
        },
      },
    });

    if (!group) {
      throw new NotFoundException('Group not found');
    }

    if (
      group.members.length > 0 &&
      userId &&
      !group.members.some((m) => m.userId === validUserUuid || m.userId === userId)
    ) {
      if (group.classroomId || group.id === 'flutter' || group.id === 'react-native') {
        await this.ensureUserExists(userId);
        await this.db.studyGroupMember
          .create({
            data: {
              userId: toUuid(userId),
              studyGroupId: group.id,
            },
          })
          .catch(() => {});
        return group;
      }
      throw new ForbiddenException('You are not a member of this group');
    }

    return group;
  }

  private async ensureClassroomExists(classroomId?: string, creatorId?: string): Promise<string> {
    const validCreatorId = toUuid(creatorId || 'gs');
    await this.ensureUserExists(creatorId || 'gs');
    if (classroomId) {
      const validClassId = toUuid(classroomId);
      const existing = await this.db.classroom.findUnique({
        where: { id: validClassId },
      });
      if (existing) return existing.id;
      const created = await this.db.classroom.create({
        data: {
          id: validClassId,
          title: `Classroom ${classroomId}`,
          inviteCode: 'CLS' + Math.floor(100 + Math.random() * 900),
          createdById: validCreatorId,
        },
      });
      return created.id;
    }

    const existing = await this.db.classroom.findFirst();
    if (existing) return existing.id;
    const created = await this.db.classroom.create({
      data: {
        title: 'General Classroom',
        inviteCode: 'GEN' + Math.floor(100 + Math.random() * 900),
        createdById: validCreatorId,
      },
    });
    return created.id;
  }

  /**
   * Create a new Group. The creator is permanently set as the OWNER.
   */
  async createGroup(
    name: string,
    description?: string,
    icon?: string,
    color?: string,
    memberIds: string[] = [],
    id?: string,
    creatorId?: string,
    classroomId?: string,
    isTopic?: boolean,
    parentGroupId?: string,
    topicId?: string,
  ) {
    const effectiveCreatorId = creatorId || memberIds[0] || 'gs';
    await this.ensureUserExists(effectiveCreatorId);

    // If caller is attempting to create a topic via group route, delegate to createTopic
    const isTopicSubchannel =
      isTopic ||
      Boolean(parentGroupId) ||
      (icon && icon.startsWith('topic:')) ||
      (id && (id.startsWith('topic:') || (id.includes('-') && !id.includes('6666'))));

    if (isTopicSubchannel) {
      const parentKey = parentGroupId || (id && id.split('-')[0]) || 'general';
      const tId = topicId || (id && id.split('-').slice(1).join('-')) || name.toLowerCase().replace(/\s+/g, '-');
      return await this.createTopic(parentKey, name, icon || '#', color || '#0d9488', effectiveCreatorId, tId);
    }

    for (const memberId of memberIds) {
      await this.ensureUserExists(memberId);
    }

    const effectiveClassroomId = classroomId
      ? await this.ensureClassroomExists(classroomId, effectiveCreatorId)
      : undefined;

    const groupUuid = id ? toUuid(id) : undefined;
    const creatorUuid = toUuid(effectiveCreatorId);

    // Combine members ensuring creator is OWNER
    const otherMembers = memberIds
      .filter((m) => toUuid(m) !== creatorUuid)
      .map((userId) => ({
        userId: toUuid(userId),
        role: 'MEMBER',
      }));

    const allMembersCreate = [
      {
        userId: creatorUuid,
        role: 'OWNER',
        permissions: JSON.stringify(OWNER_PERMISSIONS),
      },
      ...otherMembers,
    ];

    try {
      const createdGroup = await this.db.studyGroup.create({
        data: {
          ...(groupUuid ? { id: groupUuid } : {}),
          name,
          description: description || '',
          icon: icon || '📚',
          colorAccent: color || '#6366f1',
          classroomId: effectiveClassroomId || undefined,
          createdById: creatorUuid,
          members: {
            create: allMembersCreate,
          },
        },
        include: {
          members: {
            include: {
              user: true,
            },
          },
        },
      });

      // Create default 'general' topic permanently if groupTopic model exists
      try {
        if ((this.db as any).groupTopic) {
          await (this.db as any).groupTopic.create({
            data: {
              studyGroupId: createdGroup.id,
              name: 'General',
              slug: 'general',
              icon: '#',
              color: '#64748b',
              createdById: creatorUuid,
            },
          });
        }
      } catch (e) {}

      return {
        ...createdGroup,
        ownerId: creatorUuid,
        myRole: 'OWNER',
        myPermissions: OWNER_PERMISSIONS,
        topics: [
          { id: 'general', name: 'General', icon: '#', color: '#64748b', subtitle: 'General chat room', time: '' },
        ],
      };
    } catch (err: any) {
      // Fallback create without custom role columns if schema migration is pending
      const fallbackGroup = await this.db.studyGroup.create({
        data: {
          ...(groupUuid ? { id: groupUuid } : {}),
          name,
          icon: icon || '📚',
          colorAccent: color || '#6366f1',
          classroomId: effectiveClassroomId || undefined,
          createdById: creatorUuid,
          members: {
            create: [
              { userId: creatorUuid },
              ...otherMembers.map((m) => ({ userId: m.userId })),
            ],
          },
        },
        include: {
          members: {
            include: {
              user: true,
            },
          },
        },
      });

      return {
        ...fallbackGroup,
        ownerId: creatorUuid,
        myRole: 'OWNER',
        myPermissions: OWNER_PERMISSIONS,
        topics: [
          { id: 'general', name: 'General', icon: '#', color: '#64748b', subtitle: 'General chat room', time: '' },
        ],
      };
    }
  }

  /**
   * Create a permanent topic inside a group (Enforces OWNER or ADMIN with canManageTopics).
   */
  async createTopic(
    groupId: string,
    name: string,
    icon?: string,
    color?: string,
    actorId?: string,
    customSlug?: string,
  ) {
    const groupUuid = toUuid(groupId);
    const group = await this.db.studyGroup.findUnique({
      where: { id: groupUuid },
    });

    if (!group) {
      throw new NotFoundException(`Group with ID ${groupId} not found`);
    }

    if (actorId) {
      const auth = await this.getMemberRoleAndPermissions(groupId, actorId);
      const canCreate = auth.isOwner || (auth.isAdmin && auth.permissions?.canManageTopics !== false);
      if (!canCreate) {
        throw new ForbiddenException('Only the group owner or authorized admins can create topics.');
      }
    }

    const slug = customSlug || name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `topic-${Date.now()}`;
    const actorUuid = actorId ? toUuid(actorId) : group.createdById;
    if (actorId) await this.ensureUserExists(actorId);

    let dbTopic: any = null;
    try {
      dbTopic = await (this.db as any).groupTopic.create({
        data: {
          studyGroupId: group.id,
          name: name.trim(),
          slug,
          icon: icon && !icon.startsWith('topic:') ? icon : '#',
          color: color || '#0d9488',
          createdById: actorUuid,
        },
      });
    } catch (err: any) {
      if (err?.code === 'P2002') {
        dbTopic = await (this.db as any).groupTopic.findFirst({
          where: { studyGroupId: group.id, slug },
        });
      }
    }

    return {
      id: slug,
      dbId: dbTopic?.id,
      name: name.trim(),
      slug,
      icon: '#',
      color: color || '#0d9488',
      subtitle: `Topic: ${name.trim()}`,
      time: '',
      createdAt: dbTopic?.createdAt || new Date(),
      groupId: group.id,
      parentGroupId: group.id,
      isTopic: true,
    };
  }

  /**
   * Delete a topic from a group (Enforces OWNER or ADMIN with canManageTopics).
   * 'General' cannot be deleted.
   */
  async deleteTopic(groupId: string, topicSlugOrId: string, actorId?: string) {
    if (topicSlugOrId === 'general') {
      throw new BadRequestException('The General topic is default and cannot be deleted.');
    }

    const groupUuid = toUuid(groupId);
    const group = await this.db.studyGroup.findUnique({
      where: { id: groupUuid },
    });

    if (!group) {
      throw new NotFoundException('Group not found');
    }

    if (actorId) {
      const auth = await this.getMemberRoleAndPermissions(groupId, actorId);
      const canDelete = auth.isOwner || (auth.isAdmin && auth.permissions?.canManageTopics !== false);
      if (!canDelete) {
        throw new ForbiddenException('Only the group owner or authorized admins can delete topics.');
      }
    }

    try {
      await (this.db as any).groupTopic.deleteMany({
        where: {
          studyGroupId: group.id,
          OR: [{ slug: topicSlugOrId }, { id: topicSlugOrId }],
        },
      });
    } catch (e) {}

    // Clean up any legacy topic study_group rows
    try {
      await this.db.studyGroup.deleteMany({
        where: {
          icon: { startsWith: `topic:${group.id}:${topicSlugOrId}` },
        },
      });
    } catch (e) {}

    return { success: true, groupId: group.id, topicId: topicSlugOrId };
  }

  /**
   * Promote to Admin or Demote to Member.
   * OWNER ONLY ACTION. Owner cannot be demoted.
   */
  async updateMemberRole(
    groupId: string,
    targetUserId: string,
    role: 'ADMIN' | 'MEMBER',
    permissions?: AdminPermissions,
    actorId?: string,
  ) {
    const groupUuid = toUuid(groupId);
    const targetUuid = toUuid(targetUserId);

    const group = await this.db.studyGroup.findUnique({
      where: { id: groupUuid },
    });

    if (!group) {
      throw new NotFoundException('Group not found');
    }

    // Immunity: Owner cannot be demoted or changed
    if (group.createdById === targetUuid) {
      throw new ForbiddenException('The group owner cannot be demoted or modified.');
    }

    // Only OWNER can promote / demote admins
    if (actorId) {
      const actorUuid = toUuid(actorId);
      if (group.createdById !== actorUuid) {
        throw new ForbiddenException('Only the group owner can promote or demote administrators.');
      }
    }

    const assignedPermissions = role === 'ADMIN'
      ? { ...DEFAULT_ADMIN_PERMISSIONS, ...(permissions || {}) }
      : null;

    const member = await this.db.studyGroupMember.updateMany({
      where: {
        studyGroupId: group.id,
        userId: targetUuid,
      },
      data: {
        role,
        permissions: assignedPermissions ? JSON.stringify(assignedPermissions) : null,
      } as any,
    });

    return {
      groupId: group.id,
      userId: targetUserId,
      role,
      permissions: assignedPermissions,
      success: true,
    };
  }

  /**
   * Remove a member from the group.
   * Owner can remove anyone. Admin can remove Members (not Owner or other Admins).
   */
  async removeMember(groupId: string, targetUserId: string, actorId?: string) {
    const groupUuid = toUuid(groupId);
    const targetUuid = toUuid(targetUserId);

    const group = await this.db.studyGroup.findUnique({
      where: { id: groupUuid },
      include: {
        members: true,
      },
    });

    if (!group) {
      throw new NotFoundException('Group not found');
    }

    // Owner cannot be kicked
    if (group.createdById === targetUuid) {
      throw new ForbiddenException('The group owner cannot be removed from the group.');
    }

    if (actorId) {
      const actorUuid = toUuid(actorId);
      const isSelfLeave = actorUuid === targetUuid;

      if (!isSelfLeave) {
        const actorAuth = await this.getMemberRoleAndPermissions(groupId, actorId);
        const targetMember = group.members.find((m) => m.userId === targetUuid);
        const targetRole = (targetMember as any)?.role || 'MEMBER';

        if (actorAuth.isOwner) {
          // Owner can remove anyone
        } else if (actorAuth.isAdmin && actorAuth.permissions?.canManageMembers !== false) {
          if (targetRole === 'ADMIN' || targetRole === 'OWNER') {
            throw new ForbiddenException('Admins cannot remove other admins or the group owner.');
          }
        } else {
          throw new ForbiddenException('You do not have permission to remove members from this group.');
        }
      }
    }

    await this.db.studyGroupMember.deleteMany({
      where: {
        studyGroupId: group.id,
        userId: targetUuid,
      },
    });

    return { success: true, groupId: group.id, userId: targetUserId };
  }

  /**
   * Add members to group (Enforces OWNER or ADMIN with canManageMembers).
   */
  async addMembers(groupId: string, userIds: string[], actorId?: string) {
    const groupUuid = toUuid(groupId);
    const group = await this.db.studyGroup.findUnique({
      where: { id: groupUuid },
    });

    if (!group) {
      throw new NotFoundException('Group not found');
    }

    if (actorId) {
      const auth = await this.getMemberRoleAndPermissions(groupId, actorId);
      const canAdd = auth.isOwner || (auth.isAdmin && auth.permissions?.canManageMembers !== false);
      if (!canAdd) {
        throw new ForbiddenException('You do not have permission to add members to this group.');
      }
    }

    for (const uId of userIds) {
      await this.ensureUserExists(uId);
      await this.db.studyGroupMember
        .create({
          data: {
            studyGroupId: group.id,
            userId: toUuid(uId),
            role: 'MEMBER',
          } as any,
        })
        .catch(() => {});
    }

    return await this.db.studyGroupMember.findMany({
      where: { studyGroupId: group.id },
      include: { user: true },
    });
  }

  /**
   * Update Group details (name, description, icon, color).
   * Enforces OWNER or ADMIN with canEditGroupInfo.
   */
  async updateGroup(
    groupId: string,
    data: { name?: string; description?: string; icon?: string; color?: string },
    actorId?: string,
  ) {
    const groupUuid = toUuid(groupId);
    const group = await this.db.studyGroup.findUnique({
      where: { id: groupUuid },
    });

    if (!group) {
      throw new NotFoundException('Group not found');
    }

    if (actorId) {
      const auth = await this.getMemberRoleAndPermissions(groupId, actorId);
      const canEdit = auth.isOwner || (auth.isAdmin && auth.permissions?.canEditGroupInfo === true);
      if (!canEdit) {
        throw new ForbiddenException('You do not have permission to edit group settings.');
      }
    }

    return await this.db.studyGroup.update({
      where: { id: group.id },
      data: {
        ...(data.name ? { name: data.name.trim() } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.icon ? { icon: data.icon } : {}),
        ...(data.color ? { colorAccent: data.color } : {}),
      },
    });
  }

  /**
   * Delete entire group. ONLY OWNER can perform this.
   */
  async deleteGroup(groupId: string, actorId?: string) {
    const groupUuid = toUuid(groupId);
    const group = await this.db.studyGroup.findUnique({
      where: { id: groupUuid },
    });

    if (!group) {
      throw new NotFoundException('Group not found');
    }

    if (actorId) {
      const actorUuid = toUuid(actorId);
      if (group.createdById !== actorUuid) {
        throw new ForbiddenException('Only the group owner can delete this group.');
      }
    }

    return await this.db.studyGroup.delete({
      where: { id: group.id },
    });
  }

  /**
   * Loads all groups with permanent topics and member roles.
   */
  async getGroups(userId?: string, classroomId?: string | number) {
    const classIdStr = classroomId ? String(classroomId) : undefined;
    const userUuid = userId ? toUuid(userId) : undefined;

    let allRecords: any[] = [];
    try {
      allRecords = await this.db.studyGroup.findMany({
        where: {
          ...(classIdStr ? { classroomId: toUuid(classIdStr) } : {}),
          ...(userUuid
            ? {
                OR: [
                  { createdById: userUuid },
                  { members: { some: { userId: userUuid } } },
                ],
              }
            : {}),
        },
        include: {
          members: {
            include: {
              user: true,
            },
          },
          topics: {
            where: { deletedAt: null },
            orderBy: { createdAt: 'asc' },
          },
        },
        orderBy: {
          createdAt: 'asc',
        },
      });
    } catch (err: any) {
      // Fallback if topics relation/migration is still pending on production database
      try {
        allRecords = await this.db.studyGroup.findMany({
          where: {
            ...(classIdStr ? { classroomId: toUuid(classIdStr) } : {}),
            ...(userUuid
              ? {
                  OR: [
                    { createdById: userUuid },
                    { members: { some: { userId: userUuid } } },
                  ],
                }
              : {}),
          },
          include: {
            members: {
              include: {
                user: true,
              },
            },
          },
          orderBy: {
            createdAt: 'asc',
          },
        });
      } catch (fallbackErr: any) {
        console.error('getGroups query fallback notice:', fallbackErr?.message);
        allRecords = [];
      }
    }

    // Prohibit teachers from seeing student peer study groups
    const requestingUser = userUuid ? await this.db.user.findUnique({
      where: { id: userUuid },
      select: { id: true, role: true },
    }).catch(() => null) : null;

    if (requestingUser?.role === 'TEACHER') {
      allRecords = allRecords.filter((g: any) => {
        const isClassroomChannel = g.icon === '🏫' ||
                                  g.name.toLowerCase() === 'general' ||
                                  g.name.toLowerCase() === 'flutter' ||
                                  (g.classroomId ? g.id === toUuid(g.classroomId) : false);
        return isClassroomChannel;
      });
    }

    // Separate standalone groups from legacy subchannel icons
    const mainGroups: any[] = [];
    const legacyTopicsMap: Record<string, any[]> = {};

    for (const item of allRecords) {
      if (item.icon && item.icon.startsWith('topic:')) {
        const parts = item.icon.split(':');
        const parentId = parts[1] || 'general';
        const topicId = parts[2] || item.name.toLowerCase().replace(/\s+/g, '-');
        if (!legacyTopicsMap[parentId]) {
          legacyTopicsMap[parentId] = [];
        }
        legacyTopicsMap[parentId].push({
          id: topicId,
          dbId: item.id,
          name: item.name,
          icon: '#',
          color: item.colorAccent || '#0d9488',
          subtitle: `Topic: ${item.name}`,
          time: '',
          createdAt: item.createdAt,
        });
      } else {
        mainGroups.push(item);
      }
    }

    return mainGroups.map((g: any) => {
      const isOwner = userUuid ? g.createdById === userUuid : false;
      const myMember = g.members?.find((m: any) => m.userId === userUuid);
      const myRole = isOwner ? 'OWNER' : (myMember?.role || 'MEMBER');

      let myPermissions: AdminPermissions = {};
      if (isOwner) {
        myPermissions = OWNER_PERMISSIONS;
      } else if (myMember?.role === 'ADMIN') {
        try {
          myPermissions = typeof myMember.permissions === 'string'
            ? JSON.parse(myMember.permissions)
            : (myMember.permissions || DEFAULT_ADMIN_PERMISSIONS);
        } catch (e) {
          myPermissions = DEFAULT_ADMIN_PERMISSIONS;
        }
      }

      // Permanent topics from GroupTopic table
      const dbTopics = (g.topics || []).map((t: any) => ({
        id: t.slug,
        dbId: t.id,
        name: t.name,
        icon: t.icon || '#',
        color: t.color || '#0d9488',
        subtitle: `Topic: ${t.name}`,
        time: '',
        createdAt: t.createdAt,
      }));

      // Combined topics ensuring 'General' is always topic 0
      const combinedTopics = [
        {
          id: 'general',
          name: 'General',
          icon: '#',
          color: '#64748b',
          subtitle: 'General chat room',
          time: '',
        },
      ];

      for (const dt of dbTopics) {
        if (dt.id !== 'general' && !combinedTopics.some((t) => t.id === dt.id)) {
          combinedTopics.push(dt);
        }
      }

      // Also merge any legacy mapped topics
      const groupSlug = (g.name || '').toLowerCase().replace(/\s+/g, '-');
      const legacyTopics = [...(legacyTopicsMap[g.id] || []), ...(legacyTopicsMap[groupSlug] || [])];
      for (const lt of legacyTopics) {
        if (lt.id !== 'general' && !combinedTopics.some((t) => t.id === lt.id)) {
          combinedTopics.push(lt);
        }
      }

      const formattedMembers = (g.members || []).map((m: any) => {
        const isMemOwner = g.createdById === m.userId;
        let perms = {};
        if (isMemOwner) {
          perms = OWNER_PERMISSIONS;
        } else if (m.role === 'ADMIN') {
          try {
            perms = typeof m.permissions === 'string' ? JSON.parse(m.permissions) : (m.permissions || DEFAULT_ADMIN_PERMISSIONS);
          } catch (e) {
            perms = DEFAULT_ADMIN_PERMISSIONS;
          }
        }

        return {
          userId: m.userId,
          role: isMemOwner ? 'OWNER' : (m.role || 'MEMBER'),
          permissions: perms,
          user: m.user ? {
            id: m.user.id,
            name: m.user.fullName || m.user.name || `User ${m.user.id}`,
            email: m.user.email,
            avatarBg: m.user.avatarBg,
            initials: m.user.initials,
          } : null,
        };
      });

      return {
        id: g.id,
        name: g.name,
        description: g.description || '',
        icon: g.icon || '📚',
        color: g.colorAccent || '#6366f1',
        ownerId: g.createdById,
        createdById: g.createdById,
        createdAt: g.createdAt,
        myRole,
        myPermissions,
        members: formattedMembers,
        topics: combinedTopics,
      };
    });
  }

  /**
   * Helper to parse a roomId string into parentGroupId and topicId
   */
  public parseChannelRoom(roomId: string): { parentGroupId: string; topicId: string; normalizedRoomId: string } {
    if (!roomId) return { parentGroupId: 'general', topicId: 'general', normalizedRoomId: 'general-general' };
    
    const trimmed = String(roomId).trim();
    // Check if starts with a 36-character UUID followed by '-' and topic
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

  /**
   * Checks if a user is authorized to access a given room / study group.
   * Private study groups are strictly restricted to invited members and group creators.
   */
  async canUserAccessRoom(roomId: string, userId: string): Promise<boolean> {
    if (!roomId || !userId) return false;
    const { parentGroupId } = this.parseChannelRoom(roomId);
    const parentGroupUuid = toUuid(parentGroupId);
    const userUuid = toUuid(userId);

    const group = await this.db.studyGroup.findUnique({
      where: { id: parentGroupUuid },
      include: { members: true },
    }).catch(() => null);

    if (!group) {
      // Check if it corresponds to a classroom general channel
      const classroom = await this.db.classroom.findFirst({
        where: {
          OR: [
            { id: parentGroupUuid },
            { inviteCode: parentGroupId },
            { title: { equals: parentGroupId, mode: 'insensitive' } },
          ],
        },
        include: { members: true, teachers: true },
      }).catch(() => null);

      if (classroom) {
        const isClassStudent = ((classroom as any).members || []).some((m: any) => m.userId === userUuid);
        const isClassTeacher = ((classroom as any).teachers || []).some((t: any) => t.userId === userUuid) || classroom.createdById === userUuid;
        return isClassStudent || isClassTeacher;
      }
      return true;
    }

    // Check if user is a teacher
    const requestingUser = await this.db.user.findUnique({
      where: { id: userUuid },
      select: { id: true, role: true },
    }).catch(() => null);

    const isClassroomChannel = group.icon === '🏫' ||
                              group.name.toLowerCase() === 'general' ||
                              group.name.toLowerCase() === 'flutter' ||
                              (group.classroomId ? group.id === toUuid(group.classroomId) : false);

    // Teachers are NEVER allowed to access student peer study groups
    if (requestingUser?.role === 'TEACHER' && !isClassroomChannel) {
      return false;
    }

    // It is a study group: ONLY enrolled student members or the creator can view/access
    const isMember = (group.members || []).some((m: any) => m.userId === userUuid) || group.createdById === userUuid;
    return isMember;
  }

  async getChatHistory(groupId: string, userId?: string) {
    const { parentGroupId, topicId, normalizedRoomId } = this.parseChannelRoom(groupId);
    const parentGroupUuid = toUuid(parentGroupId);

    if (userId) {
      const allowed = await this.canUserAccessRoom(groupId, userId);
      if (!allowed) {
        throw new ForbiddenException('Access denied. You are not a member of this private study group.');
      }
    }

    const messages = await this.db.chatMessage.findMany({
      where: {
        OR: [
          { attachments: { contains: `"roomId":"${normalizedRoomId}"` } },
          { attachments: { contains: `"roomId":"${groupId}"` } },
          {
            AND: [
              { attachments: { contains: `"groupId":"${parentGroupId}"` } },
              { attachments: { contains: `"topicId":"${topicId}"` } },
            ],
          },
          ...(topicId === 'general'
            ? [
                {
                  studyGroupId: parentGroupUuid,
                  attachments: { not: { contains: `"topicId":` } },
                },
              ]
            : []),
        ],
      },
      orderBy: { createdAt: 'asc' },
      include: {
        sender: true,
      },
    });

    // In-memory strict topic filter to completely prevent topic message bleeding
    const strictlyFiltered = messages.filter((msg) => {
      let att: any = {};
      if (typeof msg.attachments === 'string') {
        try { att = JSON.parse(msg.attachments); } catch (e) {}
      } else if (typeof msg.attachments === 'object' && msg.attachments) {
        att = msg.attachments;
      }

      const msgTopic = att.topicId || (att.roomId && att.roomId.includes('-') ? att.roomId.split('-').slice(1).join('-') : 'general');
      const msgGroup = att.groupId || (att.roomId ? att.roomId.split('-')[0] : msg.studyGroupId);

      if (msgTopic !== topicId) return false;
      if (msgGroup && parentGroupId && msgGroup !== parentGroupId && toUuid(msgGroup) !== parentGroupUuid) {
        return false;
      }
      return true;
    });

    const formatted = strictlyFiltered.map((msg) => this.formatMessage(msg));
    await this.attachReplies(formatted);
    return formatted;
  }

  async saveMessage(groupId: string, senderId: string, data: any) {
    const { parentGroupId, topicId, normalizedRoomId } = this.parseChannelRoom(groupId);
    const parentGroupUuid = toUuid(parentGroupId);
    const senderUuid = toUuid(senderId);

    await this.ensureUserExists(senderId);

    let existingGroup = await this.db.studyGroup.findUnique({
      where: { id: parentGroupUuid },
      include: { members: true, topics: true },
    });

    if (!existingGroup) {
      existingGroup = await this.db.studyGroup.findFirst({
        where: { OR: [{ id: parentGroupId }, { name: parentGroupId }] },
        include: { members: true, topics: true },
      });
    }

    if (!existingGroup) {
      const creatorId = senderId;
      const classroomId = await this.ensureClassroomExists(undefined, creatorId);

      let groupName = parentGroupId;
      if (parentGroupId === 'flutter') {
        groupName = 'Flutter';
      } else if (parentGroupId === 'react-native') {
        groupName = 'React Native';
      }

      try {
        existingGroup = await this.db.studyGroup.create({
          data: {
            id: parentGroupUuid,
            name: groupName,
            icon: '📚',
            colorAccent: '#6366f1',
            classroomId,
            createdById: senderUuid,
            members: {
              create: [{ userId: senderUuid, role: 'OWNER' }],
            },
          },
          include: { members: true, topics: true },
        });
      } catch (e) {}
    }

    // Validate Membership / Enrollment
    if (existingGroup) {
      const isMember = (existingGroup.members || []).some(
        (m: any) => m.userId === senderUuid || m.userId === senderId,
      ) || existingGroup.createdById === senderUuid || existingGroup.createdById === senderId;

      if (!isMember) {
        const isClassroomChannel = existingGroup.name.toLowerCase() === 'flutter' ||
                                  existingGroup.name.toLowerCase() === 'general' ||
                                  existingGroup.id === toUuid(existingGroup.classroomId || '');

        if (existingGroup.classroomId && isClassroomChannel) {
          const isClassMember = await this.db.classroomMember.findUnique({
            where: {
              classroomId_userId: {
                classroomId: existingGroup.classroomId,
                userId: senderUuid,
              },
            },
          });
          const isClassTeacher = await this.db.classroomTeacher.findUnique({
            where: {
              classroomId_userId: {
                classroomId: existingGroup.classroomId,
                userId: senderUuid,
              },
            },
          });

          if (isClassMember || isClassTeacher) {
            await this.db.studyGroupMember.create({
              data: {
                studyGroupId: existingGroup.id,
                userId: senderUuid,
                role: isClassTeacher ? 'ADMIN' : 'MEMBER',
              },
            }).catch(() => {});
          } else {
            throw new ForbiddenException('You must be a member of this classroom to send messages.');
          }
        } else {
          // Strictly reject non-members from private study groups
          throw new ForbiddenException('Access denied. You are not a member of this private study group.');
        }
      }

      // Validate Topic Exists for this Group
      if (topicId && topicId !== 'general') {
        const topicMatch = (existingGroup.topics || []).some(
          (t: any) => t.slug === topicId || t.id === topicId,
        );
        if (!topicMatch) {
          try {
            await (this.db as any).groupTopic?.create({
              data: {
                studyGroupId: existingGroup.id,
                name: topicId.charAt(0).toUpperCase() + topicId.slice(1).replace(/-/g, ' '),
                slug: topicId,
                createdById: senderUuid,
              },
            });
          } catch (e) {}
        }
      }
    }

    const isStaleBlobAudio =
      data.type === 'audio' &&
      typeof data.text === 'string' &&
      data.text.startsWith('blob:');

    if (isStaleBlobAudio) {
      console.warn(`Refusing to persist voice note with blob URL from ${senderId}`);
      return null;
    }

    const attachments: any = {
      image: data.image,
      type: data.type || 'text',
      fileName: data.fileName,
      fileSize: data.fileSize,
      fileIcon: data.fileIcon,
      replyToId: data.replyToId,
      forwardedFrom: data.forwardedFrom,
      groupId: parentGroupId,
      topicId: topicId,
      roomId: normalizedRoomId,
      rawRoomId: groupId,
      isPinned: false,
      reactions: [],
    };

    const savedMessage = await this.db.chatMessage.create({
      data: {
        content: data.text || '',
        senderId: senderUuid,
        studyGroupId: parentGroupUuid,
        attachments: JSON.stringify(attachments),
      },
      include: {
        sender: true,
      },
    });

    const formatted = this.formatMessage(savedMessage);

    if (formatted.replyToId) {
      await this.attachReplies([formatted]);
    }

    return formatted;
  }

  private async attachReplies(messages: any[]) {
    const replyIds = messages
      .map((m) => m.replyToId)
      .filter((id) => id && typeof id === 'string');

    if (replyIds.length === 0) return;

    const validReplyIds = replyIds.map((id) => toUuid(id));
    const replies = await this.db.chatMessage.findMany({
      where: { id: { in: validReplyIds } },
      include: { sender: true },
    });
    const replyMap = new Map<string, any>(replies.map((r) => [r.id, this.formatMessage(r)]));

    for (const message of messages) {
      if (!message.replyToId) continue;
      const reply: any = replyMap.get(toUuid(message.replyToId));
      if (reply) {
        message.replyTo = {
          id: reply.id,
          text: reply.text,
          sender: reply.sender?.name || reply.senderId,
        };
      }
    }
  }

  async togglePinMessage(messageId: string, isPinned: boolean, actorId?: string, groupId?: string) {
    if (actorId && groupId) {
      const auth = await this.getMemberRoleAndPermissions(groupId, actorId);
      const canPin = auth.isOwner || (auth.isAdmin && auth.permissions?.canPinMessages !== false);
      if (!canPin) {
        throw new ForbiddenException('Only admins with pin permissions can pin messages.');
      }
    }

    const messageUuid = toUuid(messageId);
    const existing = await this.db.chatMessage.findUnique({
      where: { id: messageUuid },
      include: { sender: true },
    });

    if (!existing) return null;

    let attachments: any = {};
    if (typeof existing.attachments === 'string') {
      try {
        attachments = JSON.parse(existing.attachments);
      } catch {
        attachments = {};
      }
    } else if (typeof existing.attachments === 'object' && existing.attachments) {
      attachments = existing.attachments;
    }
    attachments.isPinned = !!isPinned;

    const updated = await this.db.chatMessage.update({
      where: { id: messageUuid },
      data: { attachments: JSON.stringify(attachments) },
      include: { sender: true },
    });

    return this.formatMessage(updated);
  }

  async deleteMessage(messageId: string, actorId?: string, groupId?: string) {
    const messageUuid = toUuid(messageId);
    const msg = await this.db.chatMessage.findUnique({
      where: { id: messageUuid },
    });

    if (!msg) {
      throw new NotFoundException('Message not found');
    }

    if (actorId && msg.senderId !== toUuid(actorId)) {
      const gId = groupId || msg.studyGroupId;
      if (gId) {
        const auth = await this.getMemberRoleAndPermissions(gId, actorId);
        const canDeleteOthers = auth.isOwner || (auth.isAdmin && auth.permissions?.canDeleteMessages !== false);
        if (!canDeleteOthers) {
          throw new ForbiddenException('You can only delete your own messages.');
        }
      }
    }

    try {
      return await this.db.chatMessage.delete({
        where: { id: messageUuid },
      });
    } catch (err: any) {
      if (err?.code === 'P2025') {
        throw new NotFoundException('Message not found');
      }
      throw err;
    }
  }

  async editMessage(messageId: string, newText: string, actorId?: string) {
    const messageUuid = toUuid(messageId);
    const msg = await this.db.chatMessage.findUnique({
      where: { id: messageUuid },
    });

    if (!msg) {
      throw new NotFoundException('Message not found');
    }

    if (actorId && msg.senderId !== toUuid(actorId)) {
      throw new ForbiddenException('You can only edit your own messages.');
    }

    const updated = await this.db.chatMessage.update({
      where: { id: messageUuid },
      data: { content: newText },
      include: { sender: true },
    });
    return this.formatMessage(updated);
  }

  async toggleReaction(messageId: string, userId: string, emoji: string) {
    const messageUuid = toUuid(messageId);
    const validUserId = toUuid(userId);
    const message = await this.db.chatMessage.findUnique({
      where: { id: messageUuid },
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    let attachments: any = {};
    if (typeof message.attachments === 'string') {
      try {
        attachments = JSON.parse(message.attachments);
      } catch {
        attachments = {};
      }
    } else if (typeof message.attachments === 'object' && message.attachments) {
      attachments = message.attachments;
    }

    const currentReactions: Array<{ userId: string; emoji: string }> =
      attachments.reactions || [];
    const existingIndex = currentReactions.findIndex(
      (r) =>
        (r.userId === validUserId || r.userId === userId) && r.emoji === emoji,
    );

    if (existingIndex > -1) {
      currentReactions.splice(existingIndex, 1);
    } else {
      currentReactions.push({ userId: validUserId, emoji });
    }

    attachments.reactions = currentReactions;

    await this.db.chatMessage.update({
      where: { id: messageUuid },
      data: {
        attachments: JSON.stringify(attachments),
      },
    });

    return this.groupReactions(currentReactions);
  }
}
