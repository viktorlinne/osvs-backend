import express from "express";
import authMiddleware from "../middleware/auth";
import { requireRole } from "../middleware/authorize";
import { wrapAsync } from "../middleware/asyncHandler";
import {
  addGroupMembersHandler,
  createGroupHandler,
  deleteGroupHandler,
  getGroupHandler,
  listGroupMembersHandler,
  listGroupsHandler,
  removeGroupMemberHandler,
  updateGroupHandler,
} from "../controllers/groupsController";

const router = express.Router();
const canManageGroups = requireRole("Admin", "Editor");

router.get("/", authMiddleware, wrapAsync(listGroupsHandler));
router.post("/", authMiddleware, canManageGroups, wrapAsync(createGroupHandler));

router.get("/:id", authMiddleware, wrapAsync(getGroupHandler));
router.put("/:id", authMiddleware, canManageGroups, wrapAsync(updateGroupHandler));
router.delete(
  "/:id",
  authMiddleware,
  canManageGroups,
  wrapAsync(deleteGroupHandler),
);

router.get("/:id/members", authMiddleware, wrapAsync(listGroupMembersHandler));
router.post(
  "/:id/members",
  authMiddleware,
  canManageGroups,
  wrapAsync(addGroupMembersHandler),
);
router.delete(
  "/:id/members/:matrikelnummer",
  authMiddleware,
  canManageGroups,
  wrapAsync(removeGroupMemberHandler),
);

export default router;
