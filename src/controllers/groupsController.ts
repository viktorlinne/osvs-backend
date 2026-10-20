import type { NextFunction, Response } from "express";
import type { AuthenticatedRequest } from "../types/auth";
import * as groupsService from "../services/groupsService";
import {
  validateAddGroupMembersBody,
  validateCreateGroupBody,
  validateUpdateGroupBody,
} from "../validators";
import { sendError } from "../utils/response";
import { unwrapValidation } from "./helpers/request";

function parsePositiveIdParam(
  res: Response,
  value: unknown,
  message: string,
): number | null {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    sendError(res, 400, message);
    return null;
  }
  return parsed;
}

function parseGroupId(req: AuthenticatedRequest, res: Response) {
  return parsePositiveIdParam(res, req.params.id, "Ogiltigt grupp-id");
}

export async function listGroupsHandler(
  _req: AuthenticatedRequest,
  res: Response,
  _next: NextFunction,
) {
  const groups = await groupsService.listGroups();
  return res.status(200).json({ groups });
}

export async function getGroupHandler(
  req: AuthenticatedRequest,
  res: Response,
  _next: NextFunction,
) {
  const id = parseGroupId(req, res);
  if (id === null) return;
  const group = await groupsService.getGroup(id);
  return res.status(200).json({ group });
}

export async function createGroupHandler(
  req: AuthenticatedRequest,
  res: Response,
  _next: NextFunction,
) {
  const parsed = unwrapValidation(res, validateCreateGroupBody(req.body));
  if (!parsed) return;
  const group = await groupsService.createGroup(parsed);
  return res.status(201).json({ success: true, id: group.id, group });
}

export async function updateGroupHandler(
  req: AuthenticatedRequest,
  res: Response,
  _next: NextFunction,
) {
  const id = parseGroupId(req, res);
  if (id === null) return;
  const parsed = unwrapValidation(res, validateUpdateGroupBody(req.body));
  if (!parsed) return;
  const group = await groupsService.updateGroup(id, parsed);
  return res.status(200).json({ success: true, group });
}

export async function deleteGroupHandler(
  req: AuthenticatedRequest,
  res: Response,
  _next: NextFunction,
) {
  const id = parseGroupId(req, res);
  if (id === null) return;
  await groupsService.deleteGroup(id);
  return res.status(200).json({ success: true });
}

export async function listGroupMembersHandler(
  req: AuthenticatedRequest,
  res: Response,
  _next: NextFunction,
) {
  const id = parseGroupId(req, res);
  if (id === null) return;
  const members = await groupsService.listGroupMembers(id);
  return res.status(200).json({ members });
}

export async function addGroupMembersHandler(
  req: AuthenticatedRequest,
  res: Response,
  _next: NextFunction,
) {
  const id = parseGroupId(req, res);
  if (id === null) return;
  const parsed = unwrapValidation(res, validateAddGroupMembersBody(req.body));
  if (!parsed) return;
  const result = await groupsService.addGroupMembers(id, parsed.userIds);
  return res.status(200).json({ success: true, ...result });
}

export async function removeGroupMemberHandler(
  req: AuthenticatedRequest,
  res: Response,
  _next: NextFunction,
) {
  const id = parseGroupId(req, res);
  if (id === null) return;
  const uid = parsePositiveIdParam(
    res,
    req.params.matrikelnummer,
    "Ogiltigt matrikelnummer",
  );
  if (uid === null) return;
  await groupsService.removeGroupMember(id, uid);
  return res.status(200).json({ success: true });
}

export default {
  listGroupsHandler,
  getGroupHandler,
  createGroupHandler,
  updateGroupHandler,
  deleteGroupHandler,
  listGroupMembersHandler,
  addGroupMembersHandler,
  removeGroupMemberHandler,
};
