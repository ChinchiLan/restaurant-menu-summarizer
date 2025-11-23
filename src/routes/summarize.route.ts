import { Router, Request, Response } from "express";

const router = Router();

router.post("/summarize", async (req: Request, res: Response) => {
  res.json({ message: "summarize endpoint works" });
});

export default router;

