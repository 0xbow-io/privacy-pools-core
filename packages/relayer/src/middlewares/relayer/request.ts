import { NextFunction, Request, Response } from "express";
import { ValidationError } from "../../exceptions/base.exception.js";
import { DetailsQuery, validateDetailsQuerystring } from "../../schemes/relayer/details.scheme.js";
import { QuoteBody, validateQuoteBody } from "../../schemes/relayer/quote.scheme.js";
import { RelayBody, validateRelayRequestBody } from "../../schemes/relayer/request.scheme.js";

export interface DetailsRequest extends Request { parsedQuery: DetailsQuery };
export interface RelayRequest extends Request { body: RelayBody };
export interface QuoteRequest extends Request { body: QuoteBody };

// Middleware to validate the details querying
export function validateDetailsMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const result = validateDetailsQuerystring(req.query);
  if (!result.success) {
    const messages = result.errors?.filter(({message}) => message !== undefined).map(({message}) => message)
    next(ValidationError.invalidQuerystring({ message: messages!.join("\n") }));
    return;
  }
  (req as DetailsRequest).parsedQuery = result.data;
  next();
}

// Middleware to validate the relay-request body
export function validateRelayRequestMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const result = validateRelayRequestBody(req.body);
  if (!result.success) {
    const messages = result.errors?.filter(({message}) => message !== undefined).map(({message}) => message)
    next(ValidationError.invalidInput({ message: messages!.join("\n") }));
    return;
  }
  req.body = result.data;
  next();
}

// Middleware to validate the quote
export function validateQuoteMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const result = validateQuoteBody(req.body);
  if (!result.success) {
    const messages = result.errors?.filter(({message}) => message !== undefined).map(({message}) => message)
    next(ValidationError.invalidInput({ message: messages!.join("\n") }));
    return;
  }
  req.body = result.data;
  next();
}
