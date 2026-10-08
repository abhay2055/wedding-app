import { NextFunction, Request, Response } from "express";
import { AnyZodObject, ZodError } from "zod";
import { ApiError } from "../utils/apiError";

export function validate(schema: AnyZodObject) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      const parsed = schema.parse({
        body: req.body,
        params: req.params,
        query: req.query,
      });
      req.body = parsed.body ?? req.body;
      // Zod-coerced/defaulted query values (e.g. page/limit numbers) - the
      // validated result is what the rest of the request should see, not
      // the raw string query params.
      if (parsed.query) {
        Object.assign(req.query, parsed.query);
      }
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const message = error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join("; ");
        next(ApiError.badRequest(message, "VALIDATION_ERROR"));
        return;
      }
      next(error);
    }
  };
}
