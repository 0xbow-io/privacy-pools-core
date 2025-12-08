import { NextFunction, Request, Response } from "express";
import { randomBytes } from "crypto";
import { ValidationError } from "../../exceptions/base.exception.js";

/**
 * Generate or retrieve the admin API key
 * Uses ADMIN_API_KEY env var if set, otherwise generates random 64-char string
 * @returns {string} The api-key
 */
function getAdminApiKey(): string {
  // TODO maybe apikey should be longer than 15 chars
  const key = process.env.ADMIN_API_KEY || randomBytes(32).toString('hex');
  
  if (!process.env.ADMIN_API_KEY) {
    console.info(`Generated random API key: ${key}`);
  }
  
  return key;
}

// Generate the admin API key once at startup
const ADMIN_API_KEY = getAdminApiKey();

/**
 * Middleware to validate admin API key
 * Requires "api-key" header with SHA256 hash value
 */
export function adminMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const apiKey = req.headers['x-api-key'];
  
  console.debug("Admin middleware: validating API key");
  
  if (!apiKey || apiKey === "") {
    console.warn(`Admin middleware: Missing or empty api-key header: ${apiKey}`);
    return next(ValidationError.invalidQuerystring({ // TODO make a new error for invalidapi key 403 
      message: apiKey === "" ? "Invalid api-key" : "Missing api-key header"
    }));
  }
  
  if (apiKey !== ADMIN_API_KEY) {
    console.warn(`Admin middleware: Invalid api-key: ${apiKey}`);
    return next(ValidationError.invalidQuerystring({ 
      message: "Invalid api-key" 
    }));
  }
  
  console.debug("Admin middleware: API key validated successfully");
  next();
}
