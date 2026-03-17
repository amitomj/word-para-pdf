import React, { useState, useRef, useCallback } from 'react';
import { 
  FileText, 
  Upload, 
  Download, 
  Trash2, 
  CheckCircle2, 
  Loader2, 
  AlertCircle,
  FolderOpen,
  FileDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import mammoth from 'mammoth';
import html2pdf from 'html2pdf.js';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

interface FileStatus {
  id: string;
  file: File;
  status: 'pending' | 'converting' | 'completed' | 'error';
  progress: number;
  pdfBlob?: Blob;
  error?: string;
}

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export default function App() {
  const [files, setFiles] = useState<FileStatus[]>([]);
  const [isConvertingAll, setIsConvertingAll] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback((newFiles: FileList | File[]) => {
    const validFiles = Array.from(newFiles).filter(file => 
      file.name.toLowerCase().endsWith('.docx')
    );

    if (validFiles.length === 0 && Array.from(newFiles).length > 0) {
      alert('Por favor, selecione apenas arquivos .docx (Word moderno).');
      return;
    }

    const newFileStatuses: FileStatus[] = validFiles.map(file => ({
      id: Math.random().toString(36).substring(7),
      file,
      status: 'pending',
      progress: 0
    }));

    setFiles(prev => [...prev, ...newFileStatuses]);
  }, []);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files) {
      addFiles(e.dataTransfer.files);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) addFiles(e.target.files);
  };

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  const clearAll = () => {
    setFiles([]);
  };

  const convertFile = async (fileStatus: FileStatus): Promise<Blob | null> => {
    try {
      setFiles(prev => prev.map(f => f.id === fileStatus.id ? { ...f, status: 'converting' } : f));

      const arrayBuffer = await fileStatus.file.arrayBuffer();
      const result = await mammoth.convertToHtml({ arrayBuffer });
      const html = result.value;

      // Create a temporary container for the HTML to be converted to PDF
      const element = document.createElement('div');
      element.innerHTML = `
        <div style="padding: 40px; font-family: 'Arial', sans-serif; line-height: 1.6; color: #333;">
          ${html}
        </div>
      `;

      const opt = {
        margin: 10,
        filename: fileStatus.file.name.replace(/\.docx$/i, '.pdf'),
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      };

      // @ts-ignore
      const pdfBlob = await html2pdf().from(element).set(opt).output('blob');

      setFiles(prev => prev.map(f => f.id === fileStatus.id ? { 
        ...f, 
        status: 'completed', 
        pdfBlob,
        progress: 100 
      } : f));

      return pdfBlob;
    } catch (error) {
      console.error('Erro na conversão:', error);
      setFiles(prev => prev.map(f => f.id === fileStatus.id ? { 
        ...f, 
        status: 'error', 
        error: 'Falha ao converter arquivo.' 
      } : f));
      return null;
    }
  };

  const convertAll = async () => {
    const pendingFiles = files.filter(f => f.status === 'pending');
    if (pendingFiles.length === 0) return;

    setIsConvertingAll(true);
    for (const fileStatus of pendingFiles) {
      await convertFile(fileStatus);
    }
    setIsConvertingAll(false);
  };

  const downloadZip = async () => {
    const completedFiles = files.filter(f => f.status === 'completed' && f.pdfBlob);
    if (completedFiles.length === 0) return;

    const zip = new JSZip();
    completedFiles.forEach(f => {
      const fileName = f.file.name.replace(/\.docx$/i, '.pdf');
      zip.file(fileName, f.pdfBlob!);
    });

    const content = await zip.generateAsync({ type: 'blob' });
    saveAs(content, 'documentos_convertidos.zip');
  };

  const downloadSingle = (fileStatus: FileStatus) => {
    if (fileStatus.pdfBlob) {
      const fileName = fileStatus.file.name.replace(/\.docx$/i, '.pdf');
      saveAs(fileStatus.pdfBlob, fileName);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F5F5] text-[#1A1A1A] font-sans p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <header className="mb-12 text-center">
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center justify-center w-16 h-16 bg-white rounded-2xl shadow-sm mb-6"
          >
            <FileText className="w-8 h-8 text-blue-600" />
          </motion.div>
          <h1 className="text-4xl font-light tracking-tight mb-2">Word para PDF</h1>
          <p className="text-muted text-gray-500">Converta seus documentos com precisão e rapidez.</p>
        </header>

        {/* Upload Area */}
        <div 
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`grid grid-cols-1 md:grid-cols-2 gap-4 mb-8 transition-all duration-300 ${
            isDragging ? 'scale-105' : ''
          }`}
        >
          <button 
            onClick={() => fileInputRef.current?.click()}
            className={`group relative flex flex-col items-center justify-center p-8 bg-white rounded-3xl border-2 border-dashed transition-all cursor-pointer overflow-hidden ${
              isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-400'
            }`}
          >
            <div className="absolute inset-0 bg-blue-50 opacity-0 group-hover:opacity-100 transition-opacity" />
            <Upload className="w-8 h-8 mb-4 text-blue-600 relative z-10" />
            <span className="font-medium relative z-10">Selecionar Arquivos</span>
            <span className="text-xs text-gray-400 mt-1 relative z-10">Ou arraste e solte aqui</span>
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileChange} 
              multiple 
              accept=".docx" 
              className="hidden" 
            />
          </button>

          <button 
            onClick={() => folderInputRef.current?.click()}
            className={`group relative flex flex-col items-center justify-center p-8 bg-white rounded-3xl border-2 border-dashed transition-all cursor-pointer overflow-hidden ${
              isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-400'
            }`}
          >
            <div className="absolute inset-0 bg-blue-50 opacity-0 group-hover:opacity-100 transition-opacity" />
            <FolderOpen className="w-8 h-8 mb-4 text-blue-600 relative z-10" />
            <span className="font-medium relative z-10">Selecionar Pasta</span>
            <span className="text-xs text-gray-400 mt-1 relative z-10">Se o botão falhar, arraste a pasta aqui</span>
            <input 
              type="file" 
              ref={folderInputRef} 
              onChange={handleFileChange} 
              // @ts-ignore
              webkitdirectory=""
              // @ts-ignore
              mozdirectory=""
              // @ts-ignore
              directory=""
              multiple 
              className="hidden" 
            />
          </button>
        </div>

        {/* Browser Tip */}
        <div className="text-center mb-8">
          <p className="text-[10px] text-gray-400 bg-gray-100 inline-block px-3 py-1 rounded-full uppercase tracking-wider">
            Dica: Se o seu navegador não permitir selecionar pastas pelo botão, arraste a pasta diretamente para esta tela.
          </p>
        </div>

        {/* Actions Bar */}
        {files.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-wrap items-center justify-between gap-4 mb-6 bg-white p-4 rounded-2xl shadow-sm"
          >
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium text-gray-600">
                {files.length} {files.length === 1 ? 'arquivo' : 'arquivos'} selecionado(s)
              </span>
              <button 
                onClick={clearAll}
                className="text-xs text-red-500 hover:underline"
              >
                Limpar tudo
              </button>
            </div>
            <div className="flex gap-2">
              <button
                onClick={convertAll}
                disabled={isConvertingAll || !files.some(f => f.status === 'pending')}
                className="flex items-center gap-2 px-6 py-2 bg-[#1A1A1A] text-white rounded-full text-sm font-medium hover:bg-black disabled:opacity-50 transition-colors"
              >
                {isConvertingAll ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Convertendo...
                  </>
                ) : (
                  <>
                    <FileDown className="w-4 h-4" />
                    Converter Tudo
                  </>
                )}
              </button>
              <button
                onClick={downloadZip}
                disabled={!files.some(f => f.status === 'completed')}
                className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-full text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                <Download className="w-4 h-4" />
                Baixar ZIP
              </button>
            </div>
          </motion.div>
        )}

        {/* File List */}
        <div className="space-y-3">
          <AnimatePresence mode="popLayout">
            {files.map((fileStatus) => (
              <motion.div
                key={fileStatus.id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="flex items-center justify-between p-4 bg-white rounded-2xl shadow-sm group border border-transparent hover:border-gray-100 transition-all"
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div className={`p-2 rounded-xl ${
                    fileStatus.status === 'completed' ? 'bg-green-50 text-green-600' :
                    fileStatus.status === 'error' ? 'bg-red-50 text-red-600' :
                    'bg-blue-50 text-blue-600'
                  }`}>
                    {fileStatus.status === 'completed' ? <CheckCircle2 className="w-5 h-5" /> :
                     fileStatus.status === 'error' ? <AlertCircle className="w-5 h-5" /> :
                     fileStatus.status === 'converting' ? <Loader2 className="w-5 h-5 animate-spin" /> :
                     <FileText className="w-5 h-5" />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate pr-4">{fileStatus.file.name}</p>
                    <p className="text-[10px] text-gray-400 uppercase tracking-wider">
                      {(fileStatus.file.size / 1024).toFixed(1)} KB • {fileStatus.status}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {fileStatus.status === 'pending' && (
                    <button 
                      onClick={() => convertFile(fileStatus)}
                      className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
                      title="Converter"
                    >
                      <FileDown className="w-5 h-5" />
                    </button>
                  )}
                  {fileStatus.status === 'completed' && (
                    <button 
                      onClick={() => downloadSingle(fileStatus)}
                      className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                      title="Baixar PDF"
                    >
                      <Download className="w-5 h-5" />
                    </button>
                  )}
                  <button 
                    onClick={() => removeFile(fileStatus.id)}
                    className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                    title="Remover"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {files.length === 0 && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-20 bg-white/50 rounded-3xl border border-dashed border-gray-200"
            >
              <p className="text-gray-400 text-sm">Nenhum arquivo selecionado.</p>
            </motion.div>
          )}
        </div>

        {/* Footer Info */}
        <footer className="mt-12 text-center text-[11px] text-gray-400 uppercase tracking-widest">
          Processamento 100% local no seu navegador • Privacidade garantida
        </footer>
      </div>
    </div>
  );
}
