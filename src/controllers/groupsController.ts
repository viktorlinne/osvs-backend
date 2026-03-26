import type { NextFunction, Response } from "express";
import type { AuthenticatedRequest } from "../types/auth";
import * as groupsService from "../services/groupsService";

export async function listGroupsHandler(
  _req: AuthenticatedRequest,
  res: Response,
  _next: NextFunction,
) {
  const groups = await groupsService.listGroups();
  return res.status(200).json({ groups });
}

export default {
  listGroupsHandler,
};
