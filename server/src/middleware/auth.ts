import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { User } from '../models';

export interface AuthRequest extends Request {
  user?: User;
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: '未提供认证令牌' });
    }
    const decoded = jwt.verify(token, config.jwtSecret) as any;
    User.findByPk(decoded.userId).then(user => {
      if (!user) {
        return res.status(401).json({ error: '用户不存在' });
      }
      req.user = user;
      next();
    });
  } catch (error) {
    return res.status(401).json({ error: '认证令牌无效' });
  }
}

export function generateToken(user: User): string {
  return jwt.sign(
    { userId: user.id, email: user.email, role: user.role },
    config.jwtSecret,
    { expiresIn: '7d' }
  );
}

export function generateSignToken(signerId: string, contractId: string): string {
  return jwt.sign(
    { signerId, contractId },
    config.jwtSecret,
    { expiresIn: '30d' }
  );
}

export function verifySignToken(token: string): any {
  try {
    return jwt.verify(token, config.jwtSecret);
  } catch (error) {
    return null;
  }
}
