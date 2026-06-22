import jwt from 'jsonwebtoken';
import { config } from '../config.js';

export interface TokenPayload {
  uid: number;
  username: string;
  role: 'owner' | 'user';
  language: 'vi' | 'zh';
}

export function signToken(payload: TokenPayload): string {
  return jwt.sign(payload, config.jwtSecret, { expiresIn: '30d' });
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, config.jwtSecret) as TokenPayload;
  } catch {
    return null;
  }
}
