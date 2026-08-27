import axios from 'axios';
import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import Toast from '../components/Toast';
import { 
  FileText, 
  ClipboardList, 
  Plus, 
  X, 
  Pointer, 
  Check, 
  Copy, 
  CheckCircle2, 
  Clock, 
  UploadCloud, 
  Mail, 
  Trash2, 
  AlertCircle 
} from 'lucide-react';

const apiBaseUrl = process.env.NODE_ENV === 'production' || process.env.NEXT_PUBLIC_SINGLE_PORT === 'true'
  ? ''
  : process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';

pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

type SignatureField = {
  page: number;
  x_pct: number;
  y_pct: number;
  width_pct: number;
};

type AuditRecord = {
  token: string;
  candidateEmail: string;
  status: 'pending' | 'signed';
  createdAt: string;
};

export default function HomePage() {
  const [candidateEmail, setCandidateEmail] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [signatureFields, setSignatureFields] = useState<SignatureField[]>([]);
  const [signingLink, setSigningLink] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPlacingField, setIsPlacingField] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  const [numPages, setNumPages] = useState(0);
  const [isCopied, setIsCopied] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Resize logic for responsive PDF
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(720);

  const updateWidth = useCallback(() => {
    if (containerRef.current) {
      setContainerWidth(Math.min(containerRef.current.clientWidth - 40, 720));
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(updateWidth, 50);
    window.addEventListener('resize', updateWidth);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', updateWidth);
    };
  }, [previewUrl, updateWidth]);

  // Toast state
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Dashboard stats
  const [recentDocs, setRecentDocs] = useState<AuditRecord[]>([]);
  const [stats, setStats] = useState({ total: 0, pending: 0, signed: 0 });

  const fetchStats = useCallback(async () => {
    try {
      const response = await axios.get<AuditRecord[]>(`${apiBaseUrl}/api/audit`);
      const records = response.data;
      setRecentDocs(records.slice(0, 5));
      setStats({
        total: records.length,
        pending: records.filter((r) => r.status === 'pending').length,
        signed: records.filter((r) => r.status === 'signed').length
      });
    } catch {
      // silently fail — stats are non-critical
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    if (!file) {
      setPreviewUrl('');
      setNumPages(0);
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [file]);

  const removeSignatureField = (indexToRemove: number) => {
    setSignatureFields((previous) => previous.filter((_, index) => index !== indexToRemove));
  };

  const copyLink = useCallback(async () => {
    if (!signingLink) return;
    try {
      await navigator.clipboard.writeText(signingLink);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch {
      setToast({ message: 'Failed to copy link', type: 'error' });
    }
  }, [signingLink]);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!candidateEmail || !file) {
      setToast({ message: 'Candidate email and PDF are required.', type: 'error' });
      return;
    }

    if (signatureFields.length === 0) {
      setToast({ message: 'Place at least one sign location on the PDF.', type: 'error' });
      return;
    }

    try {
      setIsSubmitting(true);
      const formData = new FormData();
      formData.append('candidateEmail', candidateEmail);
      formData.append('file', file);
      formData.append('signatureFields', JSON.stringify(signatureFields));

      const response = await axios.post(`${apiBaseUrl}/api/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      setToast({ message: response.data.message || 'Document sent successfully!', type: 'success' });
      setSigningLink(response.data.signingLink || '');
      setCandidateEmail('');
      setFile(null);
      setSignatureFields([]);
      setIsPlacingField(false);

      // Refresh stats
      fetchStats();
    } catch (error: any) {
      setToast({ message: error?.response?.data?.error || 'Failed to upload and send signing link.', type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

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
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile && droppedFile.type === 'application/pdf') {
      setFile(droppedFile);
    } else {
      setToast({ message: 'Please upload a valid PDF document.', type: 'error' });
    }
  };

  return (
    <main className="min-h-screen bg-slate-50/50 py-8 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        


        {/* Dashboard Stats */}
        <section className="grid grid-cols-3 gap-3 sm:gap-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-3 sm:p-5 shadow-sm hover:shadow-md transition-shadow duration-300 flex items-center justify-between gap-1">
            <div className="min-w-0">
              <p className="text-[10px] sm:text-sm font-medium text-slate-400 truncate">
                <span className="hidden sm:inline">Total Envelopes</span>
                <span className="sm:hidden">Total</span>
              </p>
              <p className="text-lg sm:text-2xl font-bold text-slate-800 mt-0.5 sm:mt-1">{stats.total}</p>
            </div>
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-slate-50 text-slate-600 rounded-xl flex items-center justify-center shrink-0">
              <FileText size={16} className="sm:hidden" />
              <FileText size={20} className="hidden sm:block" />
            </div>
          </div>
          <div className="bg-white border border-slate-200 rounded-2xl p-3 sm:p-5 shadow-sm hover:shadow-md transition-shadow duration-300 flex items-center justify-between gap-1">
            <div className="min-w-0">
              <p className="text-[10px] sm:text-sm font-medium text-slate-400 truncate">
                <span className="hidden sm:inline">Awaiting Signature</span>
                <span className="sm:hidden">Pending</span>
              </p>
              <p className="text-lg sm:text-2xl font-bold text-amber-600 mt-0.5 sm:mt-1">{stats.pending}</p>
            </div>
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center shrink-0">
              <Clock size={16} className="sm:hidden" />
              <Clock size={20} className="hidden sm:block" />
            </div>
          </div>
          <div className="bg-white border border-slate-200 rounded-2xl p-3 sm:p-5 shadow-sm hover:shadow-md transition-shadow duration-300 flex items-center justify-between gap-1">
            <div className="min-w-0">
              <p className="text-[10px] sm:text-sm font-medium text-slate-400 truncate">
                <span className="hidden sm:inline">Completed</span>
                <span className="sm:hidden">Signed</span>
              </p>
              <p className="text-lg sm:text-2xl font-bold text-emerald-600 mt-0.5 sm:mt-1">{stats.signed}</p>
            </div>
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center shrink-0">
              <CheckCircle2 size={16} className="sm:hidden" />
              <CheckCircle2 size={20} className="hidden sm:block" />
            </div>
          </div>
        </section>

        {/* Workspace Panels */}
        <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-8 items-start">
          
          {/* Settings Sidebar */}
          <aside className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm space-y-6 lg:sticky lg:top-8">
            <h2 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
              Configuration
            </h2>

            <form className="space-y-6" onSubmit={onSubmit}>
              
              {/* Candidate Email */}
              <div className="space-y-2">
                <label htmlFor="candidateEmail" className="block text-sm font-semibold text-slate-700">
                  Candidate Email
                </label>
                <div className="relative rounded-xl shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Mail size={16} />
                  </div>
                  <input
                    id="candidateEmail"
                    type="email"
                    className="block w-full pl-10 pr-4 py-2.5 bg-slate-50/50 focus:bg-white border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 rounded-xl text-slate-800 text-sm font-medium transition-all"
                    value={candidateEmail}
                    onChange={(event) => setCandidateEmail(event.target.value)}
                    placeholder="candidate@company.com"
                    required
                  />
                </div>
              </div>

              {/* PDF Document Upload */}
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-700">
                  Offer Letter PDF
                </label>
                {!file ? (
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all duration-200 ${
                      isDragging 
                        ? 'border-indigo-500 bg-indigo-50/30' 
                        : 'border-slate-200 hover:border-slate-300 bg-slate-50/50 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      id="pdfFile"
                      type="file"
                      accept="application/pdf"
                      className="hidden"
                      onChange={(event) => setFile(event.target.files?.[0] || null)}
                      required
                    />
                    <label htmlFor="pdfFile" className="cursor-pointer space-y-3 block">
                      <div className="mx-auto w-10 h-10 bg-indigo-50 dark:bg-slate-100 text-indigo-600 rounded-xl flex items-center justify-center">
                        <UploadCloud size={20} />
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-indigo-600 hover:text-indigo-700">Click to upload</p>
                        <p className="text-xs text-slate-400">or drag and drop PDF here</p>
                      </div>
                    </label>
                  </div>
                ) : (
                  <div className="flex items-center justify-between border border-slate-200 rounded-xl p-3.5 bg-slate-50/50">
                    <div className="flex items-center gap-3 overflow-hidden">
                      <div className="w-9 h-9 bg-rose-50 text-rose-600 rounded-lg flex items-center justify-center shrink-0">
                        <FileText size={18} />
                      </div>
                      <div className="overflow-hidden">
                        <p className="text-sm font-semibold text-slate-800 truncate">{file.name}</p>
                        <p className="text-xs text-slate-400 mt-0.5">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFile(null)}
                      className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                      title="Remove PDF"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                )}
              </div>

              {/* Signature Fields Panel */}
              <div className="border border-slate-100 bg-slate-50/30 rounded-2xl p-4.5 space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h3 className="text-sm font-bold text-slate-800">Signature Fields</h3>
                    <p className="text-xs text-slate-400 mt-0.5">{signatureFields.length} field(s) placed</p>
                  </div>
                  <button
                    type="button"
                    disabled={!file}
                    onClick={() => setIsPlacingField((prev) => !prev)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-semibold text-xs border shadow-sm transition-all duration-200 ${
                      !file 
                        ? 'opacity-40 cursor-not-allowed bg-slate-100 text-slate-400 border-slate-200'
                        : isPlacingField
                          ? 'bg-rose-50 hover:bg-rose-100/80 text-rose-600 border-rose-200'
                          : 'bg-indigo-600 hover:bg-indigo-700 text-white border-transparent'
                    }`}
                  >
                    {isPlacingField ? (
                      <>
                        <X size={13} strokeWidth={2.5} />
                        Cancel
                      </>
                    ) : (
                      <>
                        <Plus size={13} strokeWidth={2.5} />
                        Place Field
                      </>
                    )}
                  </button>
                </div>

                {isPlacingField && (
                  <div className="flex items-start gap-2 bg-indigo-50 border border-indigo-100 rounded-xl p-3 text-xs text-indigo-800 leading-relaxed animate-pulse">
                    <Pointer size={14} className="shrink-0 mt-0.5" />
                    <span>Click on the PDF document preview to place a signing location.</span>
                  </div>
                )}

                {signatureFields.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {signatureFields.map((field, index) => (
                      <button
                        key={`remove-${field.page}-${field.x_pct}-${field.y_pct}-${index}`}
                        type="button"
                        onClick={() => removeSignatureField(index)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-slate-200 hover:border-rose-200 hover:bg-rose-50 text-slate-600 hover:text-rose-600 rounded-lg text-xs font-semibold shadow-sm transition-all group"
                      >
                        <X size={12} className="text-slate-400 group-hover:text-rose-500" />
                        <span>#{index + 1} (Pg {field.page + 1})</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Submit Trigger */}
              <button
                type="submit"
                disabled={isSubmitting || !file || signatureFields.length === 0}
                className="w-full inline-flex items-center justify-center gap-2 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 text-white disabled:text-slate-400 font-semibold text-sm rounded-xl transition-all shadow-md disabled:shadow-none hover:shadow-indigo-100"
              >
                {isSubmitting ? (
                  <>
                    <span className="w-4 h-4 border-2 border-slate-400 border-t-white rounded-full animate-spin" />
                    Generating Secure Link...
                  </>
                ) : (
                  'Upload & Create Signing Link'
                )}
              </button>
            </form>
          </aside>

          {/* Document Preview Area */}
          <section className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-lg font-bold text-slate-900">PDF Preview Workspace</h2>
              {file && (
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-indigo-50 border border-indigo-100 text-indigo-700 rounded-lg text-xs font-semibold">
                  <AlertCircle size={13} />
                  <span>Click to Place Mode: {isPlacingField ? 'Active' : 'Inactive'}</span>
                </div>
              )}
            </div>

            <div 
              className="bg-slate-100/60 rounded-xl border border-slate-200/60 p-4 overflow-y-auto overflow-x-hidden w-full max-h-[750px] relative flex justify-center shadow-inner" 
              ref={containerRef}
            >
              {previewUrl ? (
                <Document 
                  file={previewUrl} 
                  onLoadSuccess={({ numPages: pages }) => setNumPages(pages)}
                  loading={
                    <div className="flex flex-col items-center py-20 gap-3">
                      <span className="w-8 h-8 border-3 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
                      <p className="text-sm font-semibold text-slate-500">Loading document elements...</p>
                    </div>
                  }
                >
                  {Array.from({ length: numPages }, (_, pageIndex) => (
                    <div
                      key={`page-${pageIndex + 1}`}
                      className={`relative w-fit mx-auto mb-6 rounded-lg overflow-hidden border border-slate-200 shadow-md ${
                        isPlacingField ? 'cursor-crosshair hover:ring-2 hover:ring-indigo-500/50 transition-shadow' : ''
                      }`}
                      onClick={(event) => {
                        if (!isPlacingField) return;

                        const rect = event.currentTarget.getBoundingClientRect();
                        const xPct = (event.clientX - rect.left) / rect.width;
                        const yPct = (event.clientY - rect.top) / rect.height;

                        if (xPct < 0 || xPct > 1 || yPct < 0 || yPct > 1) return;

                        setSignatureFields((previous) => [
                          ...previous,
                          {
                            page: pageIndex,
                            x_pct: Number(xPct.toFixed(4)),
                            y_pct: Number(yPct.toFixed(4)),
                            width_pct: 0.24
                          }
                        ]);
                        setIsPlacingField(false);
                      }}
                    >
                      <Page 
                        pageNumber={pageIndex + 1} 
                        width={containerWidth} 
                        renderTextLayer={false} 
                        renderAnnotationLayer={false} 
                      />
                      
                      {/* Signature Overlays */}
                      <div className="absolute inset-0 pointer-events-none">
                        {signatureFields
                          .map((field, index) => ({ field, index }))
                          .filter(({ field }) => field.page === pageIndex)
                          .map(({ field, index }) => (
                            <div
                              key={`${field.page}-${field.x_pct}-${field.y_pct}-${index}`}
                              className="absolute border-2 border-dashed border-indigo-600 bg-indigo-50/80 dark:bg-indigo-950/40 rounded shadow-md flex items-center justify-between px-3 py-1.5 -translate-x-1/2 -translate-y-1/2 pointer-events-auto group hover:border-solid hover:bg-indigo-100 transition-all duration-200"
                              style={{
                                left: `${field.x_pct * 100}%`,
                                top: `${field.y_pct * 100}%`,
                                width: `${field.width_pct * 100}%`,
                                height: '56px'
                              }}
                            >
                              <div className="flex items-center gap-1 overflow-hidden shrink min-w-0">
                                <span className="w-3.5 h-3.5 sm:w-4.5 sm:h-4.5 bg-indigo-600 text-white rounded-full flex items-center justify-center text-[8px] sm:text-[10px] font-bold shrink-0">
                                  {index + 1}
                                </span>
                                <span className="text-[8px] sm:text-[11px] font-bold text-indigo-900 truncate whitespace-nowrap">
                                  <span className="hidden sm:inline">Sign Here</span>
                                  <span className="sm:hidden">Sign</span>
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  removeSignatureField(index);
                                }}
                                className="opacity-0 group-hover:opacity-100 p-1 hover:bg-indigo-200 text-indigo-700 hover:text-indigo-900 rounded transition-all duration-200"
                              >
                                <X size={12} strokeWidth={2.5} />
                              </button>
                            </div>
                          ))}
                      </div>
                    </div>
                  ))}
                </Document>
              ) : (
                <div className="flex flex-col items-center py-24 text-slate-400 space-y-4">
                  <div className="w-16 h-16 bg-slate-50 border border-slate-200/80 rounded-2xl flex items-center justify-center shadow-sm">
                    <FileText size={32} className="text-slate-300" />
                  </div>
                  <div className="text-center space-y-1 max-w-[280px]">
                    <p className="text-sm font-semibold text-slate-600">No Document Uploaded</p>
                    <p className="text-xs text-slate-400">Upload an offer letter PDF using the sidebar to view it here.</p>
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Generated Signing Link Box */}
        {signingLink && (
          <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-5 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4 animate-fade-in">
            <div className="space-y-1 min-w-0 flex-1">
              <h3 className="text-sm font-bold text-indigo-950">Signing Link Generated</h3>
              <p className="text-xs text-indigo-700">Copy this link and send it directly to the candidate to complete signing.</p>
              <div className="bg-white border border-indigo-100 rounded-lg p-2.5 mt-2 truncate">
                <a href={signingLink} className="text-sm font-semibold text-indigo-600 hover:underline" target="_blank" rel="noreferrer">
                  {signingLink}
                </a>
              </div>
            </div>
            <button 
              type="button" 
              className={`inline-flex items-center gap-2 px-5 py-3 border border-indigo-200 rounded-xl font-bold text-sm transition-all duration-200 shadow-sm shrink-0 ${
                isCopied 
                  ? 'bg-emerald-600 border-transparent text-white' 
                  : 'bg-white hover:bg-slate-50 text-indigo-600 hover:text-indigo-700'
              }`} 
              onClick={copyLink}
            >
              {isCopied ? (
                <>
                  <Check size={16} strokeWidth={3} />
                  Link Copied!
                </>
              ) : (
                <>
                  <Copy size={16} />
                  Copy Link
                </>
              )}
            </button>
          </div>
        )}

        {/* Recent Documents Table */}
        {recentDocs.length > 0 && (
          <section className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Recent Documents</h2>
                <p className="text-xs text-slate-400 mt-0.5">Summary of the 5 most recently uploaded letters</p>
              </div>
              <Link href="/audit" className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200/80 border border-slate-200 rounded-xl text-slate-700 hover:text-slate-900 font-semibold text-xs transition-all duration-200 shadow-sm shrink-0">
                <ClipboardList size={14} strokeWidth={2} />
                View Full Audit Logs
              </Link>
            </div>
            {/* Mobile Card List View */}
            <div className="divide-y divide-slate-100 sm:hidden">
              {recentDocs.map((doc) => (
                <div key={doc.token} className="p-4.5 space-y-2.5 hover:bg-slate-50/50 transition-colors">
                  <div className="flex justify-between items-start gap-3">
                    <span className="font-semibold text-slate-800 break-all text-xs leading-relaxed">{doc.candidateEmail}</span>
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold shrink-0 ${
                      doc.status === 'signed' 
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' 
                        : 'bg-amber-50 text-amber-700 border border-amber-100'
                    }`}>
                      {doc.status === 'signed' ? (
                        <>
                          <CheckCircle2 size={10} strokeWidth={2.5} />
                          Signed
                        </>
                      ) : (
                        <>
                          <Clock size={10} strokeWidth={2.5} />
                          Pending
                        </>
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-[10px] text-slate-400 font-semibold">
                    <span>Created On</span>
                    <span className="text-slate-500">
                      {new Date(doc.createdAt).toLocaleDateString(undefined, { 
                        year: 'numeric', 
                        month: 'short', 
                        day: 'numeric' 
                      })}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table View */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/75 border-b border-slate-100 text-xs font-bold text-slate-500 uppercase tracking-wider">
                    <th className="py-4 px-6">Candidate Email</th>
                    <th className="py-4 px-6">Status</th>
                    <th className="py-4 px-6">Created On</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                  {recentDocs.map((doc) => (
                    <tr key={doc.token} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-4 px-6 font-semibold text-slate-800 break-all">{doc.candidateEmail}</td>
                      <td className="py-4 px-6">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                          doc.status === 'signed' 
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' 
                            : 'bg-amber-50 text-amber-700 border border-amber-100'
                        }`}>
                          {doc.status === 'signed' ? (
                            <>
                              <CheckCircle2 size={12} strokeWidth={2.5} />
                              Signed
                            </>
                          ) : (
                            <>
                              <Clock size={12} strokeWidth={2.5} />
                              Pending
                            </>
                          )}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-slate-400">
                        {new Date(doc.createdAt).toLocaleDateString(undefined, { 
                          year: 'numeric', 
                          month: 'short', 
                          day: 'numeric' 
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onDismiss={() => setToast(null)}
        />
      )}
    </main>
  );
}
