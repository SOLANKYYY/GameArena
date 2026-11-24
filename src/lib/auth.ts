import jwt from 'jsonwebtoken';
import { JWT_SECRET, JWT_EXPIRY } from './constants';
import { NextRequest } from 'next/server';

export interface JwtPayload {
  userId: number;
  username: string;
  role: string;
  teamName: string;
}

export function signToken(payload: JwtPayload): string {
  if (!JWT_SECRET) throw new Error('JWT_SECRET must be configured before signing in.');
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRY });
}

export function verifyToken(token: string): JwtPayload | null {
  if (!JWT_SECRET) return null;
  try {
    return jwt.verify(token, JWT_SECRET) as JwtPayload;
  } catch {
    return null;
  }
}

export function getUserFromRequest(req: NextRequest): JwtPayload | null {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);
  return verifyToken(token);
}

export function requireAuth(req: NextRequest): JwtPayload {
  const user = getUserFromRequest(req);
  if (!user) throw new Error('Unauthorized');
  return user;
}

export function requireAdmin(req: NextRequest): JwtPayload {
  const user = requireAuth(req);
  if (user.role !== 'admin') throw new Error('Forbidden');
  return user;
}
