export const config = {
  port: parseInt(process.env.PORT || '3001'),
  jwtSecret: process.env.JWT_SECRET || 'e-contract-secret-key-2024',
  uploadDir: process.env.UPLOAD_DIR || 'uploads',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  database: {
    dialect: 'sqlite',
    storage: './data/contracts.db'
  },
  email: {
    host: process.env.SMTP_HOST || 'smtp.ethereal.email',
    port: parseInt(process.env.SMTP_PORT || '587'),
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.EMAIL_FROM || 'e-contract@example.com'
  },
  reminders: {
    beforeExpireHours: [72, 24, 1],
    beforeRenewalDays: [30, 7, 1]
  }
};
