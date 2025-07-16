import { NextFunction, Request, Response } from "express";
import { ValidationError } from "../../exceptions/base.exception.js";
import { validateDetailsQuerystring } from "../../schemes/relayer/details.scheme.js";
import { zRelayRequest } from "../../schemes/relayer/request.scheme.js";
import { validateQuoteBody } from "../../schemes/relayer/quote.scheme.js";

// Middleware to validate the details querying
export function validateDetailsMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const isValid = validateDetailsQuerystring(req.query);
  if (!isValid) {
    const messages: string[] = [];
    validateDetailsQuerystring.errors?.forEach(e => e?.message ? messages.push(e.message) : undefined);
    next(ValidationError.invalidQuerystring({ message: messages.join("\n") }));
    return;
  }
  next();
}

// Middleware to validate the relay-request body
export function validateRelayRequestMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const { success, error } = zRelayRequest.safeParse(req.body);
  if (!success) {
    next(ValidationError.invalidInput({ message: error.errors.map(i => `${i.path.join('.')}: ${i.message}`).join("\n") }));
    return;
  }
  next();
}


// Middleware to validate the quote
export function validateQuoteMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const isValid = validateQuoteBody(req.body);
  if (!isValid) {
    const messages: string[] = [];
    validateQuoteBody.errors?.forEach(e => e?.message ? messages.push(e.message) : undefined);
    next(ValidationError.invalidInput({ message: messages.join("\n") }));
    return;
  }
  next();
}
