import { Router } from 'express';
import path from 'path';
import fs from 'fs';
import { AuthRequest, authMiddleware } from '../middleware/auth';
import { ContractService } from '../services/contractService';
import { config } from '../config';
import { Signer, ContractField } from '../models';

const router = Router();
const contractService = new ContractService();

router.post('/', authMiddleware, async (req: AuthRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: '未登录' });
    if (!req.files || !req.files.file) {
      return res.status(400).json({ error: '请上传PDF文件' });
    }
    const file: any = req.files.file;
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      return res.status(400).json({ error: '只支持PDF文件' });
    }

    const { title, description, expireAt, isRenewalEnabled, renewalDays } = req.body;
    if (!title) {
      return res.status(400).json({ error: '请输入合同标题' });
    }

    const contract = await contractService.createContract(
      req.user.id,
      title,
      description,
      file.data,
      file.name,
      expireAt ? new Date(expireAt) : undefined,
      isRenewalEnabled === 'true',
      renewalDays ? parseInt(renewalDays) : undefined
    );

    res.json({ success: true, contract });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/', authMiddleware, async (req: AuthRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: '未登录' });
    const { status } = req.query;
    const contracts = await contractService.getUserContracts(
      req.user.id,
      status as string
    );
    res.json({ success: true, contracts });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const contract = await contractService.getContractDetail(req.params.id);
    if (!contract) return res.status(404).json({ error: '合同不存在' });
    res.json({ success: true, contract });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id/template-info', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const contract = await contractService.getContractDetail(req.params.id);
    if (!contract) return res.status(404).json({ error: '合同不存在' });
    const pdfService = contractService.getPdfService();
    const info = await pdfService.getPdfInfo(contract.templatePath);
    res.json({ success: true, info });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id/template', async (req, res) => {
  try {
    const contract = await contractService.getContractDetail(req.params.id);
    if (!contract) return res.status(404).json({ error: '合同不存在' });
    const pdfService = contractService.getPdfService();
    const buffer = pdfService.readPdf(contract.templatePath);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="template_${contract.id}.pdf"`);
    res.send(buffer);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id/signed', authMiddleware, async (req: AuthRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: '未登录' });
    const contract = await contractService.getContractDetail(req.params.id);
    if (!contract || !contract.signedPath) return res.status(404).json({ error: '文件不存在' });
    
    const isCreator = contract.creatorId === req.user.id;
    const isSigner = contract.signers?.some(s => s.email === req.user?.email) || false;
    
    if (!isCreator && !isSigner) {
      return res.status(403).json({ error: '您没有权限下载此文件' });
    }
    
    const pdfService = contractService.getPdfService();
    const buffer = pdfService.readPdf(contract.signedPath);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="signed_${contract.id}.pdf"`);
    res.send(buffer);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:id/signers', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { email, name, order } = req.body;
    const signer = await contractService.addSigner(req.params.id, email, name, order || 1);
    res.json({ success: true, signer });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.delete('/signers/:signerId', authMiddleware, async (req, res) => {
  try {
    const signer = await Signer.findByPk(req.params.signerId);
    if (!signer) return res.status(404).json({ error: '签署方不存在' });
    await signer.destroy();
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:id/fields', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { signerId, type, pageNumber, x, y, width, height, placeholder } = req.body;
    const field = await contractService.addField(
      req.params.id,
      signerId,
      type,
      pageNumber,
      x,
      y,
      width,
      height,
      placeholder
    );
    res.json({ success: true, field });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.put('/fields/:fieldId', authMiddleware, async (req, res) => {
  try {
    const { x, y, width, height, pageNumber, signerId } = req.body;
    const field = await contractService.updateField(req.params.fieldId, {
      x, y, width, height, pageNumber, signerId
    });
    res.json({ success: true, field });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.delete('/fields/:fieldId', authMiddleware, async (req, res) => {
  try {
    await contractService.removeField(req.params.fieldId);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:id/launch', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const contract = await contractService.launchContract(req.params.id);
    res.json({ success: true, contract });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/:id/archive', authMiddleware, async (req: AuthRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: '未登录' });
    const contract = await contractService.archiveContract(req.params.id, req.user.id);
    res.json({ success: true, contract });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/:id/unarchive', authMiddleware, async (req: AuthRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: '未登录' });
    const contract = await contractService.unarchiveContract(req.params.id, req.user.id);
    res.json({ success: true, contract });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/:id/proofs', authMiddleware, async (req, res) => {
  try {
    const blockchainService = contractService.getBlockchainService();
    const proofs = await blockchainService.getContractProofs(req.params.id);
    res.json({ success: true, proofs });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export { router as contractRouter };
