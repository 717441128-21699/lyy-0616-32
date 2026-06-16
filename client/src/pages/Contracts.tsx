import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../services/api';
import { Contract } from '../types';

const statusLabels: Record<string, { label: string; color: string }> = {
  draft: { label: '草稿', color: 'bg-gray-100 text-gray-800' },
  pending: { label: '待签署', color: 'bg-yellow-100 text-yellow-800' },
  signing: { label: '签署中', color: 'bg-blue-100 text-blue-800' },
  completed: { label: '已完成', color: 'bg-green-100 text-green-800' },
  rejected: { label: '已拒签', color: 'bg-red-100 text-red-800' },
  expired: { label: '已过期', color: 'bg-gray-300 text-gray-700' },
  archived: { label: '已归档', color: 'bg-purple-100 text-purple-800' }
};

export default function Contracts() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchParams, setSearchParams] = useSearchParams();
  const [status, setStatus] = useState(searchParams.get('status') || 'all');
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [signerEmail, setSignerEmail] = useState(searchParams.get('signerEmail') || '');
  const [completedFrom, setCompletedFrom] = useState(searchParams.get('completedFrom') || '');
  const [completedTo, setCompletedTo] = useState(searchParams.get('completedTo') || '');
  const [filterOpen, setFilterOpen] = useState(
    !!searchParams.get('search') || !!searchParams.get('signerEmail') ||
    !!searchParams.get('completedFrom') || !!searchParams.get('completedTo')
  );
  const [showNewModal, setShowNewModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newFile, setNewFile] = useState<File | null>(null);
  const [newExpireAt, setNewExpireAt] = useState('');
  const [newRenewal, setNewRenewal] = useState(false);
  const [newRenewalDays, setNewRenewalDays] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const syncParams = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(patch).forEach(([k, v]) => {
      if (v === null || v === '') next.delete(k);
      else next.set(k, v);
    });
    setSearchParams(next, { replace: false });
  };

  const loadContracts = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (status && status !== 'all') params.append('status', status);
      if (search) params.append('search', search);
      if (signerEmail) params.append('signerEmail', signerEmail);
      if (completedFrom) params.append('completedFrom', completedFrom);
      if (completedTo) params.append('completedTo', completedTo);
      const qs = params.toString();
      const res = await api.get(`/contracts${qs ? `?${qs}` : ''}`);
      setContracts(res.data.contracts);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadContracts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, search, signerEmail, completedFrom, completedTo]);

  useEffect(() => {
    syncParams({
      status: status === 'all' ? null : status,
      search: search || null,
      signerEmail: signerEmail || null,
      completedFrom: completedFrom || null,
      completedTo: completedTo || null
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, search, signerEmail, completedFrom, completedTo]);

  const clearFilters = () => {
    setStatus('all');
    setSearch('');
    setSignerEmail('');
    setCompletedFrom('');
    setCompletedTo('');
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFile) return alert('请上传PDF文件');
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('title', newTitle);
      formData.append('description', newDescription);
      formData.append('file', newFile);
      if (newExpireAt) formData.append('expireAt', newExpireAt);
      formData.append('isRenewalEnabled', String(newRenewal));
      if (newRenewalDays) formData.append('renewalDays', newRenewalDays);

      const res = await api.post('/contracts', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      window.location.href = `/contracts/${res.data.contract.id}/edit`;
    } catch (err: any) {
      alert(err.response?.data?.error || '创建失败');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleArchive = async (c: Contract) => {
    if (c.status === 'archived') {
      await api.post(`/contracts/${c.id}/unarchive`);
    } else {
      if (!confirm('确认归档此合同？')) return;
      await api.post(`/contracts/${c.id}/archive`);
    }
    loadContracts();
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">合同管理</h1>
          <p className="text-gray-500 mt-1">管理您发起的所有电子合同</p>
        </div>
        <button
          onClick={() => setShowNewModal(true)}
          className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors flex items-center space-x-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          <span>新建合同</span>
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-4 border-b border-gray-100 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            {['all', 'draft', 'pending', 'signing', 'completed', 'rejected', 'archived'].map((s) => (
              <button
                key={s}
                onClick={() => setStatus(s)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  status === s ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {s === 'all' ? '全部' : statusLabels[s]?.label || s}
              </button>
            ))}
            <div className="flex-1" />
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="搜索合同标题..."
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none w-56"
              />
              <button
                onClick={() => setFilterOpen(!filterOpen)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-1 ${
                  filterOpen ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                </svg>
                高级筛选
              </button>
              {(search || signerEmail || completedFrom || completedTo || status !== 'all') && (
                <button
                  onClick={clearFilters}
                  className="px-3 py-1.5 rounded-md text-sm text-gray-600 hover:bg-gray-100 transition-colors"
                >
                  清除
                </button>
              )}
            </div>
          </div>
          {filterOpen && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-2 border-t border-gray-100">
              <div>
                <label className="block text-xs text-gray-500 mb-1">签署方邮箱</label>
                <input
                  type="text"
                  value={signerEmail}
                  onChange={(e) => setSignerEmail(e.target.value)}
                  placeholder="输入签署方邮箱..."
                  className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">完成时间(起)</label>
                <input
                  type="date"
                  value={completedFrom}
                  onChange={(e) => setCompletedFrom(e.target.value)}
                  className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">完成时间(止)</label>
                <input
                  type="date"
                  value={completedTo}
                  onChange={(e) => setCompletedTo(e.target.value)}
                  className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>
            </div>
          )}
        </div>

        {loading ? (
          <div className="p-12 text-center text-gray-500">加载中...</div>
        ) : contracts.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <div className="text-6xl mb-4">📄</div>
            <p className="text-lg">暂无合同</p>
            <p className="text-sm mt-1">点击"新建合同"开始创建您的第一份电子合同</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">合同名称</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">状态</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">签署方</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">过期时间</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">创建时间</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {contracts.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <Link to={`/contracts/${c.id}`} className="font-medium text-gray-900 hover:text-blue-600">
                        {c.title}
                      </Link>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${statusLabels[c.status]?.color}`}>
                        {statusLabels[c.status]?.label}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {c.signers?.length || 0} 人
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {c.expireAt ? new Date(c.expireAt).toLocaleString() : '-'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {new Date(c.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <Link to={`/contracts/${c.id}`} className="text-blue-600 hover:text-blue-800 text-sm font-medium">
                        查看
                      </Link>
                      {c.status === 'draft' && (
                        <Link to={`/contracts/${c.id}/edit`} className="text-green-600 hover:text-green-800 text-sm font-medium ml-2">
                          编辑
                        </Link>
                      )}
                      <button onClick={() => toggleArchive(c)} className="text-purple-600 hover:text-purple-800 text-sm font-medium ml-2">
                        {c.status === 'archived' ? '取消归档' : '归档'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showNewModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold text-gray-900 mb-6">新建合同</h3>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">合同标题 *</label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  placeholder="请输入合同标题"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">合同描述</label>
                <textarea
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  rows={3}
                  placeholder="请输入合同描述（可选）"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">PDF模板文件 *</label>
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={(e) => setNewFile(e.target.files?.[0] || null)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg file:mr-4 file:py-1.5 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">过期时间</label>
                <input
                  type="datetime-local"
                  value={newExpireAt}
                  onChange={(e) => setNewExpireAt(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="renewal"
                  checked={newRenewal}
                  onChange={(e) => setNewRenewal(e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="renewal" className="text-sm font-medium text-gray-700">启用到期续签提醒</label>
              </div>
              {newRenewal && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">合同有效天数</label>
                  <input
                    type="number"
                    value={newRenewalDays}
                    onChange={(e) => setNewRenewalDays(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    placeholder="例如：365"
                    min="1"
                  />
                </div>
              )}
              <div className="flex justify-end space-x-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setShowNewModal(false)}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg font-medium transition-colors"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-lg transition-colors"
                >
                  {submitting ? '创建中...' : '创建并编辑'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
