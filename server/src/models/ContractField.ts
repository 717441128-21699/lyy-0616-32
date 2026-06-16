import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../database';
import { Contract } from './Contract';
import { Signer } from './Signer';

export type FieldType = 'signature' | 'date' | 'text';

export class ContractField extends Model {
  public id!: string;
  public contractId!: string;
  public signerId?: string;
  public type!: FieldType;
  public pageNumber!: number;
  public x!: number;
  public y!: number;
  public width!: number;
  public height!: number;
  public placeholder?: string;
  public value?: string;
  public filledAt?: Date;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

ContractField.init({
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
    allowNull: true,
    references: {
      model: Signer,
      key: 'id'
    }
  },
  type: {
    type: DataTypes.ENUM('signature', 'date', 'text'),
    allowNull: false
  },
  pageNumber: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1
  },
  x: {
    type: DataTypes.FLOAT,
    allowNull: false
  },
  y: {
    type: DataTypes.FLOAT,
    allowNull: false
  },
  width: {
    type: DataTypes.FLOAT,
    allowNull: false
  },
  height: {
    type: DataTypes.FLOAT,
    allowNull: false
  },
  placeholder: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  value: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  filledAt: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  sequelize,
  modelName: 'ContractField',
  tableName: 'contract_fields'
});

ContractField.belongsTo(Contract, { as: 'contract', foreignKey: 'contractId' });
ContractField.belongsTo(Signer, { as: 'signer', foreignKey: 'signerId' });
Contract.hasMany(ContractField, { as: 'fields', foreignKey: 'contractId' });
Signer.hasMany(ContractField, { as: 'fields', foreignKey: 'signerId' });
