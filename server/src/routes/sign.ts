import { Router } from 'express';
import { ContractService } from '../services/contractService';
import { ContractField } from '../models';

const router = Router();
const contractService = new ContractService();

router.get('/:token', async (req, res) => {
  try {
    const signer = await contractService.getSignerByToken(req.params.token);
    if (!signer) {
      return res.status(404).json({ error: '签署链接无效或已过期' });
    }
    const contract = await contractService.getContractDetail(signer.contractId);
    if (!contract) {
      return res.status(404).json({ error: '合同不存在' });
    }
    
    if (contract.expireAt && new Date() > contract.expireAt) {
      return res.status(400).json({ 
        error: '合同已过期，无法继续签署',
        expired: true,
        contract: {
          id: contract.id,
          title: contract.title,
          expireAt: contract.expireAt,
          status: contract.status
        }
      });
    }
    
    const myFields = (contract.fields || []).filter(f => f.signerId === signer.id);
    
    const pdfService = contractService.getPdfService();
    const pdfInfo = await pdfService.getPdfInfo(contract.templatePath);
    
    res.json({
      success: true,
      signer: {
        id: signer.id,
        name: signer.name,
        email: signer.email,
        status: signer.status,
        order: signer.order
      },
      contract: {
        id: contract.id,
        title: contract.title,
        description: contract.description,
        status: contract.status,
        expireAt: contract.expireAt,
        templatePath: contract.templatePath
      },
      myFields,
      allSigners: contract.signers?.map(s => ({
        id: s.id,
        name: s.name,
        status: s.status,
        order: s.order,
        signedAt: s.signedAt
      })),
      pdfInfo: {
        pageCount: pdfInfo.pageCount,
        pages: pdfInfo.pages
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:token/template', async (req, res) => {
  try {
    const signer = await contractService.getSignerByToken(req.params.token);
    if (!signer) {
      return res.status(404).json({ error: '签署链接无效或已过期' });
    }
    const contract = await contractService.getContractDetail(signer.contractId);
    if (!contract) return res.status(404).json({ error: '合同不存在' });
    const pdfService = contractService.getPdfService();
    const buffer = pdfService.readPdf(contract.templatePath);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="contract.pdf"`);
    res.send(buffer);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:token/sign', async (req, res) => {
  try {
    const signer = await contractService.getSignerByToken(req.params.token);
    if (!signer) {
      return res.status(404).json({ error: '签署链接无效或已过期' });
    }
    const { fieldValues } = req.body;
    if (!fieldValues || !Array.isArray(fieldValues)) {
      return res.status(400).json({ error: '请提供签署字段数据' });
    }
    const contract = await contractService.signContract(
      signer.id,
      signer.contractId,
      fieldValues
    );
    res.json({ success: true, contract });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/:token/reject', async (req, res) => {
  try {
    const signer = await contractService.getSignerByToken(req.params.token);
    if (!signer) {
      return res.status(404).json({ error: '签署链接无效或已过期' });
    }
    const { rejectReason } = req.body;
    if (!rejectReason || !rejectReason.trim()) {
      return res.status(400).json({ error: '请填写拒签原因' });
    }
    const contract = await contractService.rejectContract(
      signer.id,
      signer.contractId,
      rejectReason
    );
    res.json({ success: true, contract });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/:token/signed', async (req, res) => {
  try {
    const signer = await contractService.getSignerByToken(req.params.token);
    if (!signer) {
      return res.status(404).json({ error: '签署链接无效或已过期' });
    }
    const contract = await contractService.getContractDetail(signer.contractId);
    if (!contract || !contract.signedPath) {
      return res.status(404).json({ error: '文件不存在或尚未签署完成' });
    }
    if (contract.status !== 'completed') {
      return res.status(400).json({ error: '合同尚未完成签署' });
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

export { router as signRouter };
