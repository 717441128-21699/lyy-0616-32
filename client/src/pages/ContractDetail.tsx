import { useState, useEffect } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import api from '../services/api';
import { downloadFile } from '../services/download';
import { useAuthStore } from '../store/authStore';
import { Contract, BlockchainProof, AuditLogEntry } from '../types';

const statusLabels: Record<string, { label: string; color: string }> = {
  draft: { label: '草稿', color: 'bg-gray-100 text-gray-800' },
  pending: { label: '待签署', color: 'bg-yellow-100 text-yellow-800' },
  signing: { label: '签署中', color: 'bg-blue-100 text-blue-800' },
  completed: { label: '已完成', color: 'bg-green-100 text-green-800' },
  rejected: { label: '已拒签', color: 'bg-red-100 text-red-800' },
  expired: { label: '已过期', color: 'bg-gray-300 text-gray-700' },
  archived: { label: '已归档', color: 'bg-purple-100 text-purple-800' }
};

const signerStatusLabels: Record<string, { label: string; color: string }> = {
  pending: { label: '待邀请', color: 'bg-gray-100 text-gray-600' },
  invited: { label: '待签署', color: 'bg-yellow-100 text-yellow-700' },
  signing: { label: '签署中', color: 'bg-blue-100 text-blue-700' },
  signed: { label: '已签署', color: 'bg-green-100 text-green-700' },
  rejected: { label: '已拒签', color: 'bg-red-100 text-red-700' }
};

