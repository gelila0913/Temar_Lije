import {
  Injectable,
  NotFoundException,
  ForbiddenException,
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

@Injectable()
export class ChatService {
  constructor(private readonly db: DatabaseService) { }

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
    const senderObj = msg.sender ? {
      id: msg.sender.id,
      name: msg.sender.fullName || `User ${msg.sender.id}`,
      initials: msg.sender.initials,
      avatarBg: msg.sender.avatarBg,
    } : null;

    return {
      id: msg.id,
      text: msg.content,
      content: msg.content,
      senderId: msg.senderId,
      sender: senderObj,
      createdAt: msg.createdAt,
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

  private _deriveInitials(name?: string) {
    const parts = (name || 'U').trim().split(/\s+/).filter(Boolean);
    return parts.map((p) => p[0]).join('').slice(0, 2).toUpperCase() || 'U';
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
      // Allow seamless access to classroom study groups and default channels
      if (group.classroomId || group.id === 'flutter' || group.id === 'react-native') {
        await this.ensureUserExists(userId);
        await this.db.studyGroupMember.create({
          data: {
            userId: toUuid(userId),
            studyGroupId: group.id,
          },
        }).catch(() => { });
        return group;
      }
      throw new ForbiddenException('You are not a member of this group');
    }

    return group;
  }

  private async _assertOwner(groupId: string, userId: string) {
    return this._assertGroupAccess(groupId, userId);
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

  async createGroup(
    name: string,
    description?: string,
    icon?: string,
    color?: string,
    memberIds: string[] = [],
    id?: string,
    creatorId?: string,
    classroomId?: string,
  ) {
    const effectiveCreatorId = creatorId || memberIds[0] || 'gs';
    await this.ensureUserExists(effectiveCreatorId);
    for (const memberId of memberIds) {
      await this.ensureUserExists(memberId);
    }

    const effectiveClassroomId = classroomId
      ? await this.ensureClassroomExists(classroomId, effectiveCreatorId)
      : undefined;
    const groupUuid = id ? toUuid(id) : undefined;

    const createdGroup = await this.db.studyGroup.create({
      data: {
        ...(groupUuid ? { id: groupUuid } : {}),
        name,
        icon: icon || '📚',
        colorAccent: color || '#6366f1',
        classroomId: effectiveClassroomId || undefined,
        createdById: toUuid(effectiveCreatorId),
        members: {
          create: memberIds.map((userId) => ({
            userId: toUuid(userId),
          })),
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
      ...createdGroup,
      description: description || '',
    };
  }

  async updateMemberRole(
    groupId: string,
    userId: string,
    role: string,
    actorId?: string,
  ) {
    const member = await this.db.studyGroupMember.findFirst({
      where: {
        studyGroupId: toUuid(groupId),
        userId: toUuid(userId),
      },
    });
    return { groupId, userId, role, success: !!member };
  }

  async getGroups(userId?: string, classroomId?: string | number) {
    const classIdStr = classroomId ? String(classroomId) : undefined;
    return this.db.studyGroup.findMany({
      where: classIdStr
        ? { classroomId: toUuid(classIdStr) }
        : {
          OR: [
            ...(userId ? [{ members: { some: { userId: toUuid(userId) } } }] : []),
            { members: { none: {} } },
            { classroomId: null },
          ],
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
  }

  async getChatHistory(groupId: string, userId?: string) {
    const messages = await this.db.chatMessage.findMany({
      where: { studyGroupId: toUuid(groupId) },
      orderBy: { createdAt: 'asc' },
      include: {
        sender: true,
      },
    });

    const formatted = messages.map((msg) => this.formatMessage(msg));
    await this.attachReplies(formatted);
    return formatted;
  }

  async saveMessage(groupId: string, senderId: string, data: any) {
    const groupUuid = toUuid(groupId);
    const senderUuid = toUuid(senderId);

    const existingGroup = await this.db.studyGroup.findUnique({
      where: { id: groupUuid },
    });

    if (!existingGroup) {
      const creatorId = senderId;
      await this.ensureUserExists(creatorId);
      const classroomId = await this.ensureClassroomExists(undefined, creatorId);

      const allGroups = await this.db.studyGroup.findMany({ select: { id: true } });
      const parentGroup = allGroups.find(
        (g) => groupId.startsWith(g.id + '-') && g.id !== groupId,
      );

      let groupName = groupId;
      if (parentGroup) {
        const topicSuffix = groupId.substring(parentGroup.id.length + 1);
        groupName = topicSuffix.charAt(0).toUpperCase() + topicSuffix.slice(1).replace(/-/g, ' ');
      } else if (groupId === 'flutter') {
        groupName = 'Flutter';
      } else if (groupId === 'react-native') {
        groupName = 'React Native';
      }

      await this.db.studyGroup.create({
        data: {
          id: groupUuid,
          name: groupName,
          classroomId,
          createdById: senderUuid,
        },
      });
    }

    await this.ensureUserExists(senderId);

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
      isPinned: false,
      reactions: [],
    };

    const savedMessage = await this.db.chatMessage.create({
      data: {
        content: data.text || '',
        senderId: senderUuid,
        studyGroupId: groupUuid,
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
    const replyMap = new Map(replies.map((r) => [r.id, this.formatMessage(r)]));

    for (const message of messages) {
      if (!message.replyToId) continue;
      const reply = replyMap.get(toUuid(message.replyToId));
      if (reply) {
        message.replyTo = {
          id: reply.id,
          text: reply.text,
          sender: reply.sender?.name || reply.senderId,
        };
      }
    }
  }

  async togglePinMessage(messageId: string, isPinned: boolean) {
    const messageUuid = toUuid(messageId);
    const existing = await this.db.chatMessage.findUnique({
      where: { id: messageUuid },
      include: { sender: true },
    });

    if (!existing) return null;

    let attachments: any = {};
    if (typeof existing.attachments === 'string') {
      try { attachments = JSON.parse(existing.attachments); } catch { attachments = {}; }
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

  async deleteMessage(messageId: string) {
    try {
      return await this.db.chatMessage.delete({
        where: { id: toUuid(messageId) },
      });
    } catch (err: any) {
      if (err?.code === 'P2025') {
        throw new NotFoundException('Message not found');
      }
      throw err;
    }
  }

  async editMessage(messageId: string, text: string) {
    try {
      const updated = await this.db.chatMessage.update({
        where: { id: toUuid(messageId) },
        data: { content: text },
        include: { sender: true },
      });
      return this.formatMessage(updated);
    } catch (err: any) {
      if (err?.code === 'P2025') {
        throw new NotFoundException('Message not found');
      }
      throw err;
    }
  }

  async toggleReaction(messageId: string, userId: string, emoji: string) {
    await this.ensureUserExists(userId);
    const messageUuid = toUuid(messageId);
    const message = await this.db.chatMessage.findUnique({
      where: { id: messageUuid },
    });

    if (!message) return [];

    let attachments: any = {};
    if (typeof message.attachments === 'string') {
      try { attachments = JSON.parse(message.attachments); } catch { attachments = {}; }
    } else if (typeof message.attachments === 'object' && message.attachments) {
      attachments = message.attachments;
    }
    let reactions: Array<{ userId: string; emoji: string }> = attachments.reactions || [];

    const existingIdx = reactions.findIndex((r) => r.userId === userId && r.emoji === emoji);

    if (existingIdx >= 0) {
      reactions.splice(existingIdx, 1);
    } else {
      reactions = reactions.filter((r) => r.userId !== userId);
      reactions.push({ userId, emoji });
    }

    attachments.reactions = reactions;

    await this.db.chatMessage.update({
      where: { id: messageUuid },
      data: { attachments: JSON.stringify(attachments) },
    });

    return this.groupReactions(reactions);
  }

  async deleteGroup(id: string, userId?: string) {
    try {
      const groupUuid = toUuid(id);
      await this.db.studyGroupMember.deleteMany({
        where: { studyGroupId: groupUuid },
      });
      await this.db.chatMessage.deleteMany({
        where: { studyGroupId: groupUuid },
      });
      return await this.db.studyGroup.deleteMany({
        where: { id: groupUuid },
      });
    } catch (err: any) {
      console.warn(`Could not delete group ${id}:`, err.message);
      return { count: 0 };
    }
  }

  async removeMember(groupId: string, userId: string, actorId?: string) {
    try {
      return await this.db.studyGroupMember.deleteMany({
        where: {
          userId: toUuid(userId),
          studyGroupId: toUuid(groupId),
        },
      });
    } catch (err: any) {
      console.warn(
        `Could not remove member ${userId} from ${groupId}:`,
        err.message,
      );
      return { count: 0 };
    }
  }
}
