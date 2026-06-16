import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../database';
import { Contract } from './Contract';
import { User } from './User';

export class AuditLog extends Model {
  public id!: string;
  public contractId!: string;
  public action!: string;
  public actor!: string;
  public actorEmail!: string;
  public detail!: string;
  public source!: string;
  public readonly createdAt!: Date;
}

AuditLog.init({
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
  action: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  actor: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  actorEmail: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  detail: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  source: {
    type: DataTypes.STRING(50),
    allowNull: true
  }
}, {
  sequelize,
  modelName: 'AuditLog',
  tableName: 'audit_logs',
  updatedAt: false
});

AuditLog.belongsTo(Contract, { as: 'contract', foreignKey: 'contractId' });
Contract.hasMany(AuditLog, { as: 'auditLogs', foreignKey: 'contractId' });
