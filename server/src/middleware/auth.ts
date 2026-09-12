import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthPayload {
  id: number;
  username: string;
  role: 'admin' | 'worker';
  name: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthPayload;
    }
  }
}

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

export function signToken(payload: AuthPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '12h' });
}

export function authenticate(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: '인증 토큰이 필요합니다.' });
  }
  const token = header.slice('Bearer '.length);
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthPayload;
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ error: '유효하지 않거나 만료된 토큰입니다.' });
  }
}

export function requireRole(...roles: Array<'admin' | 'worker'>) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: '이 작업을 수행할 권한이 없습니다.' });
    }
    next();
  };
}
