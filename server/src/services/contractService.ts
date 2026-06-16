import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { Op } from 'sequelize';
import {
  Contract,
  ContractStatus,
  Signer,
  SignerStatus,
  ContractField,
  Signature,
  User,
  AuditLog
} from '../models';
import { generateSignToken } from '../middleware/auth';
import { PdfService } from './pdfService';
import { EmailService } from './emailService';
import { BlockchainService } from './blockchainService';
import { config } from '../config';

export class ContractService {
  private pdfService: PdfService;
  private emailService: EmailService;
  private blockchainService: BlockchainService;

  constructor() {
    this.pdfService = new PdfService(config.uploadDir);
    this.emailService = new EmailService();
    this.blockchainService = new BlockchainService();
  }

  async audit(contractId: string, action: string, actor: string, actorEmail: string, detail?: string, source?: string): Promise<void> {
    await AuditLog.create({ contractId, action, actor, actorEmail, detail: detail || null, source: source || null });
  }

  async getAuditLogs(contractId: string): Promise<AuditLog[]> {
    return AuditLog.findAll({
      where: { contractId },
      order: [['createdAt', 'DESC']]
    });
  }

  async createContract(
    creatorId: string,
    title: string,
    description: string | undefined,
    fileBuffer: Buffer,
    fileName: string,
    expireAt?: Date,
    isRenewalEnabled?: boolean,
    renewalDays?: number,
    creatorEmail?: string,
    creatorName?: string
  ): Promise<Contract> {
    const templatePath = await this.pdfService.saveTemplate(fileBuffer, fileName);
    
    const contract = await Contract.create({
      title,
      description,
      templatePath,
      creatorId,
      status: 'draft',
      expireAt,
      isRenewalEnabled: isRenewalEnabled || false,
      renewalDays
    });

    await this.audit(contract.id, '创建合同', creatorName || creatorId, creatorEmail || '', `标题: ${title}`, 'web');
    return contract;
  }

  async addSigner(
    contractId: string,
    email: string,
    name: string,
    order: number
  ): Promise<Signer> {
    const contract = await Contract.findByPk(contractId);
    if (!contract) {
      throw new Error('合同不存在');
    }
    if (contract.status !== 'draft') {
      throw new Error('合同已发起，无法修改签署方');
    }

    const signToken = generateSignToken(uuidv4(), contractId);
    const hashedToken = crypto.createHash('sha256').update(signToken).digest('hex');

    const signer = await Signer.create({
      contractId,
      email,
      name,
      order,
      status: 'pending',
      signToken: hashedToken
    });

    signer.setDataValue('rawToken', signToken);
    await this.audit(contractId, '添加签署方', '系统', '', `${name} (${email}), 顺序: ${order}`);
    return signer;
  }

  async addField(
    contractId: string,
    signerId: string | undefined,
    type: 'signature' | 'date' | 'text',
    pageNumber: number,
    x: number,
    y: number,
    width: number,
    height: number,
    placeholder?: string
  ): Promise<ContractField> {
    const field = await ContractField.create({
      contractId,
      signerId,
      type,
      pageNumber,
      x,
      y,
      width,
      height,
      placeholder
    });
    await this.audit(contractId, '添加字段', '系统', '', `类型: ${type}, 页码: ${pageNumber}, 签署方: ${signerId || '未分配'}`);
    return field;
  }

  async removeField(fieldId: string): Promise<void> {
    const field = await ContractField.findByPk(fieldId);
    if (!field) throw new Error('字段不存在');
    const contractId = field.contractId;
    await field.destroy();
    await this.audit(contractId, '删除字段', '系统', '', `字段ID: ${fieldId}`);
  }

  async updateField(
    fieldId: string,
    updates: Partial<Pick<ContractField, 'x' | 'y' | 'width' | 'height' | 'pageNumber' | 'signerId'>>
  ): Promise<ContractField> {
    const field = await ContractField.findByPk(fieldId);
    if (!field) throw new Error('字段不存在');
    await field.update(updates);
    return field;
  }

  async launchContract(contractId: string): Promise<Contract> {
    const contract = await Contract.findByPk(contractId, {
      include: [
        { model: Signer, as: 'signers', order: [['order', 'ASC']] },
        { model: ContractField, as: 'fields' }
      ]
    });

    if (!contract) throw new Error('合同不存在');
    if (contract.status !== 'draft') throw new Error('合同已发起');

    const signers = contract.signers || [];
    if (signers.length === 0) throw new Error('请先添加签署方');

    await contract.update({ status: 'pending' });
    await this.audit(contractId, '发起合同', '系统', '', `状态变为待签署`);

    for (const signer of signers) {
      if (signer.order === 1 || signer.order === undefined) {
        const rawToken = generateSignToken(signer.id, contractId);
        const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');
        const now = new Date();
        await signer.update({ status: 'invited', signToken: hashedToken, invitedAt: now });
        const tempSigner = { ...signer.toJSON(), signToken: rawToken };
        await this.emailService.sendSignInvite(tempSigner as any, contract);
        await this.audit(contractId, '发送签署邀请', signer.name, signer.email, `发送给 ${signer.name} (${signer.email})`, 'email');
      }
    }

    return contract.reload();
  }

