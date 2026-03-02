import express from "express";
import authMiddleware from "../middleware/auth";
import { requireRole } from "../middleware/authorize";
import { wrapAsync } from "../middleware/asyncHandler";
import {
  createDocumentHandler,
  listDocumentsHandler,
} from "../controllers/documentsController";
import { uploadDocumentFile } from "../utils/fileUpload";

const router = express.Router();

router.get("/", authMiddleware, wrapAsync(listDocumentsHandler));

router.post(
  "/",
  authMiddleware,
  requireRole("Admin", "Editor"),
  uploadDocumentFile,
  wrapAsync(createDocumentHandler),
);

export default router;
