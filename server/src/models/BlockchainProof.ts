import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../database';
import { Contract } from './Contract';

export class BlockchainProof extends Model {
  public id!: string;
  public contractId!: string;
  public documentHash!: string;
  public transactionHash?: string;
  public blockNumber?: number;
  public timestamp!: Date;
  public merkleRoot?: string;
  public previousProofHash?: string;
  public readonly createdAt!: Date;
}

BlockchainProof.init({
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
  documentHash: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  transactionHash: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  blockNumber: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  timestamp: {
    type: DataTypes.DATE,
    allowNull: false
  },
  merkleRoot: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  previousProofHash: {
    type: DataTypes.STRING(255),
    allowNull: true
  }
}, {
  sequelize,
  modelName: 'BlockchainProof',
  tableName: 'blockchain_proofs'
});

BlockchainProof.belongsTo(Contract, { as: 'contract', foreignKey: 'contractId' });
Contract.hasMany(BlockchainProof, { as: 'proofs', foreignKey: 'contractId' });
