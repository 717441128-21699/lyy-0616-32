import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../database';
import { Contract } from './Contract';
import { User } from './User';

export type SignerStatus = 'pending' | 'invited' | 'signing' | 'signed' | 'rejected';

export class Signer extends Model {
  public id!: string;
  public contractId!: string;
  public email!: string;
  public name!: string;
  public order!: number;
  public status!: SignerStatus;
  public signToken!: string;
  public signedAt?: Date;
  public rejectedAt?: Date;
  public rejectReason?: string;
  public userId?: string;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

Signer.init({
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  contractId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: Contract,
      key: 'id'
    }
  },
  email: {
    type: DataTypes.STRING(255),
    allowNull: false,
    validate: {
      isEmail: true
    }
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  order: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1
  },
  status: {
    type: DataTypes.ENUM('pending', 'invited', 'signing', 'signed', 'rejected'),
    defaultValue: 'pending'
  },
  signToken: {
    type: DataTypes.STRING(255),
    allowNull: false,
    unique: true
  },
  signedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  rejectedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  rejectReason: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: User,
      key: 'id'
    }
  }
}, {
  sequelize,
  modelName: 'Signer',
  tableName: 'signers'
});

Signer.belongsTo(Contract, { as: 'contract', foreignKey: 'contractId' });
Contract.hasMany(Signer, { as: 'signers', foreignKey: 'contractId' });
