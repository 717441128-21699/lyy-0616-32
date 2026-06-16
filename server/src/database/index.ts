import { Sequelize } from 'sequelize';
import { config } from '../config';

export const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: config.database.storage,
  logging: false
});

export async function initDatabase() {
  try {
    await sequelize.authenticate();
    await sequelize.sync({ alter: true });
    console.log('数据库连接成功');
  } catch (error) {
    console.error('数据库连接失败:', error);
    throw error;
  }
}
