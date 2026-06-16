import { Router } from 'express';
import { AuthRequest, authMiddleware } from '../middleware/auth';
import { UserService } from '../services/userService';

const router = Router();
const userService = new UserService();

router.post('/register', async (req, res) => {
  try {
    const { email, name, password } = req.body;
    if (!email || !name || !password) {
      return res.status(400).json({ error: '请填写完整信息' });
    }
    const { user, token } = await userService.register(email, name, password);
    res.json({
      success: true,
      token,
      user: { id: user.id, email: user.email, name: user.name, role: user.role }
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const { user, token } = await userService.login(email, password);
    res.json({
      success: true,
      token,
      user: { id: user.id, email: user.email, name: user.name, role: user.role }
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/me', authMiddleware, async (req: AuthRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: '未登录' });
    res.json({
      success: true,
      user: { id: req.user.id, email: req.user.email, name: req.user.name, role: req.user.role }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export { router as authRouter };
