import { randomUUID } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';

export function correlationMiddleware(req: Request, res: Response, next: NextFunction): void {
  const supplied = req.header('x-request-id');
  const id = supplied && /^[A-Za-z0-9._:-]{1,64}$/.test(supplied) ? supplied : randomUUID();
  req.headers['x-request-id'] = id;
  res.setHeader('x-request-id', id);
  next();
}
