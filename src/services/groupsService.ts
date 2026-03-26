import * as groupsRepo from "../repositories/groups.repo";
import type { Group } from "../types";

export async function listGroups(): Promise<Group[]> {
  return await groupsRepo.listGroups();
}

export default {
  listGroups,
};
