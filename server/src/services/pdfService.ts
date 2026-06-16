import fs from 'fs';
import path from 'path';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { Contract, ContractField, Signature, Signer } from '../models';

export class PdfService {
  private uploadDir: string;

  constructor(uploadDir: string) {
    this.uploadDir = uploadDir;
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
  }

  async saveTemplate(fileBuffer: Buffer, fileName: string): Promise<string> {
    const templatesDir = path.join(this.uploadDir, 'templates');
    if (!fs.existsSync(templatesDir)) {
      fs.mkdirSync(templatesDir, { recursive: true });
    }
    const uniqueName = `${Date.now()}_${fileName}`;
    const filePath = path.join(templatesDir, uniqueName);
    fs.writeFileSync(filePath, fileBuffer);
    return filePath;
  }

  async getPdfInfo(templatePath: string): Promise<{ pageCount: number; pages: Array<{ width: number; height: number }> }> {
    const pdfBytes = fs.readFileSync(templatePath);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const pages = pdfDoc.getPages().map(page => ({
      width: page.getWidth(),
      height: page.getHeight()
    }));
    return {
      pageCount: pdfDoc.getPageCount(),
      pages
    };
  }

  async mergeSignatures(contract: Contract, fields: ContractField[], signatures: Signature[]): Promise<string> {
    const templatePath = path.resolve(contract.templatePath);
    const pdfBytes = fs.readFileSync(templatePath);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    
    let cjkFont: any;
    try {
      const fontPath = path.join(process.cwd(), 'fonts', 'SimHei.ttf');
      console.log('[PDF字体] 查找字体路径:', fontPath, '存在:', fs.existsSync(fontPath));
      if (fs.existsSync(fontPath)) {
        const fontBytes = fs.readFileSync(fontPath);
        cjkFont = await pdfDoc.embedFont(fontBytes);
        console.log('[PDF字体] 已嵌入中文字体 SimHei，字体大小:', fontBytes.length, '字节');
      } else {
        console.warn('[PDF字体] 字体文件不存在，使用默认 Helvetica');
        cjkFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
      }
    } catch (e) {
      console.warn('加载中文字体失败，使用默认字体:', e);
      cjkFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    }

    const signatureMap = new Map<string, Signature>();
    signatures.forEach(sig => {
      if (sig.fieldId) {
        signatureMap.set(sig.fieldId, sig);
      }
    });

    for (const field of fields) {
      const page = pdfDoc.getPage(field.pageNumber - 1);
      if (!page) continue;

      if (field.type === 'signature' && field.id) {
        const sig = signatureMap.get(field.id);
        if (sig && sig.imageData) {
          try {
            const imageBytes = Buffer.from(sig.imageData.split(',')[1] || sig.imageData, 'base64');
            let image: any;
            try {
              image = await pdfDoc.embedPng(imageBytes);
            } catch {
              image = await pdfDoc.embedJpg(imageBytes);
            }
            const scaled = image.scaleToFit(field.width, field.height);
            page.drawImage(image, {
              x: field.x,
              y: field.y,
              width: scaled.width,
              height: scaled.height
            });
          } catch (e) {
            console.error('嵌入签名图片失败:', e);
          }
        }
      } else if (field.type === 'date' && field.value) {
        page.drawText(field.value, {
          x: field.x,
          y: field.y + field.height / 2 - 6,
          size: 12,
          font: cjkFont,
          color: rgb(0, 0, 0)
        });
      } else if (field.type === 'text' && field.value) {
        page.drawText(field.value, {
          x: field.x,
          y: field.y + field.height / 2 - 6,
          size: 11,
          font: cjkFont,
          color: rgb(0, 0, 0)
        });
      }
    }

    const signedDir = path.join(this.uploadDir, 'signed');
    if (!fs.existsSync(signedDir)) {
      fs.mkdirSync(signedDir, { recursive: true });
    }

    const signedFileName = `signed_${contract.id}_${Date.now()}.pdf`;
    const signedPath = path.join(signedDir, signedFileName);
    const mergedPdfBytes = await pdfDoc.save();
    fs.writeFileSync(signedPath, mergedPdfBytes);
    
    return signedPath;
  }

  readPdf(filePath: string): Buffer {
    return fs.readFileSync(path.resolve(filePath));
  }

  getTemplatePath(fileName: string): string {
    return path.join(this.uploadDir, 'templates', fileName);
  }
}
