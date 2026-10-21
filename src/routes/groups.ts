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
import {
  createGroupMailingHandler,
  listGroupMailingsHandler,
  previewGroupMailingHandler,
} from "../controllers/mailingsController";

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

// Group mailings (OSVS-24), Admin/Editor only.
router.get(
  "/:id/mailings/preview",
  authMiddleware,
  canManageGroups,
  wrapAsync(previewGroupMailingHandler),
);
router.get(
  "/:id/mailings",
  authMiddleware,
  canManageGroups,
  wrapAsync(listGroupMailingsHandler),
);
router.post(
  "/:id/mailings",
  authMiddleware,
  canManageGroups,
  wrapAsync(createGroupMailingHandler),
);
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
