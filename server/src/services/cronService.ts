import cron from 'node-cron';
import { ContractService } from './contractService';

export function startCronJobs() {
  const contractService = new ContractService();

  cron.schedule('0 * * * *', async () => {
    console.log('[定时任务] 检查过期合同...');
    try {
      await contractService.processExpiredContracts();
      console.log('[定时任务] 过期合同检查完成');
    } catch (e) {
      console.error('[定时任务] 过期合同处理失败:', e);
    }
  });

  cron.schedule('0 9 * * *', async () => {
    console.log('[定时任务] 发送签署催办提醒...');
    try {
      const count = await contractService.sendSigningReminders();
      console.log(`[定时任务] 已发送 ${count} 条催签提醒`);
    } catch (e) {
      console.error('[定时任务] 催签提醒发送失败:', e);
    }
  });

  cron.schedule('0 10 * * *', async () => {
    console.log('[定时任务] 发送续签提醒...');
    try {
      const count = await contractService.sendRenewalReminders();
      console.log(`[定时任务] 已发送 ${count} 条续签提醒`);
    } catch (e) {
      console.error('[定时任务] 续签提醒发送失败:', e);
    }
  });

  console.log('[定时任务] 所有定时任务已启动');
}
