import express from "express";
import {
  listAllergiesHandler,
  setMemberAllergiesHandler,
} from "../controllers/allergiesController";
import { wrapAsync } from "../middleware/asyncHandler";
import authMiddleware from "../middleware/auth";
import { allowSelfOrRoles } from "../middleware/authorize";

const router = express.Router();

// Public list of allergies
router.get("/", wrapAsync(listAllergiesHandler));

// Set a member's allergies (self or Admin/Editor)
router.put(
  "/member/:matrikelnummer",
  authMiddleware,
  allowSelfOrRoles("Admin", "Editor"),
  wrapAsync(setMemberAllergiesHandler),
);

export default router;
