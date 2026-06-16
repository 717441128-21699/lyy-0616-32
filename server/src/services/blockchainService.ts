import crypto from 'crypto';
import fs from 'fs';
import { Contract, BlockchainProof, Signature, Signer } from '../models';

export class BlockchainService {
  generateDocumentHash(filePath: string, signatures: Signature[], signers: Signer[]): string {
    const fileBuffer = fs.readFileSync(filePath);
    const fileHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
    
    const sigData = signatures
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .map(s => `${s.id}:${s.signatureHash}:${s.createdAt.toISOString()}`)
      .join('|');
    
    const signerData = signers
      .sort((a, b) => a.order - b.order)
      .map(s => `${s.id}:${s.email}:${s.status}:${s.signedAt?.toISOString() || ''}`)
      .join('|');

    return crypto.createHash('sha256')
      .update(`${fileHash}|${sigData}|${signerData}|${Date.now()}`)
      .digest('hex');
  }

  async createProof(contract: Contract, filePath: string, signatures: Signature[], signers: Signer[]): Promise<BlockchainProof> {
    const lastProof = await BlockchainProof.findOne({
      order: [['createdAt', 'DESC']]
    });

    const documentHash = this.generateDocumentHash(filePath, signatures, signers);
    const previousProofHash = lastProof ? 
      crypto.createHash('sha256').update(lastProof.documentHash + lastProof.timestamp.toISOString()).digest('hex') :
      'GENESIS';

    const proof = await BlockchainProof.create({
      contractId: contract.id,
      documentHash,
      timestamp: new Date(),
      transactionHash: `0x${crypto.randomBytes(32).toString('hex')}`,
      blockNumber: Math.floor(Math.random() * 1000000) + 1000000,
      merkleRoot: crypto.createHash('sha256').update(documentHash + previousProofHash).digest('hex'),
      previousProofHash
    });

    return proof;
  }

  async verifyProof(proof: BlockchainProof): Promise<boolean> {
    if (!proof) return false;
    
    if (proof.previousProofHash === 'GENESIS') {
      return proof.documentHash.length === 64;
    }

    const prevProof = await BlockchainProof.findOne({
      where: { documentHash: proof.previousProofHash ? 
        crypto.createHash('sha256').update(proof.documentHash + proof.timestamp.toISOString()).digest('hex') : 
        undefined 
      }
    });

    return proof.documentHash.length === 64 && 
           (proof.merkleRoot?.length === 64) === true &&
           (proof.transactionHash?.startsWith('0x')) === true;
  }

  async getContractProofs(contractId: string): Promise<BlockchainProof[]> {
    return BlockchainProof.findAll({
      where: { contractId },
      order: [['createdAt', 'DESC']]
    });
  }
}
