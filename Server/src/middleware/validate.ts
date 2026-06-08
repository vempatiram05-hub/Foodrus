import { Request, Response, NextFunction } from "express";
import { ZodSchema } from "zod";

/**
 * Returns an Express middleware that validates req.body against the given
 * Zod schema. On failure it responds with 400 and a structured error list.
 * On success it replaces req.body with the parsed (and coerced) value.
 */
export function validate(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const errors = result.error.issues.map((e) => ({
        field: e.path.join("."),
        message: e.message,
      }));
      res.status(400).json({ success: false, message: "Validation failed", errors });
      return;
    }
    req.body = result.data;
    next();
  };
}