  async getSignerByToken(token: string): Promise<Signer | null> {
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    const signer = await Signer.findOne({
      where: { signToken: hashedToken },
      include: [{ model: Contract, as: 'contract' }]
    });
    if (signer && (!signer.viewedAt || (signer.status === 'invited'))) {
      await signer.update({ viewedAt: new Date(), status: signer.status === 'invited' ? 'signing' : signer.status });
      signer.viewedAt = signer.viewedAt || new Date();
      await this.audit(signer.contractId, '查看签署链接', signer.name, signer.email, '', 'sign_link');
    }
    return signer;
  }

  async signContract(
    signerId: string,
    contractId: string,
    fieldValues: Array<{ fieldId: string; value?: string; imageData?: string }>
  ): Promise<Contract> {
    const signer = await Signer.findByPk(signerId);
    const contract = await Contract.findByPk(contractId, {
      include: [
        { model: Signer, as: 'signers', order: [['order', 'ASC']] },
        { model: ContractField, as: 'fields' },
        { model: User, as: 'creator' }
      ]
    });

    if (!signer || !contract) throw new Error('签署方或合同不存在');
    if (signer.status !== 'invited' && signer.status !== 'signing') {
      throw new Error('当前状态不允许签署');
    }

    if (contract.expireAt && new Date() > contract.expireAt) {
      throw new Error('合同已过期，无法继续签署');
    }

    const myFields = await ContractField.findAll({
      where: { contractId, signerId: signerId }
    });
    const myFieldIds = new Set(myFields.map(f => f.id));

    for (const fv of fieldValues) {
      const field = await ContractField.findByPk(fv.fieldId);
      if (!field) continue;

      if (field.signerId && field.signerId !== signerId) {
        throw new Error(`字段不属于当前签署方: ${field.type}`);
      }

      if (field.type === 'signature' && fv.imageData) {
        const sigHash = crypto.createHash('sha256').update(fv.imageData + Date.now()).digest('hex');
        await Signature.create({
          contractId,
          signerId,
          fieldId: fv.fieldId,
          imageData: fv.imageData,
          type: fv.imageData.startsWith('data:') ? 'draw' : 'upload',
          signatureHash: sigHash
        });
        await field.update({ filledAt: new Date() });
      } else if (fv.value !== undefined && fv.value !== null) {
        await field.update({ value: fv.value, filledAt: new Date() });
      }
    }

    const unfilledRequired = myFields.filter(f => {
      const filled = fieldValues.find((fv: any) => fv.fieldId === f.id);
      if (!filled) return true;
      if (f.type === 'signature' && !filled.imageData) return true;
      if ((f.type === 'text' || f.type === 'date') && !filled.value?.trim()) return true;
      return false;
    });
    if (unfilledRequired.length > 0) {
      throw new Error(`还有 ${unfilledRequired.length} 个必填字段未填写`);
    }

    await signer.update({ status: 'signed', signedAt: new Date() });
    await this.audit(contractId, '提交签署', signer.name, signer.email, `签署方 ${signer.name} 完成签署`, 'sign_link');

    const freshSigners = await Signer.findAll({
      where: { contractId },
      order: [['order', 'ASC']]
    });
    const allSigners = freshSigners;
    const currentOrder = signer.order;
    const nextSigner = allSigners.find(s => s.order === currentOrder + 1);

    if (nextSigner) {
      const rawToken = generateSignToken(nextSigner.id, contractId);
      const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');
      const now = new Date();
      await nextSigner.update({ status: 'invited', signToken: hashedToken, invitedAt: now });
      const tempSigner = { ...nextSigner.toJSON(), signToken: rawToken };
      await this.emailService.sendSignInvite(tempSigner as any, contract);
      await this.audit(contractId, '发送签署邀请', nextSigner.name, nextSigner.email, `顺序签署: 发送给 ${nextSigner.name}`, 'email');
      await contract.update({ status: 'signing' });
    } else {
      const allSigned = allSigners.every(s => s.status === 'signed');
      if (allSigned) {
        const signatures = await Signature.findAll({ where: { contractId } });
        const freshFields = await ContractField.findAll({ where: { contractId } });
        const signedPath = await this.pdfService.mergeSignatures(contract, freshFields, signatures);
        
        const proof = await this.blockchainService.createProof(contract, signedPath, signatures, allSigners);
        await this.audit(contractId, '生成存证', '系统', '', `文档哈希: ${proof.documentHash.slice(0, 16)}...`, 'system');
        
        await contract.update({ status: 'completed', signedPath, completedAt: new Date() });

        if (contract.creator) {
          await this.emailService.sendCompletedNotification(contract, contract.creator.email, contract.creator.name);
        }
        for (const s of allSigners) {
          await this.emailService.sendCompletedNotification(contract, s.email, s.name);
        }
      }
    }

    return Contract.findByPk(contractId, {
      include: [
        { model: Signer, as: 'signers', order: [['order', 'ASC']] },
        { model: ContractField, as: 'fields' },
        { model: Signature, as: 'signatures' },
        { model: User, as: 'creator' }
      ]
    }) as Promise<Contract>;
  }