export default function ContractDetail() {
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const user = useAuthStore((s) => s.user);
  const [contract, setContract] = useState<Contract | null>(null);
  const [proofs, setProofs] = useState<BlockchainProof[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const isCreator = !!contract && !!user && contract.creatorId === user.id;

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/contracts/${id}`);
      setContract(res.data.contract);
      if (res.data.contract.status === 'completed') {
        const proofRes = await api.get(`/contracts/${id}/proofs`);
        setProofs(proofRes.data.proofs);
      }
      try {
        const auditRes = await api.get(`/contracts/${id}/audit-logs`);
        setAuditLogs(auditRes.data.logs || []);
      } catch {
        setAuditLogs([]);
      }
      if (searchParams.get('action') === 'download' && res.data.contract.status === 'completed') {
        searchParams.delete('action');
        setSearchParams(searchParams, { replace: true });
        setTimeout(() => {
          handleDownloadWithId(res.data.contract.id);
        }, 500);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadWithId = async (contractId: string) => {
    try {
      await downloadFile(`/contracts/${contractId}/signed`, `signed_${contractId}.pdf`);
    } catch (err: any) {
      alert(err.response?.data?.error || '下载失败');
    }
  };

  const handleDownload = async () => {
    if (!id) return;
    await handleDownloadWithId(id);
  };

  if (loading) {
    return <div className="text-center py-12 text-gray-500">加载中...</div>;
  }

  if (!contract) {
    return <div className="text-center py-12 text-gray-500">合同不存在</div>;
  }

  return (
    <div>
      <div className="mb-6">
        <Link to="/contracts" className="text-sm text-gray-500 hover:text-gray-700">← 返回合同列表</Link>
        <div className="flex items-start justify-between mt-2">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{contract.title}</h1>
            {contract.description && (
              <p className="text-gray-600 mt-1">{contract.description}</p>
            )}
          </div>
          <div className="flex items-center space-x-3">
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusLabels[contract.status]?.color}`}>
              {statusLabels[contract.status]?.label}
            </span>
            {contract.status === 'draft' && (
              <Link
                to={`/contracts/${contract.id}/edit`}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                编辑模板
              </Link>
            )}
            {contract.status === 'completed' && (
              <button
                onClick={handleDownload}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                下载已签署PDF
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">PDF预览</h2>
            <div className="bg-gray-100 rounded-lg p-4" style={{ maxHeight: '70vh' }}>
              <iframe
                src={`/api/contracts/${contract.id}/template`}
                style={{ width: '100%', height: '600px', border: 'none' }}
                title="Contract PDF"
              />
            </div>
          </div>

          {contract.status === 'completed' && proofs.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
                <span>🔗</span>
                <span>区块链存证信息</span>
              </h2>
              <div className="space-y-3">
                {proofs.map((proof, idx) => (
                  <div key={proof.id} className="bg-blue-50 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-blue-900">存证 #{proofs.length - idx}</span>
                      <span className="text-xs text-blue-700">{new Date(proof.timestamp).toLocaleString()}</span>
                    </div>
                    <div className="space-y-1 text-xs">
                      <div><span className="text-blue-700 font-medium">文档哈希:</span> <code className="bg-white px-1.5 py-0.5 rounded break-all">{proof.documentHash}</code></div>
                      {proof.transactionHash && (
                        <div><span className="text-blue-700 font-medium">交易哈希:</span> <code className="bg-white px-1.5 py-0.5 rounded break-all">{proof.transactionHash}</code></div>
                      )}
                      {proof.blockNumber && (
                        <div><span className="text-blue-700 font-medium">区块号:</span> <code className="bg-white px-1.5 py-0.5 rounded">#{proof.blockNumber}</code></div>
                      )}
                      {proof.merkleRoot && (
                        <div><span className="text-blue-700 font-medium">Merkle Root:</span> <code className="bg-white px-1.5 py-0.5 rounded break-all">{proof.merkleRoot}</code></div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-4">
                * 以上哈希值确保合同文件不可篡改，任何修改都会导致哈希值变化。
              </p>
            </div>
          )}

          {contract.status === 'rejected' && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-6">
              <h2 className="text-lg font-semibold text-red-900 mb-2">❌ 拒签信息</h2>
              {contract.signers?.filter(s => s.status === 'rejected').map(s => (
                <div key={s.id} className="mt-3">
                  <p className="text-sm text-red-800 font-medium">
                    拒签方: {s.name} ({s.email})
                  </p>
                  {s.rejectReason && (
                    <div className="mt-2 bg-white p-3 rounded-lg">
                      <p className="text-sm text-gray-800">{s.rejectReason}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">合同信息</h2>
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-gray-500">创建时间</dt>
                <dd className="text-gray-900 font-medium">{new Date(contract.createdAt).toLocaleString()}</dd>
              </div>
              <div>
                <dt className="text-gray-500">过期时间</dt>
                <dd className="text-gray-900 font-medium">
                  {contract.expireAt ? new Date(contract.expireAt).toLocaleString() : '未设置'}
                </dd>
              </div>
              <div>
                <dt className="text-gray-500">签署完成时间</dt>
                <dd className="text-gray-900 font-medium">
                  {contract.completedAt ? new Date(contract.completedAt).toLocaleString() : '未完成'}
                </dd>
              </div>
              <div>
                <dt className="text-gray-500">续签提醒</dt>
                <dd className="text-gray-900 font-medium">
                  {contract.isRenewalEnabled
                    ? `已启用（有效期 ${contract.renewalDays} 天）`
                    : '未启用'}
                </dd>
              </div>
            </dl>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">签署流程</h2>
            <div className="space-y-4">
              {contract.signers
                ?.sort((a, b) => a.order - b.order)
                .map((signer, idx) => (
                  <div key={signer.id} className="relative pb-2">
                    {idx > 0 && (
                      <div className="absolute left-4 -top-2 w-0.5 h-2 bg-gray-200"></div>
                    )}
                    <div className="flex items-start space-x-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium flex-shrink-0 ${
                        signer.status === 'signed' ? 'bg-green-500' :
                        signer.status === 'rejected' ? 'bg-red-500' :
                        signer.status === 'invited' || signer.status === 'signing' ? 'bg-blue-500' :
                        'bg-gray-300'
                      }`}>
                        {signer.status === 'signed' ? '✓' :
                         signer.status === 'rejected' ? '✕' :
                         signer.order}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <p className="font-medium text-gray-900 truncate">{signer.name}</p>
                            <span className={`px-2 py-0.5 rounded text-xs font-medium flex-shrink-0 ${signerStatusLabels[signer.status]?.color}`}>
                              {signerStatusLabels[signer.status]?.label}
                            </span>
                          </div>
                          {isCreator && contract.status === 'completed' && (
                            <button
                              onClick={async () => {
                                try {
                                  await api.post(`/contracts/${id}/notify`, { signerId: signer.id, type: 'completed' });
                                  alert('完成通知已发送');
                                  loadData();
                                } catch (err: any) {
                                  alert(err.response?.data?.error || '发送失败');
                                }
                              }}
                              className="flex-shrink-0 text-xs px-2 py-1 text-green-700 bg-green-50 hover:bg-green-100 border border-green-200 rounded transition-colors"
                              title="补发完成通知邮件"
                            >
                              📧 通知
                            </button>
                          )}
                          {isCreator && ['pending', 'invited', 'signing'].includes(signer.status) && contract.status !== 'completed' && contract.status !== 'expired' && contract.status !== 'rejected' && (
                            <button
                              onClick={async () => {
                                try {
                                  await api.post(`/contracts/${id}/notify`, { signerId: signer.id, type: 'invite' });
                                  alert('邀请邮件已重新发送');
                                  loadData();
                                } catch (err: any) {
                                  alert(err.response?.data?.error || '发送失败');
                                }
                              }}
                              className="flex-shrink-0 text-xs px-2 py-1 text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded transition-colors"
                              title="重新发送签署邀请"
                            >
                              📧 重发
                            </button>
                          )}
                        </div>
                        <p className="text-sm text-gray-500 truncate">{signer.email}</p>
                        <div className="mt-1 space-y-0.5 text-xs">
                          {signer.invitedAt && (
                            <p className="text-yellow-700">📨 收到邀请: {new Date(signer.invitedAt).toLocaleString()}</p>
                          )}
                          {signer.viewedAt && (
                            <p className="text-blue-700">👁 打开链接: {new Date(signer.viewedAt).toLocaleString()}</p>
                          )}
                          {signer.signedAt && (
                            <p className="text-green-700">✅ 提交签署: {new Date(signer.signedAt).toLocaleString()}</p>
                          )}
                          {signer.rejectedAt && (
                            <p className="text-red-700">❌ 拒签: {new Date(signer.rejectedAt).toLocaleString()}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">签署时间线</h2>
            <div className="relative space-y-4 pl-4">
              <div className="absolute left-[7px] top-1 bottom-1 w-px bg-gray-200"></div>
              {(() => {
                interface TimelineEvent {
                  time: Date;
                  icon: string;
                  color: string;
                  title: string;
                  desc?: string;
                }
                const events: TimelineEvent[] = [];
                events.push({
                  time: new Date(contract.createdAt),
                  icon: '📝',
                  color: 'bg-gray-400',
                  title: '合同创建',
                  desc: contract.creator ? `由 ${contract.creator.name} 创建` : undefined
                });
                contract.signers?.forEach(s => {
                  if (s.invitedAt) {
                    events.push({
                      time: new Date(s.invitedAt),
                      icon: '📨',
                      color: 'bg-yellow-400',
                      title: `${s.name} 收到签署邀请`,
                      desc: s.email
                    });
                  }
                });
                contract.signers?.forEach(s => {
                  if (s.viewedAt) {
                    events.push({
                      time: new Date(s.viewedAt),
                      icon: '👁',
                      color: 'bg-blue-400',
                      title: `${s.name} 打开签署链接`,
                      desc: s.email
                    });
                  }
                });
                contract.signers?.forEach(s => {
                  if (s.rejectedAt) {
                    events.push({
                      time: new Date(s.rejectedAt),
                      icon: '❌',
                      color: 'bg-red-500',
                      title: `${s.name} 拒签`,
                      desc: s.rejectReason || '未填写拒签原因'
                    });
                  }
                });
                contract.signers?.forEach(s => {
                  if (s.signedAt) {
                    events.push({
                      time: new Date(s.signedAt),
                      icon: '✍️',
                      color: 'bg-green-500',
                      title: `${s.name} 完成签署`,
                      desc: s.email
                    });
                  }
                });
                if (contract.status === 'completed' && contract.completedAt) {
                  events.push({
                    time: new Date(contract.completedAt),
                    icon: '🎉',
                    color: 'bg-green-600',
                    title: '所有签署方完成签署',
                    desc: '合同签署流程结束'
                  });
                }
                if (contract.status === 'completed' && proofs.length > 0 && proofs[0].timestamp) {
                  events.push({
                    time: new Date(proofs[0].timestamp),
                    icon: '🔗',
                    color: 'bg-blue-600',
                    title: '生成区块链存证',
                    desc: `文档哈希: ${proofs[0].documentHash.slice(0, 16)}...`
                  });
                }
                if (contract.status === 'expired' && contract.expireAt) {
                  events.push({
                    time: new Date(contract.expireAt),
                    icon: '⏳',
                    color: 'bg-gray-500',
                    title: '合同过期作废',
                    desc: '签署期限已过'
                  });
                }
                events.sort((a, b) => a.time.getTime() - b.time.getTime());
                return events.map((e, i) => (
                  <div key={i} className="relative">
                    <div className={`absolute -left-[21px] top-1 w-3.5 h-3.5 rounded-full border-2 border-white ${e.color} ring-1 ring-gray-200`}></div>
                    <div>
                      <div className="flex items-baseline gap-2">
                        <span className="mr-1">{e.icon}</span>
                        <span className="font-medium text-gray-900 text-sm">{e.title}</span>
                        <span className="text-xs text-gray-400">{e.time.toLocaleString()}</span>
                      </div>
                      {e.desc && (
                        <p className="text-xs text-gray-500 mt-0.5 ml-5">{e.desc}</p>
                      )}
                    </div>
                  </div>
                ));
              })()}
            </div>
          </div>

          {isCreator && auditLogs.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">📋 审计日志</h2>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {auditLogs.map((log) => {
                  const sourceLabel: Record<string, string> = {
                    web: '网页端',
                    email: '邮件',
                    sign_link: '签署链接',
                    system: '系统'
                  };
                  return (
                    <div key={log.id} className="flex items-start gap-3 py-2 border-b border-gray-50 last:border-0">
                      <div className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-gray-400 mt-2"></div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-gray-900">{log.action}</span>
                          <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
                            {sourceLabel[log.source || ''] || log.source || '-'}
                          </span>
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5 space-x-2">
                          {log.actor && <span>{log.actor}</span>}
                          {log.actorEmail && <span>({log.actorEmail})</span>}
                          <span>· {new Date(log.createdAt).toLocaleString()}</span>
                        </div>
                        {log.detail && (
                          <p className="text-xs text-gray-400 mt-0.5 truncate">{log.detail}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
