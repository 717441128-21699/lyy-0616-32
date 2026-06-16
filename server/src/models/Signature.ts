import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../database';
import { Contract } from './Contract';
import { Signer } from './Signer';

export class Signature extends Model {
  public id!: string;
  public contractId!: string;
  public signerId!: string;
  public fieldId?: string;
  public imagePath?: string;
  public imageData?: string;
  public type!: 'draw' | 'upload' | 'type';
  public signatureHash!: string;
  public readonly createdAt!: Date;
}

Signature.init({
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
  signerId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: Signer,
      key: 'id'
    }
  },
  fieldId: {
    type: DataTypes.UUID,
    allowNull: true
  },
  imagePath: {
    type: DataTypes.STRING(500),
    allowNull: true
  },
  imageData: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  type: {
    type: DataTypes.ENUM('draw', 'upload', 'type'),
    allowNull: false
  },
  signatureHash: {
    type: DataTypes.STRING(255),
    allowNull: false
  }
}, {
  sequelize,
  modelName: 'Signature',
  tableName: 'signatures'
});

Signature.belongsTo(Contract, { as: 'contract', foreignKey: 'contractId' });
Signature.belongsTo(Signer, { as: 'signer', foreignKey: 'signerId' });