  async rejectContract(signerId: string, contractId: string, rejectReason: string): Promise<Contract> {
    const signer = await Signer.findByPk(signerId);
    const contract = await Contract.findByPk(contractId, {
      include: [
        { model: Signer, as: 'signers' },
        { model: User, as: 'creator' }
      ]
    });

    if (!signer || !contract) throw new Error('签署方或合同不存在');
    if (!rejectReason.trim()) throw new Error('请填写拒签原因');

    await signer.update({
      status: 'rejected',
      rejectedAt: new Date(),
      rejectReason
    });

    await contract.update({ status: 'rejected' });
    await this.audit(contractId, '拒签', signer.name, signer.email, `原因: ${rejectReason || '未填写'}`, 'sign_link');

    if (contract.creator) {
      await this.emailService.sendRejectionNotification(contract, signer, contract.creator.email, contract.creator.name);
    }
    const otherSigners = (contract.signers || []).filter(s => s.id !== signerId);
    for (const s of otherSigners) {
      await this.emailService.sendRejectionNotification(contract, signer, s.email, s.name);
    }

    return contract.reload();
  }

  async getUserContracts(
    userId: string,
    status?: string,
    search?: string,
    signerEmail?: string,
    completedFrom?: string,
    completedTo?: string
  ): Promise<Contract[]> {
    const where: any = {
      [Op.or]: [
        { creatorId: userId },
        { '$signers.email$': (await User.findByPk(userId))?.email || '___no_match___' }
      ]
    };
    const include: any[] = [{ model: Signer, as: 'signers' }];

    if (status && status !== 'all') {
      where.status = status;
    }
    if (search) {
      where.title = { [Op.like]: `%${search}%` };
    }
    if (signerEmail) {
      include[0].where = { email: { [Op.like]: `%${signerEmail}%` } };
    }
    if (completedFrom || completedTo) {
      where.completedAt = {} as any;
      if (completedFrom) {
        where.completedAt[Op.gte] = new Date(completedFrom);
      }
      if (completedTo) {
        const toDate = new Date(completedTo);
        toDate.setHours(23, 59, 59, 999);
        where.completedAt[Op.lte] = toDate;
      }
    }
    // 如果没有completedAt条件删除该属性，避免影响其他查询
    if (where.completedAt && Object.keys(where.completedAt).length === 0) {
      delete where.completedAt;
    }

    return Contract.findAll({
      where,
      include,
      order: [['createdAt', 'DESC']],
      subQuery: false
    });
  }

  async getContractDetail(contractId: string): Promise<Contract | null> {
    return Contract.findByPk(contractId, {
      include: [
        { model: Signer, as: 'signers', order: [['order', 'ASC']] },
        { model: ContractField, as: 'fields' },
        { model: Signature, as: 'signatures' },
        { model: User, as: 'creator' }
      ]
    });
  }

  async archiveContract(contractId: string, userId: string): Promise<Contract> {
    const contract = await Contract.findByPk(contractId);
    if (!contract) throw new Error('合同不存在');
    if (contract.creatorId !== userId) throw new Error('无权限操作');
    await contract.update({ status: 'archived', archivedAt: new Date() });
    return contract;
  }

  async unarchiveContract(contractId: string, userId: string): Promise<Contract> {
    const contract = await Contract.findByPk(contractId);
    if (!contract) throw new Error('合同不存在');
    if (contract.creatorId !== userId) throw new Error('无权限操作');
    const wasCompleted = contract.completedAt;
    await contract.update({ status: wasCompleted ? 'completed' : 'pending', archivedAt: null });
    return contract;
  }

