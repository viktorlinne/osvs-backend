import express from "express";
import authMiddleware from "../middleware/auth";
import { wrapAsync } from "../middleware/asyncHandler";
import { listGroupsHandler } from "../controllers/groupsController";

const router = express.Router();

router.get("/", authMiddleware, wrapAsync(listGroupsHandler));

export default router;
