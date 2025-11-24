import { Request, Response } from "express";
import { menuService } from "../services/menu.service";
import { handleError } from "../utils/error-mapper";
import { LOG_SOURCES } from "../constants/log";

export async function handleSummarize(req: Request, res: Response): Promise<void> {
  try {
    const result = await menuService.summarize(req.body);
    res.status(200).json(result);
  } catch (error) {
    handleError(error, res, LOG_SOURCES.SUMMARIZE);
  }
}