  async processExpiredContracts(): Promise<void> {
    const now = new Date();
    const expired = await Contract.findAll({
      where: {
        status: { [Op.in]: ['pending', 'signing'] },
        expireAt: { [Op.lt]: now }
      },
      include: [
        { model: Signer, as: 'signers' },
        { model: User, as: 'creator' }
      ]
    });

    for (const contract of expired) {
      await contract.update({ status: 'expired' });
      if (contract.creator) {
        await this.emailService.sendExpiredNotification(contract, contract.creator.email, contract.creator.name);
      }
      for (const signer of contract.signers || []) {
        await this.emailService.sendExpiredNotification(contract, signer.email, signer.name);
      }
    }
  }

  async sendSigningReminders(): Promise<number> {
    const now = new Date();
    let count = 0;
    for (const hours of config.reminders.beforeExpireHours) {
      const checkTime = new Date(now.getTime() + hours * 60 * 60 * 1000);
      const nextCheckTime = new Date(checkTime.getTime() + 60 * 60 * 1000);

      const contracts = await Contract.findAll({
        where: {
          status: { [Op.in]: ['pending', 'signing'] },
          expireAt: { [Op.between]: [checkTime, nextCheckTime] }
        },
        include: [{ model: Signer, as: 'signers', where: { status: { [Op.in]: ['pending', 'invited', 'signing'] } } }]
      });

      for (const contract of contracts) {
        for (const signer of contract.signers || []) {
          const rawToken = generateSignToken(signer.id, contract.id);
          const tempSigner = { ...signer.toJSON(), signToken: rawToken };
          await this.emailService.sendReminder(tempSigner as any, contract, hours);
          count++;
        }
      }
    }
    return count;
  }

  async sendRenewalReminders(): Promise<number> {
    const now = new Date();
    let count = 0;

    for (const days of config.reminders.beforeRenewalDays) {
      const checkDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
      const nextCheckDate = new Date(checkDate.getTime() + 24 * 60 * 60 * 1000);

      const contracts = await Contract.findAll({
        where: {
          status: 'completed',
          isRenewalEnabled: true,
          completedAt: {
            [Op.and]: [
              { [Op.not]: null },
            ]
          }
        },
        include: [
          { model: User, as: 'creator' },
          { model: Signer, as: 'signers' }
        ]
      });

      for (const contract of contracts) {
        if (!contract.completedAt || !contract.renewalDays) continue;
        const expiryDate = new Date(contract.completedAt.getTime() + contract.renewalDays * 24 * 60 * 60 * 1000);
        if (expiryDate >= checkDate && expiryDate < nextCheckDate) {
          if (contract.creator) {
            await this.emailService.sendRenewalReminder(contract, days, contract.creator.email, contract.creator.name);
            count++;
          }
          for (const signer of contract.signers || []) {
            await this.emailService.sendRenewalReminder(contract, days, signer.email, signer.name);
            count++;
          }
        }
      }
    }
    return count;
  }

  getPdfService(): PdfService {
    return this.pdfService;
  }

  async resendNotification(contractId: string, signerId: string, type: 'invite' | 'completed'): Promise<boolean> {
    const contract = await Contract.findByPk(contractId, {
      include: [
        { model: Signer, as: 'signers' },
        { model: User, as: 'creator' }
      ]
    });
    if (!contract) throw new Error('合同不存在');
    const signer = contract.signers?.find((s: any) => s.id === signerId) as Signer | undefined;
    if (!signer) throw new Error('签署方不存在');

    if (type === 'invite') {
      if (signer.status === 'signed' || signer.status === 'rejected') {
        throw new Error('该签署方已完成签署，无法重新发送邀请');
      }
      if (!signer.signToken) {
        const rawToken = generateSignToken(signer.id, contractId);
        const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');
        await signer.update({ signToken: hashedToken, status: signer.status === 'pending' ? 'invited' : signer.status, invitedAt: signer.invitedAt || new Date() });
        (signer as any).signToken = rawToken;
      }
      await this.emailService.sendSignInvite(signer as any, contract);
      await this.audit(contractId, '重发签署邀请', '发起方', '', `发送给 ${signer.name} (${signer.email})`, 'web');
      return true;
    } else if (type === 'completed') {
      if (contract.status !== 'completed') {
        throw new Error('合同尚未完成签署，无法发送完成通知');
      }
      await this.emailService.sendCompletedNotification(contract, signer.email, signer.name);
      await this.audit(contractId, '补发完成通知', '发起方', '', `发送给 ${signer.name} (${signer.email})`, 'web');
      return true;
    }
    return false;
  }

  getBlockchainService(): BlockchainService {
    return this.blockchainService;
  }
}
