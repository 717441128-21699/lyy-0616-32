import nodemailer from 'nodemailer';
import { config } from '../config';
import { Contract, Signer } from '../models';

export class EmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: config.email.host,
      port: config.email.port,
      secure: config.email.port === 465,
      auth: config.email.user ? {
        user: config.email.user,
        pass: config.email.pass
      } : undefined
    });
  }

  private async sendEmail(to: string, subject: string, html: string): Promise<boolean> {
    try {
      if (!config.email.user) {
        console.log(`[模拟邮件] 发送到: ${to}, 主题: ${subject}`);
        console.log(`[邮件内容] ${html}`);
        return true;
      }
      await this.transporter.sendMail({
        from: config.email.from,
        to,
        subject,
        html
      });
      return true;
    } catch (error) {
      console.error('邮件发送失败:', error);
      return false;
    }
  }

  async sendSignInvite(signer: Signer, contract: Contract): Promise<boolean> {
    const signUrl = `${config.frontendUrl}/sign/${signer.signToken}`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">合同签署邀请</h2>
        <p>尊敬的 ${signer.name}：</p>
        <p>您被邀请签署合同：<strong>${contract.title}</strong></p>
        <p>请点击以下链接进入签署页面：</p>
        <p style="margin: 20px 0;">
          <a href="${signUrl}" style="display: inline-block; padding: 12px 24px; background-color: #007bff; color: white; text-decoration: none; border-radius: 4px;">
            立即签署
          </a>
        </p>
        ${contract.expireAt ? `<p style="color: #dc3545;">请在 ${contract.expireAt.toLocaleString()} 前完成签署，过期将自动作废。</p>` : ''}
        <p>如链接无法点击，请复制以下地址到浏览器打开：</p>
        <p style="word-break: break-all; color: #666;">${signUrl}</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
        <p style="font-size: 12px; color: #999;">此邮件由电子合同签署系统自动发送，请勿直接回复。</p>
      </div>
    `;
    return this.sendEmail(signer.email, `合同签署邀请 - ${contract.title}`, html);
  }

  async sendReminder(signer: Signer, contract: Contract, hoursLeft: number): Promise<boolean> {
    const signUrl = `${config.frontendUrl}/sign/${signer.signToken}`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #ffc107;">⏰ 签署催办提醒</h2>
        <p>尊敬的 ${signer.name}：</p>
        <p>合同 <strong>${contract.title}</strong> 还有 <strong>${hoursLeft} 小时</strong> 即将过期。</p>
        <p>请尽快完成签署：</p>
        <p style="margin: 20px 0;">
          <a href="${signUrl}" style="display: inline-block; padding: 12px 24px; background-color: #007bff; color: white; text-decoration: none; border-radius: 4px;">
            前往签署
          </a>
        </p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
        <p style="font-size: 12px; color: #999;">此邮件由电子合同签署系统自动发送，请勿直接回复。</p>
      </div>
    `;
    return this.sendEmail(signer.email, `【催签】合同即将到期 - ${contract.title}`, html);
  }

  async sendCompletedNotification(contract: Contract, recipientEmail: string, recipientName: string): Promise<boolean> {
    const contractUrl = `${config.frontendUrl}/contracts/${contract.id}?action=download`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #28a745;">✅ 合同签署完成</h2>
        <p>尊敬的 ${recipientName}：</p>
        <p>合同 <strong>${contract.title}</strong> 所有签署方均已完成签署。</p>
        <p>您可以登录系统查看合同详情并下载已签署的PDF文件。</p>
        <p style="margin: 20px 0;">
          <a href="${contractUrl}" style="display: inline-block; padding: 12px 24px; background-color: #007bff; color: white; text-decoration: none; border-radius: 4px;">
            查看合同并下载
          </a>
        </p>
        <p style="font-size: 13px; color: #666;">点击上方按钮后，请使用对应邮箱账号登录，即可直接进入合同详情页面下载已签署PDF。</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
        <p style="font-size: 12px; color: #999;">此邮件由电子合同签署系统自动发送，请勿直接回复。</p>
      </div>
    `;
    return this.sendEmail(recipientEmail, `合同签署完成 - ${contract.title}`, html);
  }

  async sendRejectionNotification(contract: Contract, signer: Signer, recipientEmail: string, recipientName: string): Promise<boolean> {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #dc3545;">❌ 合同被拒签</h2>
        <p>尊敬的 ${recipientName}：</p>
        <p>合同 <strong>${contract.title}</strong> 被签署方 <strong>${signer.name}</strong>（${signer.email}）拒签。</p>
        ${signer.rejectReason ? `<p><strong>拒签原因：</strong></p><p style="padding: 10px; background-color: #f8f9fa; border-radius: 4px;">${signer.rejectReason}</p>` : ''}
        <p style="margin: 20px 0;">
          <a href="${config.frontendUrl}" style="display: inline-block; padding: 12px 24px; background-color: #007bff; color: white; text-decoration: none; border-radius: 4px;">
            查看详情
          </a>
        </p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
        <p style="font-size: 12px; color: #999;">此邮件由电子合同签署系统自动发送，请勿直接回复。</p>
      </div>
    `;
    return this.sendEmail(recipientEmail, `合同被拒签 - ${contract.title}`, html);
  }

  async sendRenewalReminder(contract: Contract, daysLeft: number, recipientEmail: string, recipientName: string): Promise<boolean> {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #17a2b8;">📋 合同到期续签提醒</h2>
        <p>尊敬的 ${recipientName}：</p>
        <p>合同 <strong>${contract.title}</strong> 还有 <strong>${daysLeft} 天</strong> 即将到期。</p>
        <p>请及时办理续签手续，避免合同中断。</p>
        <p style="margin: 20px 0;">
          <a href="${config.frontendUrl}" style="display: inline-block; padding: 12px 24px; background-color: #007bff; color: white; text-decoration: none; border-radius: 4px;">
            办理续签
          </a>
        </p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
        <p style="font-size: 12px; color: #999;">此邮件由电子合同签署系统自动发送，请勿直接回复。</p>
      </div>
    `;
    return this.sendEmail(recipientEmail, `【续签提醒】合同即将到期 - ${contract.title}`, html);
  }

  async sendExpiredNotification(contract: Contract, recipientEmail: string, recipientName: string): Promise<boolean> {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #6c757d;">⏳ 合同已过期作废</h2>
        <p>尊敬的 ${recipientName}：</p>
        <p>合同 <strong>${contract.title}</strong> 已超过签署期限，系统已自动作废。</p>
        <p>如需重新发起签署，请登录系统操作。</p>
        <p style="margin: 20px 0;">
          <a href="${config.frontendUrl}" style="display: inline-block; padding: 12px 24px; background-color: #007bff; color: white; text-decoration: none; border-radius: 4px;">
            登录系统
          </a>
        </p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
        <p style="font-size: 12px; color: #999;">此邮件由电子合同签署系统自动发送，请勿直接回复。</p>
      </div>
    `;
    return this.sendEmail(recipientEmail, `合同已过期作废 - ${contract.title}`, html);
  }
}
