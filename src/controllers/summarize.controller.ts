import { Request, Response, NextFunction } from "express";
import { menuService } from "../services/menu.service";

/**
 * Wrapper to ensure async errors are properly caught and passed to error handler
 */
export function handleSummarize(req: Request, res: Response, next: NextFunction): void {
  menuService.summarize(req.body)
    .then(result => {
      res.status(200).json(result);
    })
    .catch(error => {
      // Pass error to global error handler middleware
      next(error);
    });
}
