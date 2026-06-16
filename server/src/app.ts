import express from 'express';
import cors from 'cors';
import fileUpload from 'express-fileupload';
import path from 'path';
import { config } from './config';
import { initDatabase } from './database';
import { authRouter } from './routes/auth';
import { contractRouter } from './routes/contract';
import { signRouter } from './routes/sign';
import { UserService } from './services/userService';
import { startCronJobs } from './services/cronService';

const app = express();

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(fileUpload({
  limits: { fileSize: 50 * 1024 * 1024 },
  useTempFiles: false
}));

app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.use('/api/auth', authRouter);
app.use('/api/contracts', contractRouter);
app.use('/api/sign', signRouter);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

async function start() {
  try {
    await initDatabase();
    
    const userService = new UserService();
    await userService.ensureDefaultAdmin();
    
    startCronJobs();

    app.listen(config.port, () => {
      console.log(`服务已启动: http://localhost:${config.port}`);
      console.log(`前端地址: ${config.frontendUrl}`);
    });
  } catch (error) {
    console.error('启动失败:', error);
    process.exit(1);
  }
}

start();
