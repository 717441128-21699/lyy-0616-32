export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'user';
}

export type ContractStatus = 'draft' | 'pending' | 'signing' | 'completed' | 'rejected' | 'expired' | 'archived';

export type SignerStatus = 'pending' | 'invited' | 'signing' | 'signed' | 'rejected';

export type FieldType = 'signature' | 'date' | 'text';

export interface Contract {
  id: string;
  title: string;
  description?: string;
  templatePath: string;
  signedPath?: string;
  creatorId: string;
  status: ContractStatus;
  expireAt?: string;
  completedAt?: string;
  archivedAt?: string;
  isRenewalEnabled: boolean;
  renewalDays?: number;
  createdAt: string;
  updatedAt: string;
  signers?: Signer[];
  fields?: ContractField[];
  creator?: User;
}

export interface Signer {
  id: string;
  contractId: string;
  email: string;
  name: string;
  order: number;
  status: SignerStatus;
  invitedAt?: string;
  viewedAt?: string;
  signedAt?: string;
  rejectedAt?: string;
  rejectReason?: string;
  rawToken?: string;
}

export interface ContractField {
  id: string;
  contractId: string;
  signerId?: string;
  type: FieldType;
  pageNumber: number;
  x: number;
  y: number;
  width: number;
  height: number;
  placeholder?: string;
  value?: string;
  filledAt?: string;
}

export interface Signature {
  id: string;
  contractId: string;
  signerId: string;
  fieldId?: string;
  imageData?: string;
  type: 'draw' | 'upload' | 'type';
  signatureHash: string;
  createdAt: string;
}

export interface BlockchainProof {
  id: string;
  contractId: string;
  documentHash: string;
  transactionHash?: string;
  blockNumber?: number;
  timestamp: string;
  merkleRoot?: string;
  previousProofHash?: string;
}
