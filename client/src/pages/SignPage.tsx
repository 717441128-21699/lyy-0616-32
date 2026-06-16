import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import SignatureCanvas from 'react-signature-canvas';
import api from '../services/api';
import { ContractField, Signer, SignerStatus } from '../types';

const PDF_SCALE = 1.5;

interface SignInfo {
  signer: {
    id: string;
    name: string;
    email: string;
    status: SignerStatus;
    order: number;
  };
  contract: {
    id: string;
    title: string;
    description?: string;
    status: string;
    expireAt?: string;
  };
  myFields: ContractField[];
  allSigners: Array<{ id: string; name: string; status: SignerStatus; order: number; signedAt?: string }>;
}

export default function SignPage() {
  const { token } = useParams<{ token: string }>();
  const [signInfo, setSignInfo] = useState<SignInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pageSize, setPageSize] = useState({ width: 595, height: 842 });
  const [currentPage, setCurrentPage] = useState(1);
  const [pageCount, setPageCount] = useState(1);

  const [fieldValues, setFieldValues] = useState<Record<string, { value?: string; imageData?: string }>>({});
  const [activeField, setActiveField] = useState<ContractField | null>(null);
  const [showSigModal, setShowSigModal] = useState(false);
  const [sigMode, setSigMode] = useState<'draw' | 'upload' | 'type'>('draw');
  const [typedSignature, setTypedSignature] = useState('');

  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [completed, setCompleted] = useState(false);

  const sigCanvasRef = useRef<SignatureCanvas>(null);

  useEffect(() => {
    loadData();
  }, [token]);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/sign/${token}`);
      setSignInfo(res.data);

      const pdfDoc = document.createElement('iframe');
      pdfDoc.src = `/api/sign/${token}/template`;
      pdfDoc.style.display = 'none';
      document.body.appendChild(pdfDoc);

      setTimeout(() => {
        setPageSize({ width: 595, height: 842 });
        setPageCount(1);
        const myFields = res.data.myFields as ContractField[];
        if (myFields.length > 0) {
          setCurrentPage(myFields[0].pageNumber);
          const initial: Record<string, { value?: string; imageData?: string }> = {};
          myFields.forEach(f => {
            if (f.type === 'date') {
              initial[f.id] = { value: new Date().toLocaleDateString('zh-CN') };
            } else if (f.type === 'text') {
              initial[f.id] = { value: '' };
            }
          });
          setFieldValues(initial);
        }
        document.body.removeChild(pdfDoc);
      }, 500);
    } catch (err: any) {
      setError(err.response?.data?.error || '加载失败');
    } finally {
      setLoading(false);
    }
  };

  const handleFieldClick = (field: ContractField) => {
    if (!signInfo || signInfo.signer.status === 'signed' || signInfo.signer.status === 'rejected') return;
    if (field.type === 'signature') {
      setActiveField(field);
      setShowSigModal(true);
      setSigMode('draw');
      setTypedSignature(signInfo.signer.name);
    }
  };

  const handleTextFieldChange = (fieldId: string, value: string) => {
    setFieldValues({ ...fieldValues, [fieldId]: { value } });
  };

  const handleClearSignature = () => {
    sigCanvasRef.current?.clear();
  };

  const handleUploadSignature = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeField) return;
    const reader = new FileReader();
    reader.onload = () => {
      setFieldValues({
        ...fieldValues,
        [activeField.id]: { imageData: reader.result as string }
      });
      setShowSigModal(false);
    };
    reader.readAsDataURL(file);
  };

  const handleConfirmDrawSignature = () => {
    if (!activeField || !sigCanvasRef.current) return;
    if (sigCanvasRef.current.isEmpty()) {
      alert('请先手写签名');
      return;
    }
    const dataUrl = sigCanvasRef.current.toDataURL('image/png');
    setFieldValues({
      ...fieldValues,
      [activeField.id]: { imageData: dataUrl }
    });
    setShowSigModal(false);
  };

  const handleConfirmTypeSignature = () => {
    if (!activeField || !typedSignature.trim()) return;
    const canvas = document.createElement('canvas');
    canvas.width = 400;
    canvas.height = 120;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.font = 'bold 48px "Brush Script MT", "Comic Sans MS", cursive';
      ctx.fillStyle = '#000';
      ctx.fillText(typedSignature, 20, 75);
    }
    const dataUrl = canvas.toDataURL('image/png');
    setFieldValues({
      ...fieldValues,
      [activeField.id]: { imageData: dataUrl }
    });
    setShowSigModal(false);
  };

  const handleSubmit = async () => {
    if (!signInfo) return;
    const myFields = signInfo.myFields;
    const missing = myFields.filter(f => {
      if (f.type === 'signature' && !fieldValues[f.id]?.imageData) return true;
      if (f.type === 'text' && !fieldValues[f.id]?.value?.trim()) return true;
      return false;
    });
    if (missing.length > 0) {
      alert(`请完成所有必填字段（剩余 ${missing.length} 个）`);
      return;
    }
    if (!confirm('确认提交签署？提交后将无法修改。')) return;

    setSubmitting(true);
    try {
      const values = Object.entries(fieldValues).map(([fieldId, v]) => ({
        fieldId,
        value: v.value,
        imageData: v.imageData
      }));
      await api.post(`/sign/${token}/sign`, { fieldValues: values });
      setCompleted(true);
    } catch (err: any) {
      alert(err.response?.data?.error || '签署失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) {
      alert('请填写拒签原因');
      return;
    }
    if (!confirm('确认拒签？')) return;
    setSubmitting(true);
    try {
      await api.post(`/sign/${token}/reject`, { rejectReason });
      setCompleted(true);
    } catch (err: any) {
      alert(err.response?.data?.error || '操作失败');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-gray-500">加载中...</div>;
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md text-center">
          <div className="text-6xl mb-4">⚠️</div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">链接无效</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <a href="/login" className="text-blue-600 hover:underline">返回登录</a>
        </div>
      </div>
    );
  }

  if (!signInfo) return null;

  const myFields = signInfo.myFields;
  const currentFields = myFields.filter(f => f.pageNumber === currentPage);
  const allFieldsSigned = myFields.every(f => {
    if (f.type === 'signature') return !!fieldValues[f.id]?.imageData;
    if (f.type === 'text') return !!fieldValues[f.id]?.value?.trim();
    return true;
  });
  const scaledWidth = pageSize.width * PDF_SCALE;
  const scaledHeight = pageSize.height * PDF_SCALE;

  if (completed) {
    const wasRejected = showRejectModal;
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
        <div className="bg-white rounded-2xl shadow-xl p-10 max-w-md text-center">
          <div className="text-7xl mb-6">
            {wasRejected ? '❌' : '✅'}
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            {wasRejected ? '已拒签' : '签署成功'}
          </h2>
          <p className="text-gray-600 mb-8">
            {wasRejected
              ? '您已拒签该合同，合同发起方将收到通知。'
              : '您已成功完成签署，我们会通知其他签署方继续签署。'}
          </p>
          <p className="text-sm text-gray-500">
            合同名称: <span className="font-medium text-gray-700">{signInfo.contract.title}</span>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center mr-3">
              <span className="text-white font-bold">E</span>
            </div>
            <span className="text-xl font-bold text-gray-900">电子合同签署</span>
          </div>
          <div className="text-sm text-gray-600">
            签署方: <span className="font-medium text-gray-900">{signInfo.signer.name}</span> ({signInfo.signer.email})
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-8">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h1 className="text-xl font-bold text-gray-900 mb-2">{signInfo.contract.title}</h1>
              {signInfo.contract.description && (
                <p className="text-gray-600 mb-4">{signInfo.contract.description}</p>
              )}
              {signInfo.contract.expireAt && (
                <p className="text-sm text-orange-600 mb-4">
                  ⏰ 请在 {new Date(signInfo.contract.expireAt).toLocaleString()} 前完成签署
                </p>
              )}

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
                <div className="text-sm text-blue-600">
                  待填写字段: {myFields.filter(f => {
                    if (f.type === 'signature') return !fieldValues[f.id]?.imageData;
                    if (f.type === 'text') return !fieldValues[f.id]?.value?.trim();
                    return true;
                  }).length} / {myFields.length}
                </div>
              </div>

              <div className="flex justify-center bg-gray-100 rounded-lg p-4 overflow-auto">
                <div
                  className="pdf-container relative"
                  style={{ width: scaledWidth, height: scaledHeight }}
                >
                  <iframe
                    src={`/api/sign/${token}/template`}
                    style={{ width: scaledWidth, height: scaledHeight, border: 'none', pointerEvents: 'none' }}
                    title="Contract PDF"
                  />
                  {currentFields.map((field) => {
                    const isFilled = field.type === 'signature'
                      ? !!fieldValues[field.id]?.imageData
                      : !!fieldValues[field.id]?.value?.trim();
                    return (
                      <div key={field.id} className="absolute group">
                        {field.type === 'signature' ? (
                          <div
                            className={`field-overlay ${isFilled ? 'border-green-500 bg-green-50' : ''} ${
                              signInfo.signer.status === 'signed' || signInfo.signer.status === 'rejected'
                                ? 'pointer-events-none'
                                : 'cursor-pointer hover:bg-blue-100'
                            }`}
                            style={{
                              left: field.x * PDF_SCALE,
                              top: (pageSize.height - field.y - field.height) * PDF_SCALE,
                              width: field.width * PDF_SCALE,
                              height: field.height * PDF_SCALE
                            }}
                            onClick={() => handleFieldClick(field)}
                          >
                            {fieldValues[field.id]?.imageData && (
                              <img
                                src={fieldValues[field.id].imageData}
                                alt="签名"
                                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                              />
                            )}
                            {!fieldValues[field.id]?.imageData && (
                              <div className="w-full h-full flex items-center justify-center text-xs text-blue-600">
                                点击签名
                              </div>
                            )}
                          </div>
                        ) : (
                          <div
                            style={{
                              position: 'absolute',
                              left: field.x * PDF_SCALE,
                              top: (pageSize.height - field.y - field.height) * PDF_SCALE,
                              width: field.width * PDF_SCALE,
                              height: field.height * PDF_SCALE
                            }}
                          >
                            <input
                              type="text"
                              value={fieldValues[field.id]?.value || ''}
                              onChange={(e) => handleTextFieldChange(field.id, e.target.value)}
                              placeholder={field.placeholder || (field.type === 'date' ? '日期' : '请填写')}
                              disabled={signInfo.signer.status === 'signed' || signInfo.signer.status === 'rejected'}
                              className={`w-full h-full px-2 text-sm border-2 border-dashed rounded outline-none bg-white/80 ${
                                isFilled ? 'border-green-500 bg-green-50' : 'border-blue-400 focus:border-blue-600'
                              } ${
                                signInfo.signer.status === 'signed' || signInfo.signer.status === 'rejected'
                                  ? 'pointer-events-none bg-gray-100'
                                  : ''
                              }`}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          <div className="col-span-4 space-y-4">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="font-semibold text-gray-900 mb-4">签署流程</h3>
              <div className="space-y-3">
                {signInfo.allSigners
                  .sort((a, b) => a.order - b.order)
                  .map((s, idx) => (
                    <div key={s.id} className="relative">
                      {idx > 0 && (
                        <div className="absolute left-4 -top-3 w-0.5 h-3 bg-gray-200"></div>
                      )}
                      <div className="flex items-start space-x-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium flex-shrink-0 ${
                          s.status === 'signed' ? 'bg-green-500' :
                          s.status === 'rejected' ? 'bg-red-500' :
                          s.id === signInfo.signer.id ? 'bg-blue-500' :
                          'bg-gray-300'
                        }`}>
                          {s.status === 'signed' ? '✓' :
                           s.status === 'rejected' ? '✕' :
                           s.order}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <p className={`font-medium truncate ${
                              s.id === signInfo.signer.id ? 'text-blue-600' : 'text-gray-900'
                            }`}>
                              {s.name}
                              {s.id === signInfo.signer.id && <span className="ml-1 text-xs">(您)</span>}
                            </p>
                          </div>
                          <p className="text-xs text-gray-500">
                            {s.status === 'signed' ? `已签署 ${s.signedAt ? new Date(s.signedAt).toLocaleDateString() : ''}` :
                             s.status === 'rejected' ? '已拒签' :
                             s.status === 'invited' ? '待签署' : '等待中'}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="font-semibold text-gray-900 mb-4">待填写字段</h3>
              <div className="space-y-2">
                {myFields.length === 0 && <p className="text-sm text-gray-500">暂无需要填写的字段</p>}
                {myFields.map((f, i) => {
                  const isFilled = f.type === 'signature'
                    ? !!fieldValues[f.id]?.imageData
                    : !!fieldValues[f.id]?.value?.trim();
                  return (
                    <div
                      key={f.id}
                      onClick={() => {
                        setCurrentPage(f.pageNumber);
                        if (f.type === 'signature') handleFieldClick(f);
                      }}
                      className={`flex items-center justify-between p-2 rounded-md text-sm cursor-pointer ${
                        isFilled ? 'bg-green-50' : 'bg-gray-50 hover:bg-gray-100'
                      }`}
                    >
                      <span>
                        {f.type === 'signature' ? '✍️' : f.type === 'date' ? '📅' : '📝'}
                        {' '}
                        {f.type === 'signature' ? '签名' : f.type === 'date' ? '日期' : '文本'} #{i + 1}
                        <span className="text-xs text-gray-500 ml-2">P{f.pageNumber}</span>
                      </span>
                      <span className={`text-xs ${isFilled ? 'text-green-600' : 'text-gray-400'}`}>
                        {isFilled ? '✓ 已完成' : '待填写'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              {signInfo.signer.status === 'signed' ? (
                <div className="text-center py-4">
                  <div className="text-4xl mb-2">✅</div>
                  <p className="text-green-600 font-medium">您已完成签署</p>
                </div>
              ) : signInfo.signer.status === 'rejected' ? (
                <div className="text-center py-4">
                  <div className="text-4xl mb-2">❌</div>
                  <p className="text-red-600 font-medium">您已拒签此合同</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <button
                    onClick={handleSubmit}
                    disabled={!allFieldsSigned || submitting}
                    className="w-full py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white font-medium rounded-lg transition-colors"
                  >
                    {submitting ? '提交中...' : '✓ 确认签署'}
                  </button>
                  <button
                    onClick={() => setShowRejectModal(true)}
                    disabled={submitting}
                    className="w-full py-2.5 bg-white border border-red-300 text-red-600 hover:bg-red-50 disabled:opacity-50 font-medium rounded-lg transition-colors"
                  >
                    ✕ 拒签
                  </button>
                </div>
              )}
              <div className="mt-4 text-xs text-gray-500 text-center">
                点击签署即表示您已阅读并同意合同内容
              </div>
            </div>
          </div>
        </div>
      </div>

      {showSigModal && activeField && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4">添加签名</h3>

            <div className="flex space-x-2 mb-4">
              {(['draw', 'upload', 'type'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setSigMode(mode)}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    sigMode === mode ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {mode === 'draw' ? '✍️ 手写签名' : mode === 'upload' ? '📤 上传图片' : '📝 键入签名'}
                </button>
              ))}
            </div>

            {sigMode === 'draw' && (
              <div className="space-y-3">
                <p className="text-sm text-gray-600">请在下方区域手写您的签名</p>
                <div className="border-2 border-gray-200 rounded-xl bg-white p-2">
                  <SignatureCanvas
                    ref={sigCanvasRef}
                    penColor="black"
                    canvasProps={{
                      className: 'signature-canvas w-full',
                      style: { width: '100%', height: '200px' }
                    }}
                  />
                </div>
                <button
                  onClick={handleClearSignature}
                  className="text-sm text-gray-600 hover:text-gray-800"
                >
                  清除重签
                </button>
              </div>
            )}

            {sigMode === 'upload' && (
              <div className="space-y-3">
                <p className="text-sm text-gray-600">请上传您的签名图片（PNG/JPG格式）</p>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/jpg"
                  onChange={handleUploadSignature}
                  className="w-full px-3 py-3 border-2 border-dashed border-gray-300 rounded-lg file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
                {fieldValues[activeField.id]?.imageData && (
                  <div className="border rounded-lg p-4 bg-gray-50">
                    <p className="text-sm text-gray-600 mb-2">预览：</p>
                    <img
                      src={fieldValues[activeField.id].imageData}
                      alt="签名预览"
                      style={{ maxHeight: '100px', maxWidth: '100%' }}
                    />
                  </div>
                )}
              </div>
            )}

            {sigMode === 'type' && (
              <div className="space-y-3">
                <p className="text-sm text-gray-600">请输入您的签名文字</p>
                <input
                  type="text"
                  value={typedSignature}
                  onChange={(e) => setTypedSignature(e.target.value)}
                  placeholder="请输入签名文字"
                  className="w-full px-4 py-3 text-lg border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
                {typedSignature && (
                  <div className="border rounded-lg p-6 bg-gray-50 text-center">
                    <p className="text-xs text-gray-600 mb-2">预览：</p>
                    <p style={{ fontFamily: '"Brush Script MT", "Comic Sans MS", cursive', fontSize: '48px' }}>
                      {typedSignature}
                    </p>
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end space-x-3 pt-4 mt-6 border-t">
              <button
                onClick={() => setShowSigModal(false)}
                className="px-5 py-2 text-gray-700 hover:bg-gray-100 rounded-lg font-medium transition-colors"
              >
                取消
              </button>
              {sigMode === 'draw' && (
                <button
                  onClick={handleConfirmDrawSignature}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
                >
                  确认使用
                </button>
              )}
              {sigMode === 'type' && (
                <button
                  onClick={handleConfirmTypeSignature}
                  disabled={!typedSignature.trim()}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-medium rounded-lg transition-colors"
                >
                  确认使用
                </button>
              )}
              {sigMode === 'upload' && (
                <button
                  onClick={() => setShowSigModal(false)}
                  disabled={!fieldValues[activeField.id]?.imageData}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-medium rounded-lg transition-colors"
                >
                  完成
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {showRejectModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-red-600 mb-4">✕ 拒签合同</h3>
            <p className="text-gray-600 text-sm mb-4">请填写拒签原因（必填）：</p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={5}
              placeholder="请详细说明拒签原因..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none"
            />
            <div className="flex justify-end space-x-3 pt-4 mt-6 border-t">
              <button
                onClick={() => { setShowRejectModal(false); setRejectReason(''); }}
                className="px-5 py-2 text-gray-700 hover:bg-gray-100 rounded-lg font-medium transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleReject}
                disabled={submitting || !rejectReason.trim()}
                className="px-5 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white font-medium rounded-lg transition-colors"
              >
                {submitting ? '提交中...' : '确认拒签'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
