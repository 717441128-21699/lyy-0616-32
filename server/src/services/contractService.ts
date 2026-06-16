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
  User
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

  async createContract(
    creatorId: string,
    title: string,
    description: string | undefined,
    fileBuffer: Buffer,
    fileName: string,
    expireAt?: Date,
    isRenewalEnabled?: boolean,
    renewalDays?: number
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
    return ContractField.create({
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
  }

  async removeField(fieldId: string): Promise<void> {
    await ContractField.destroy({ where: { id: fieldId } });
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

    for (const signer of signers) {
      if (signer.order === 1 || signer.order === undefined) {
        const rawToken = generateSignToken(signer.id, contractId);
        const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');
        await signer.update({ status: 'invited', signToken: hashedToken });
        const tempSigner = { ...signer.toJSON(), signToken: rawToken };
        await this.emailService.sendSignInvite(tempSigner as any, contract);
      }
    }

    return contract.reload();
  }

  async getSignerByToken(token: string): Promise<Signer | null> {
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    return Signer.findOne({
      where: { signToken: hashedToken },
      include: [{ model: Contract, as: 'contract' }]
    });
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
      await nextSigner.update({ status: 'invited', signToken: hashedToken });
      const tempSigner = { ...nextSigner.toJSON(), signToken: rawToken };
      await this.emailService.sendSignInvite(tempSigner as any, contract);
      await contract.update({ status: 'signing' });
    } else {
      const allSigned = allSigners.every(s => s.status === 'signed');
      if (allSigned) {
        const signatures = await Signature.findAll({ where: { contractId } });
        const freshFields = await ContractField.findAll({ where: { contractId } });
        const signedPath = await this.pdfService.mergeSignatures(contract, freshFields, signatures);
        
        await this.blockchainService.createProof(contract, signedPath, signatures, allSigners);
        
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

    if (contract.creator) {
      await this.emailService.sendRejectionNotification(contract, signer, contract.creator.email, contract.creator.name);
    }
    const otherSigners = (contract.signers || []).filter(s => s.id !== signerId);
    for (const s of otherSigners) {
      await this.emailService.sendRejectionNotification(contract, signer, s.email, s.name);
    }

    return contract.reload();
  }

  async getUserContracts(userId: string, status?: string): Promise<Contract[]> {
    const where: any = { creatorId: userId };
    if (status && status !== 'all') where.status = status;

    return Contract.findAll({
      where,
      include: [{ model: Signer, as: 'signers' }],
      order: [['createdAt', 'DESC']]
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

  getBlockchainService(): BlockchainService {
    return this.blockchainService;
  }
}
