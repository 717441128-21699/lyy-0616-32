import { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';

// @ts-ignore
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

interface PdfPageViewerProps {
  pdfUrl: string;
  pageNumber: number;
  scale?: number;
  onPageSize?: (size: { width: number; height: number }) => void;
  className?: string;
  style?: React.CSSProperties;
}

export default function PdfPageViewer({
  pdfUrl,
  pageNumber,
  scale = 1.5,
  onPageSize,
  className,
  style
}: PdfPageViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const pdfDocRef = useRef<any>(null);

  useEffect(() => {
    let cancelled = false;
    const loadPdf = async () => {
      try {
        setLoading(true);
        setError('');
        if (!pdfDocRef.current) {
          const loadingTask = pdfjsLib.getDocument(pdfUrl);
          pdfDocRef.current = await loadingTask.promise;
        }
        const pdf = pdfDocRef.current;
        if (!pdf) return;
        const page = await pdf.getPage(pageNumber);
        const viewport = page.getViewport({ scale });

        if (onPageSize) {
          const origViewport = page.getViewport({ scale: 1 });
          onPageSize({ width: origViewport.width, height: origViewport.height });
        }

        const canvas = canvasRef.current;
        if (!canvas || cancelled) return;
        const context = canvas.getContext('2d');
        if (!context) return;

        canvas.width = viewport.width;
        canvas.height = viewport.height;

        await page.render({
          canvasContext: context,
          viewport
        }).promise;

        if (!cancelled) setLoading(false);
      } catch (e: any) {
        if (!cancelled) {
          console.error('PDF渲染失败:', e);
          setError(e.message || 'PDF渲染失败');
          setLoading(false);
        }
      }
    };
    loadPdf();
    return () => {
      cancelled = true;
    };
  }, [pdfUrl, pageNumber, scale, onPageSize]);

  return (
    <div className={className} style={style}>
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-50 text-gray-400">
          加载中...
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-50 text-red-500">
          {error}
        </div>
      )}
      <canvas ref={canvasRef} style={{ display: loading ? 'none' : 'block' }} />
    </div>
  );
}
