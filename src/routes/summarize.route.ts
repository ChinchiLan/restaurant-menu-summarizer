import express from "express";
import { handleSummarize } from "../controllers/summarize.controller";
import { requireApiKey } from "../middleware/auth.middleware";

const router = express.Router();

router.post("/summarize", requireApiKey, handleSummarize);

export default router;

