import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../services/api';
import { Contract, BlockchainProof } from '../types';

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
  const [contract, setContract] = useState<Contract | null>(null);
  const [proofs, setProofs] = useState<BlockchainProof[]>([]);
  const [loading, setLoading] = useState(true);

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
    } finally {
      setLoading(false);
    }
  };

  const getSignedUrl = () => `/api/contracts/${id}/signed`;

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
              <a
                href={getSignedUrl()}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                下载已签署PDF
              </a>
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
            <div className="space-y-3">
              {contract.signers
                ?.sort((a, b) => a.order - b.order)
                .map((signer, idx) => (
                  <div key={signer.id} className="relative">
                    {idx > 0 && (
                      <div className="absolute left-4 -top-3 w-0.5 h-3 bg-gray-200"></div>
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
                        <div className="flex items-center justify-between">
                          <p className="font-medium text-gray-900 truncate">{signer.name}</p>
                          <span className={`px-2 py-0.5 rounded text-xs font-medium flex-shrink-0 ${signerStatusLabels[signer.status]?.color}`}>
                            {signerStatusLabels[signer.status]?.label}
                          </span>
                        </div>
                        <p className="text-sm text-gray-500 truncate">{signer.email}</p>
                        {signer.signedAt && (
                          <p className="text-xs text-green-600 mt-0.5">
                            {new Date(signer.signedAt).toLocaleString()}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">签名字段统计</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">签名框</span>
                <span className="font-medium">{contract.fields?.filter(f => f.type === 'signature').length || 0} 个</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">日期框</span>
                <span className="font-medium">{contract.fields?.filter(f => f.type === 'date').length || 0} 个</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">文本填写框</span>
                <span className="font-medium">{contract.fields?.filter(f => f.type === 'text').length || 0} 个</span>
              </div>
              <div className="flex justify-between pt-2 border-t">
                <span className="text-gray-500">已填写</span>
                <span className="font-medium text-green-600">
                  {contract.fields?.filter(f => f.filledAt).length || 0} / {contract.fields?.length || 0}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
