import express from "express";
import authMiddleware from "../middleware/auth";
import { requireRole } from "../middleware/authorize";
import { wrapAsync } from "../middleware/asyncHandler";
import {
  createRevisionHandler,
  listRevisionsHandler,
} from "../controllers/revisionsController";
import { uploadDocumentFile } from "../utils/fileUpload";

const router = express.Router();

router.get("/", authMiddleware, wrapAsync(listRevisionsHandler));

router.post(
  "/",
  authMiddleware,
  requireRole("Admin", "Editor"),
  uploadDocumentFile,
  wrapAsync(createRevisionHandler),
);

export default router;
