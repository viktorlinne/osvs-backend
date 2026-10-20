import * as groupsRepo from "../repositories/groups.repo";
import type { Group, GroupMember } from "../types";
import { ConflictError, ValidationError, notFound } from "../utils/errors";

export const GROUP_NOT_FOUND_MESSAGE = "Gruppen hittades inte";
export const GROUP_NAME_TAKEN_MESSAGE = "Det finns redan en grupp med det namnet";
export const MEMBER_NOT_IN_GROUP_MESSAGE = "Medlemmen finns inte i gruppen";

export type AddGroupMembersResult = {
  added: number[];
  alreadyMembers: number[];
};

async function requireGroup(id: number): Promise<Group> {
  const group = await groupsRepo.findGroupById(id);
  if (!group) throw notFound(GROUP_NOT_FOUND_MESSAGE);
  return group;
}

async function assertNameAvailable(name: string, excludeId?: number) {
  const existingId = await groupsRepo.findGroupIdByName(name, excludeId);
  if (existingId !== null) {
    throw new ConflictError("name", GROUP_NAME_TAKEN_MESSAGE);
  }
}

export async function listGroups(): Promise<Group[]> {
  return await groupsRepo.listGroups();
}

export async function getGroup(id: number): Promise<Group> {
  return await requireGroup(id);
}

export async function createGroup(input: {
  name: string;
  description: string | null;
}): Promise<Group> {
  await assertNameAvailable(input.name);
  const id = await groupsRepo.insertGroup(input.name, input.description);
  return {
    id,
    name: input.name,
    description: input.description,
    userIds: [],
    memberCount: 0,
  };
}

export async function updateGroup(
  id: number,
  changes: { name?: string; description?: string | null },
): Promise<Group> {
  const current = await requireGroup(id);

  // Only enforce the name check when the name actually changes, so editing the
  // description of an imported group that shares a name with another still works.
  if (
    typeof changes.name === "string" &&
    changes.name.trim().toLowerCase() !== current.name.trim().toLowerCase()
  ) {
    await assertNameAvailable(changes.name, id);
  }

  await groupsRepo.updateGroup(id, changes);
  return await requireGroup(id);
}

export async function deleteGroup(id: number): Promise<void> {
  const affected = await groupsRepo.deleteGroup(id);
  if (affected === 0) throw notFound(GROUP_NOT_FOUND_MESSAGE);
}

export async function listGroupMembers(id: number): Promise<GroupMember[]> {
  await requireGroup(id);
  return await groupsRepo.listGroupMembers(id);
}

/**
 * Adds members idempotently: users already in the group are reported in
 * `alreadyMembers` instead of failing the request. Unknown users fail the
 * whole request with a field error on `userIds`.
 */
export async function addGroupMembers(
  id: number,
  userIds: number[],
): Promise<AddGroupMembersResult> {
  await requireGroup(id);

  const existingUsers = new Set(await groupsRepo.selectExistingUserIds(userIds));
  const unknown = userIds.filter((uid) => !existingUsers.has(uid));
  if (unknown.length > 0) {
    throw new ValidationError({
      userIds:
        unknown.length === 1
          ? `Medlemmen med matrikelnummer ${unknown[0]} finns inte`
          : `Medlemmarna med matrikelnummer ${unknown.join(", ")} finns inte`,
    });
  }

  const currentMembers = new Set(
    await groupsRepo.selectMemberIdsInGroup(id, userIds),
  );
  const added = userIds.filter((uid) => !currentMembers.has(uid));
  const alreadyMembers = userIds.filter((uid) => currentMembers.has(uid));

  await groupsRepo.insertMemberships(id, added);
  return { added, alreadyMembers };
}

export async function removeGroupMember(id: number, uid: number): Promise<void> {
  await requireGroup(id);
  const affected = await groupsRepo.deleteMembership(id, uid);
  if (affected === 0) throw notFound(MEMBER_NOT_IN_GROUP_MESSAGE);
}

export default {
  listGroups,
  getGroup,
  createGroup,
  updateGroup,
  deleteGroup,
  listGroupMembers,
  addGroupMembers,
  removeGroupMember,
};
