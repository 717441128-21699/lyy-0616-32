import bcrypt from 'bcryptjs';
import { User } from '../models';
import { generateToken } from '../middleware/auth';

export class UserService {
  async register(email: string, name: string, password: string, role: 'admin' | 'user' = 'user'): Promise<{ user: User; token: string }> {
    const existing = await User.findOne({ where: { email } });
    if (existing) {
      throw new Error('该邮箱已被注册');
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({ email, name, password: hashedPassword, role });
    const token = generateToken(user);
    return { user, token };
  }

  async login(email: string, password: string): Promise<{ user: User; token: string }> {
    const user = await User.findOne({ where: { email } });
    if (!user) {
      throw new Error('用户不存在');
    }
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      throw new Error('密码错误');
    }
    const token = generateToken(user);
    return { user, token };
  }

  async getUserById(id: string): Promise<User | null> {
    return User.findByPk(id, { attributes: { exclude: ['password'] } });
  }

  async ensureDefaultAdmin(): Promise<void> {
    const admin = await User.findOne({ where: { role: 'admin' } });
    if (!admin) {
      await this.register('admin@contract.com', '系统管理员', 'admin123', 'admin');
      console.log('默认管理员已创建: admin@contract.com / admin123');
    }
    const demo = await User.findOne({ where: { email: 'demo@contract.com' } });
    if (!demo) {
      await this.register('demo@contract.com', '演示用户', 'demo123', 'user');
      console.log('演示用户已创建: demo@contract.com / demo123');
    }
  }
}
