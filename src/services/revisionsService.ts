import * as revisionsRepo from "../repositories/revisions.repo";
import type { RevisionRecord } from "../types";

export async function listRevisions(filters?: {
  year?: number;
  lodgeId?: number;
}): Promise<RevisionRecord[]> {
  return revisionsRepo.listRevisions(filters);
}

export async function createRevision(
  lodgeId: number,
  title: string,
  year: number,
  pictureKey: string,
): Promise<number> {
  return revisionsRepo.insertRevision(lodgeId, title, year, pictureKey);
}

export default {
  listRevisions,
  createRevision,
};
