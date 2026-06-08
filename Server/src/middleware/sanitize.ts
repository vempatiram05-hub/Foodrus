import { Request, Response, NextFunction } from "express";
import xss, { FilterXSS } from "xss";

/**
 * XSS filter configured to allow zero HTML tags.
 * For a pure REST API all HTML is unwanted — this strips it entirely
 * instead of escaping it, so stored values stay clean.
 *
 * Covers vectors the old regex missed:
 *   - Double-encoded chars (%3Cscript%3E)
 *   - SVG/MathML event handlers
 *   - CSS expression() / url(javascript:)
 *   - data: URIs
 */
const strictFilter = new FilterXSS({
  whiteList: {},          // no tags allowed
  stripIgnoreTag: true,   // remove disallowed tags entirely (not just escape)
  stripIgnoreTagBody: ["script", "style", "iframe", "noscript"],
});

function sanitizeValue(value: unknown): unknown {
  if (typeof value === "string") {
    return strictFilter.process(value);
  }
  if (Array.isArray(value)) {
    return value.map(sanitizeValue);
  }
  if (value !== null && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      result[key] = sanitizeValue(val);
    }
    return result;
  }
  return value;
}

/**
 * Sanitizes req.body, req.query, and req.params against XSS.
 * Applied before any route handler so all input surfaces are covered.
 */
export function sanitizeBody(req: Request, _res: Response, next: NextFunction): void {
  if (req.body && typeof req.body === "object") {
    req.body = sanitizeValue(req.body) as Record<string, unknown>;
  }
  if (req.query && typeof req.query === "object") {
    req.query = sanitizeValue(req.query) as Record<string, string>;
  }
  if (req.params && typeof req.params === "object") {
    req.params = sanitizeValue(req.params) as Record<string, string>;
  }
  next();
}

// Re-export xss helper for one-off use in controllers/services
export { xss as sanitizeString };
