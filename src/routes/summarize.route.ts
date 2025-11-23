import express from "express";
import { handleSummarize } from "../controllers/summarize.controller";

const router = express.Router();

router.post("/summarize", handleSummarize);

export default router;

