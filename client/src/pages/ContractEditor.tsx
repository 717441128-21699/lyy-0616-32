import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../services/api';
import { Contract, Signer, ContractField, FieldType } from '../types';
import PdfPageViewer from '../components/PdfPageViewer';

const PDF_SCALE = 1.5;

export default function ContractEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [contract, setContract] = useState<Contract | null>(null);
  const [signers, setSigners] = useState<Signer[]>([]);
  const [fields, setFields] = useState<ContractField[]>([]);
  const [selectedField, setSelectedField] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageCount, setPageCount] = useState(1);
  const [pageSize, setPageSize] = useState<{ width: number; height: number }>({ width: 595, height: 842 });
  const [selectedSigner, setSelectedSigner] = useState<string>('');
  const [fieldTool, setFieldTool] = useState<FieldType | null>(null);
  const [loading, setLoading] = useState(true);
  const [newSignerEmail, setNewSignerEmail] = useState('');
  const [newSignerName, setNewSignerName] = useState('');
  const [newSignerOrder, setNewSignerOrder] = useState(1);
  const [pdfContainerRef, setPdfContainerRef] = useState<HTMLDivElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/contracts/${id}`);
      setContract(res.data.contract);
      setSigners(res.data.contract.signers || []);
      setFields(res.data.contract.fields || []);
      const infoRes = await api.get(`/contracts/${id}/template-info`);
      setPageCount(infoRes.data.info.pageCount);
      if (infoRes.data.info.pages.length > 0) {
        setPageSize(infoRes.data.info.pages[0]);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAddSigner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSignerEmail || !newSignerName) return;
    try {
      const res = await api.post(`/contracts/${id}/signers`, {
        email: newSignerEmail,
        name: newSignerName,
        order: newSignerOrder || (signers.length + 1)
      });
      setSigners([...signers, res.data.signer]);
      setNewSignerEmail('');
      setNewSignerName('');
      setNewSignerOrder(signers.length + 2);
    } catch (err: any) {
      alert(err.response?.data?.error || '添加失败');
    }
  };

  const handleRemoveSigner = async (signerId: string) => {
    if (!confirm('确认删除该签署方？')) return;
    await api.delete(`/contracts/signers/${signerId}`);
    setSigners(signers.filter(s => s.id !== signerId));
    setFields(fields.filter(f => f.signerId !== signerId));
  };

  const handlePdfClick = async (e: React.MouseEvent<HTMLDivElement>) => {
    if (!fieldTool || !pdfContainerRef) return;
    if (fieldTool === 'signature' && !selectedSigner) {
      alert('请先选择签署方');
      return;
    }

    const rect = pdfContainerRef.getBoundingClientRect();
    const x = (e.clientX - rect.left) / PDF_SCALE;
    const y = pageSize.height - (e.clientY - rect.top) / PDF_SCALE;
    
    const width = fieldTool === 'signature' ? 120 : fieldTool === 'date' ? 100 : 150;
    const height = fieldTool === 'signature' ? 50 : fieldTool === 'date' ? 30 : 40;

    try {
      const res = await api.post(`/contracts/${id}/fields`, {
        signerId: selectedSigner || undefined,
        type: fieldTool,
        pageNumber: currentPage,
        x: x - width / 2,
        y: y - height / 2,
        width,
        height,
        placeholder: fieldTool === 'text' ? '请填写' : fieldTool === 'date' ? '日期' : undefined
      });
      setFields([...fields, res.data.field]);
    } catch (err: any) {
      alert(err.response?.data?.error || '添加字段失败');
    }
  };

  const handleFieldMouseDown = (e: React.MouseEvent, field: ContractField) => {
    if (!pdfContainerRef) return;
    e.stopPropagation();
    setSelectedField(field.id);
    setIsDragging(true);
    const rect = pdfContainerRef.getBoundingClientRect();
    setDragOffset({
      x: (e.clientX - rect.left) / PDF_SCALE - field.x,
      y: pageSize.height - (e.clientY - rect.top) / PDF_SCALE - field.y
    });
  };

  const handleMouseMove = async (e: React.MouseEvent) => {
    if (!isDragging || !selectedField || !pdfContainerRef) return;
    const rect = pdfContainerRef.getBoundingClientRect();
    const x = (e.clientX - rect.left) / PDF_SCALE - dragOffset.x;
    const y = pageSize.height - (e.clientY - rect.top) / PDF_SCALE - dragOffset.y;
    
    setFields(fields.map(f => 
      f.id === selectedField ? { ...f, x: Math.max(0, x), y: Math.max(0, y) } : f
    ));
  };

  const handleMouseUp = async () => {
    if (!isDragging || !selectedField) {
      setIsDragging(false);
      return;
    }
    const field = fields.find(f => f.id === selectedField);
    if (field) {
      await api.put(`/contracts/fields/${selectedField}`, {
        x: field.x,
        y: field.y,
        width: field.width,
        height: field.height,
        pageNumber: field.pageNumber,
        signerId: field.signerId
      });
    }
    setIsDragging(false);
  };

  const handleRemoveField = async (fieldId: string) => {
    await api.delete(`/contracts/fields/${fieldId}`);
    setFields(fields.filter(f => f.id !== fieldId));
    if (selectedField === fieldId) setSelectedField(null);
  };

  const handleLaunch = async () => {
    if (signers.length === 0) return alert('请至少添加一个签署方');
    if (fields.filter(f => f.type === 'signature').length === 0) return alert('请至少放置一个签名框');
    if (!confirm('确认发起签署？发起后将无法修改合同内容和签署方。')) return;
    try {
      await api.post(`/contracts/${id}/launch`);
      navigate(`/contracts/${id}`);
    } catch (err: any) {
      alert(err.response?.data?.error || '发起失败');
    }
  };

  const currentFields = fields.filter(f => f.pageNumber === currentPage);
  const scaledWidth = pageSize.width * PDF_SCALE;
  const scaledHeight = pageSize.height * PDF_SCALE;

  if (loading) {
    return <div className="text-center py-12 text-gray-500">加载中...</div>;
  }

  if (!contract || contract.status !== 'draft') {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 mb-4">合同状态不允许编辑</p>
        <Link to="/contracts" className="text-blue-600 hover:underline">返回合同列表</Link>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <Link to="/contracts" className="text-sm text-gray-500 hover:text-gray-700">← 返回列表</Link>
          <h1 className="text-2xl font-bold text-gray-900 mt-1">编辑合同模板 - {contract.title}</h1>
          <p className="text-gray-500 mt-1">拖放字段到PDF指定位置，设置签署方和签署顺序</p>
        </div>
        <div className="flex items-center space-x-3">
          <Link to={`/contracts/${id}`} className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg font-medium">
            查看详情
          </Link>
          <button
            onClick={handleLaunch}
            className="px-5 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors"
          >
            发起签署
          </button>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-3 space-y-4">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <h3 className="font-semibold text-gray-900 mb-3">签署方管理</h3>
            <form onSubmit={handleAddSigner} className="space-y-2 mb-4 pb-4 border-b">
              <input
                type="text"
                value={newSignerName}
                onChange={(e) => setNewSignerName(e.target.value)}
                placeholder="姓名"
                className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
              <input
                type="email"
                value={newSignerEmail}
                onChange={(e) => setNewSignerEmail(e.target.value)}
                placeholder="邮箱"
                className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
              <input
                type="number"
                value={newSignerOrder}
                onChange={(e) => setNewSignerOrder(parseInt(e.target.value) || 1)}
                placeholder="签署顺序"
                min="1"
                className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
              <button type="submit" className="w-full py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-md font-medium">
                添加签署方
              </button>
            </form>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {signers.length === 0 && <p className="text-sm text-gray-500">暂无签署方</p>}
              {signers.sort((a, b) => a.order - b.order).map((s) => (
                <div
                  key={s.id}
                  className={`flex items-center justify-between p-2 rounded-md text-sm cursor-pointer ${
                    selectedSigner === s.id ? 'bg-blue-50 ring-2 ring-blue-500' : 'hover:bg-gray-50'
                  }`}
                  onClick={() => setSelectedSigner(s.id)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900 truncate">
                      <span className="text-xs bg-gray-200 text-gray-700 rounded px-1.5 py-0.5 mr-1">{s.order}</span>
                      {s.name}
                    </div>
                    <div className="text-xs text-gray-500 truncate">{s.email}</div>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleRemoveSigner(s.id); }}
                    className="text-red-500 hover:text-red-700 text-xs ml-2"
                  >
                    删除
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <h3 className="font-semibold text-gray-900 mb-3">添加字段</h3>
            <p className="text-xs text-gray-500 mb-3">
              请先从上方列表选择签署方，再选择字段工具，点击PDF放置
            </p>
            <div className="space-y-2">
              <button
                onClick={() => setFieldTool(fieldTool === 'signature' ? null : 'signature')}
                disabled={signers.length === 0 || !selectedSigner}
                className={`w-full py-2 px-3 text-sm rounded-md font-medium flex items-center justify-center space-x-2 transition-colors ${
                  fieldTool === 'signature'
                    ? 'bg-blue-600 text-white'
                    : signers.length === 0 || !selectedSigner
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <span>✍️</span>
                <span>签名框</span>
              </button>
              <button
                onClick={() => setFieldTool(fieldTool === 'date' ? null : 'date')}
                disabled={signers.length === 0 || !selectedSigner}
                className={`w-full py-2 px-3 text-sm rounded-md font-medium flex items-center justify-center space-x-2 transition-colors ${
                  fieldTool === 'date'
                    ? 'bg-blue-600 text-white'
                    : signers.length === 0 || !selectedSigner
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <span>📅</span>
                <span>日期框</span>
              </button>
              <button
                onClick={() => setFieldTool(fieldTool === 'text' ? null : 'text')}
                disabled={signers.length === 0 || !selectedSigner}
                className={`w-full py-2 px-3 text-sm rounded-md font-medium flex items-center justify-center space-x-2 transition-colors ${
                  fieldTool === 'text'
                    ? 'bg-blue-600 text-white'
                    : signers.length === 0 || !selectedSigner
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <span>📝</span>
                <span>文本填写框</span>
              </button>
            </div>
            {selectedSigner && fieldTool && (
              <p className="text-xs text-blue-600 mt-2 text-center">
                当前: 为 {signers.find(s => s.id === selectedSigner)?.name} 添加
                {fieldTool === 'signature' ? '签名' : fieldTool === 'date' ? '日期' : '文本'}字段
              </p>
            )}
            {!selectedSigner && fieldTool && (
              <p className="text-xs text-orange-600 mt-2 text-center">
                请先选择签署方
              </p>
            )}
            {fieldTool && selectedSigner && (
              <p className="text-xs text-green-600 mt-2 text-center">点击PDF放置字段</p>
            )}
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <h3 className="font-semibold text-gray-900 mb-3">已添加字段 ({fields.length})</h3>
            <div className="space-y-1 max-h-48 overflow-y-auto text-sm">
              {fields.length === 0 && <p className="text-gray-500 text-xs">暂无字段</p>}
              {fields.map((f, i) => (
                <div key={f.id} className="flex items-center justify-between py-1">
                  <span className="text-gray-700">
                    {f.type === 'signature' ? '✍️ 签名' : f.type === 'date' ? '📅 日期' : '📝 文本'} #{i + 1}
                    <span className="text-xs text-gray-500 ml-1">
                      ({signers.find(s => s.id === f.signerId)?.name || '未分配'} · P{f.pageNumber})
                    </span>
                  </span>
                  <button
                    onClick={() => handleRemoveField(f.id)}
                    className="text-red-500 hover:text-red-700 text-xs"
                  >
                    删除
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="col-span-9">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1 text-sm border border-gray-300 rounded-md disabled:opacity-50 hover:bg-gray-50"
                >
                  上一页
                </button>
                <span className="text-sm text-gray-700">
                  第 {currentPage} / {pageCount} 页
                </span>
                <button
                  onClick={() => setCurrentPage(Math.min(pageCount, currentPage + 1))}
                  disabled={currentPage === pageCount}
                  className="px-3 py-1 text-sm border border-gray-300 rounded-md disabled:opacity-50 hover:bg-gray-50"
                >
                  下一页
                </button>
              </div>
              <div className="text-sm text-gray-500">
                {fieldTool ? '工具: ' + (fieldTool === 'signature' ? '签名框' : fieldTool === 'date' ? '日期框' : '文本框') : ''}
              </div>
            </div>

            <div className="flex justify-center bg-gray-100 rounded-lg p-4 overflow-auto">
              <div
                ref={setPdfContainerRef}
                className="pdf-container relative cursor-crosshair"
                style={{ width: scaledWidth, height: scaledHeight }}
                onClick={handlePdfClick}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
              >
                <PdfPageViewer
                  pdfUrl={`/api/contracts/${id}/template`}
                  pageNumber={currentPage}
                  scale={PDF_SCALE}
                  className="absolute inset-0 pointer-events-none"
                />
                {currentFields.map((field) => (
                  <div
                    key={field.id}
                    className={`field-overlay ${selectedField === field.id ? 'selected' : ''}`}
                    style={{
                      left: field.x * PDF_SCALE,
                      top: (pageSize.height - field.y - field.height) * PDF_SCALE,
                      width: field.width * PDF_SCALE,
                      height: field.height * PDF_SCALE
                    }}
                    onMouseDown={(e) => handleFieldMouseDown(e, field)}
                    onClick={(e) => { e.stopPropagation(); setSelectedField(field.id); }}
                  >
                    <div className="field-label">
                      {field.type === 'signature' ? '✍️ 签名' : field.type === 'date' ? '📅 日期' : '📝 文本'}
                      {field.type === 'signature' && field.signerId && (
                        ` - ${signers.find(s => s.id === field.signerId)?.name?.slice(0, 4) || ''}`
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
