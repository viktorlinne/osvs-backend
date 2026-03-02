import * as documentsRepo from "../repositories/documents.repo";
import type { DocumentRecord } from "../types";

export async function listDocuments(): Promise<DocumentRecord[]> {
  return documentsRepo.listDocuments();
}

export async function createDocument(
  title: string,
  pictureKey: string,
): Promise<number> {
  return documentsRepo.insertDocument(title, pictureKey);
}

export default {
  listDocuments,
  createDocument,
};
