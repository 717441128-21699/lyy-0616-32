import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../database';
import { User } from './User';
import { Signer } from './Signer';
import { ContractField } from './ContractField';
import { Signature } from './Signature';
import { BlockchainProof } from './BlockchainProof';

export type ContractStatus = 'draft' | 'pending' | 'signing' | 'completed' | 'rejected' | 'expired' | 'archived';

export class Contract extends Model {
  public id!: string;
  public title!: string;
  public description?: string;
  public templatePath!: string;
  public signedPath?: string;
  public creatorId!: string;
  public status!: ContractStatus;
  public expireAt?: Date;
  public completedAt?: Date;
  public archivedAt?: Date;
  public isRenewalEnabled!: boolean;
  public renewalDays?: number;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  public creator?: User;
  public signers?: Signer[];
  public fields?: ContractField[];
  public signatures?: Signature[];
  public proofs?: BlockchainProof[];
}

Contract.init({
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  title: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  templatePath: {
    type: DataTypes.STRING(500),
    allowNull: false
  },
  signedPath: {
    type: DataTypes.STRING(500),
    allowNull: true
  },
  creatorId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: User,
      key: 'id'
    }
  },
  status: {
    type: DataTypes.ENUM('draft', 'pending', 'signing', 'completed', 'rejected', 'expired', 'archived'),
    defaultValue: 'draft'
  },
  expireAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  completedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  archivedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  isRenewalEnabled: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  renewalDays: {
    type: DataTypes.INTEGER,
    allowNull: true
  }
}, {
  sequelize,
  modelName: 'Contract',
  tableName: 'contracts'
});

Contract.belongsTo(User, { as: 'creator', foreignKey: 'creatorId' });
