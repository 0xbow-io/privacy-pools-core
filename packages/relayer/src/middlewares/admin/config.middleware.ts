import { NextFunction, Request, Response } from "express";
import { UpdateConfigBody, validateConfigUpdateBody, DeleteConfigBody, validateConfigDeleteBody } from "./../../config/schemas.js";
import { ValidationError } from "../../exceptions/base.exception.js";

export interface UpdateConfigRequest extends Request { body: UpdateConfigBody };
export interface DeleteConfigRequest extends Request { body: DeleteConfigBody };

// Middleware to validate the config update request
export function validateConfigUpdateMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  const result = validateConfigUpdateBody(req.body);
  console.debug("Config: validating request: ", result);
  if (!result.success) {
    const messages: string[] = [];
    result.errors?.forEach((e) => {
      if (e?.message) {
        messages.push(`${e?.path[0]!.toString()}: ${e.message}`);
      }
    });
    next(ValidationError.invalidQuerystring({ message: messages.join() }));
    return;
  }
  req.body= result.data;
  next();
}

// Middleware to validate the config delete request
export function validateConfigDeleteMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  const result = validateConfigDeleteBody(req.body);
  console.debug("Config Delete: validating request: ", result);
  if (!result.success) {
    const messages: string[] = [];
    result.errors?.forEach((e) => {
      if (e?.message) {
        messages.push(`${e?.path[0]!.toString()}: ${e.message}`);
      }
    });
    next(ValidationError.invalidQuerystring({ message: messages.join() }));
    return;
  }
  req.body= result.data;
  next();
}
