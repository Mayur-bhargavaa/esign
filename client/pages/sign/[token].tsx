import axios from 'axios';
import { useRouter } from 'next/router';
import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { 
  Check, 
  ShieldCheck, 
  Lock, 
  FileCheck, 
  ArrowRight, 
  ArrowLeft, 
  CheckCircle, 
  Download, 
  Edit3, 
  CheckSquare, 
  RotateCcw,
  Sparkles,
  X
} from 'lucide-react';
import Toast from '../../components/Toast';
import SignatureCanvas from '../../components/SignatureCanvas';
import SignaturePad from 'signature_pad';

const apiBaseUrl = process.env.NODE_ENV === 'production' || process.env.NEXT_PUBLIC_SINGLE_PORT === 'true'
  ? ''
  : process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';

pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

type DocumentPayload = {
  token: string;
  status: 'pending' | 'signed';
  expiresAt: string;
  previewUrl: string;
  signatureFields: Array<{
    page: number;
    x_pct: number;
    y_pct: number;
    width_pct: number;
  }>;
};

const cursiveFonts = [
  { id: 'Caveat', name: 'Casual Hand' },
  { id: 'Satisfy', name: 'Elegant Script' },
  { id: 'Great Vibes', name: 'Formal Calligraphy' }
];

function StepProgress({ currentStep }: { currentStep: number }) {
  const steps = [
    { label: 'Review Document', desc: 'Read offer letter terms' },
    { label: 'Apply Signature', desc: 'Type, draw, and authorize' },
    { label: 'Completed', desc: 'Securely saved & filed' }
  ];

  return (
    <div className="w-full py-4 border-b border-slate-100 bg-slate-50/40 px-4 sm:px-6">
      <div className="max-w-3xl mx-auto flex flex-row items-center justify-between gap-2 sm:gap-4">
        {steps.map((step, index) => {
          const isDone = index < currentStep;
          const isActive = index === currentStep;
          
          return (
            <div key={step.label} className="flex items-center gap-2 flex-1 last:flex-none">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <span className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-[11px] sm:text-xs font-bold transition-all shrink-0 ${
                  isDone 
                    ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-100' 
                    : isActive 
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-100 ring-4 ring-indigo-55 ring-offset-0' 
                      : 'bg-slate-200 text-slate-500'
                }`}>
                  {isDone ? <Check size={12} strokeWidth={3} /> : index + 1}
                </span>
                <div className="text-left">
                  <p className={`text-[10px] sm:text-xs font-bold leading-tight ${isActive ? 'text-indigo-600' : isDone ? 'text-emerald-700' : 'text-slate-500'}`}>
                    <span className="hidden sm:inline">{step.label}</span>
                    <span className="sm:hidden">
                      {index === 0 && 'Review'}
                      {index === 1 && 'Sign'}
                      {index === 2 && 'Done'}
                    </span>
                  </p>
                  <p className="text-[10px] text-slate-400 mt-0.5 hidden md:block">{step.desc}</p>
                </div>
              </div>
              {index < 2 && (
                <div className="flex-1 h-0.5 bg-slate-200 min-w-[12px] sm:min-w-[40px] mx-1 sm:mx-2" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function SignPage() {
  const router = useRouter();
  const token = useMemo(() => {
    const routeToken = router.query.token;
    return typeof routeToken === 'string' ? routeToken : '';
  }, [router.query.token]);

  const [name, setName] = useState('');
  const [selectedFont, setSelectedFont] = useState('Satisfy');
  const [activeTab, setActiveTab] = useState<'type' | 'draw'>('type');
  const [isConsentChecked, setIsConsentChecked] = useState(false);
  const [documentData, setDocumentData] = useState<DocumentPayload | null>(null);
  const [downloadUrl, setDownloadUrl] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSigned, setIsSigned] = useState(false);
  const [numPages, setNumPages] = useState(0);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [sigPad, setSigPad] = useState<SignaturePad | null>(null);

  // Wizard step: 0 = Review, 1 = Sign, 2 = Done
  const [wizardStep, setWizardStep] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(800);

  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        setContainerWidth(Math.min(containerRef.current.clientWidth - 40, 800));
      }
    };
    const timer = setTimeout(updateWidth, 50);
    window.addEventListener('resize', updateWidth);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', updateWidth);
    };
  }, [wizardStep, isLoading, documentData]);

  useEffect(() => {
    async function loadDocument() {
      if (!token) return;

      try {
        setIsLoading(true);
        const response = await axios.get<DocumentPayload>(`${apiBaseUrl}/api/document/${token}`);
        setDocumentData(response.data);
        if (response.data.status === 'signed') {
          setIsSigned(true);
          setWizardStep(2);
        }
      } catch (error: any) {
        setToast({ message: error?.response?.data?.error || 'Unable to load signing document.', type: 'error' });
      } finally {
        setIsLoading(false);
      }
    }

    loadDocument();
  }, [token]);

  const createTypedSignatureDataUrl = (typedName: string, fontName: string) => {
    const canvas = document.createElement('canvas');
    canvas.width = 700;
    canvas.height = 220;
    const context = canvas.getContext('2d');

    if (!context) {
      throw new Error('Could not create typed signature context');
    }

    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = '#1e293b'; // Slate-800 color for elegant look
    context.font = `64px "${fontName}", cursive`;
    context.textBaseline = 'middle';
    context.fillText(typedName, 24, canvas.height / 2);

    return canvas.toDataURL('image/png');
  };

  const onSignDocument = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!token || !name || !isConsentChecked) {
      setToast({ message: 'Please enter your name and accept the consent checkbox.', type: 'error' });
      return;
    }

    if (activeTab === 'draw' && (!sigPad || sigPad.isEmpty())) {
      setToast({ message: 'Please draw your signature on the pad.', type: 'error' });
      return;
    }

    if (!documentData || documentData.signatureFields.length === 0) {
      setToast({ message: 'This document has no signature locations configured.', type: 'error' });
      return;
    }

    try {
      setIsSubmitting(true);
      let signatureDataUrl = '';
      if (activeTab === 'type') {
        signatureDataUrl = createTypedSignatureDataUrl(name, selectedFont);
      } else if (sigPad) {
        signatureDataUrl = sigPad.toDataURL('image/png');
      }

      const response = await axios.post(`${apiBaseUrl}/api/sign`, {
        token,
        name,
        signatureDataUrl,
        approved: isConsentChecked
      });

      setIsSigned(true);
      if (response.data?.downloadUrl) {
        setDownloadUrl(`${apiBaseUrl}${response.data.downloadUrl}`);
      }
      setToast({ message: response.data.message || 'Document signed successfully!', type: 'success' });
      setWizardStep(2);
    } catch (error: any) {
      setToast({ message: error?.response?.data?.error || 'Failed to sign document.', type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const clearCanvas = () => {
    if (sigPad) {
      sigPad.clear();
    }
  };

  if (isLoading) {
    return (
      <main className="min-h-screen bg-slate-50/50 flex flex-col items-center justify-center p-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-10 max-w-sm w-full text-center space-y-4 shadow-md">
          <span className="w-10 h-10 border-3 border-indigo-200 border-t-indigo-600 rounded-full animate-spin inline-block" />
          <p className="text-sm font-semibold text-slate-600">Verifying secure signing session...</p>
        </div>
      </main>
    );
  }

  if (!documentData) {
    return (
      <main className="min-h-screen bg-slate-50/40 flex flex-col font-sans">

        <div className="flex-1 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-8 max-w-md w-full text-center shadow-md space-y-5">
            <div className="mx-auto w-14 h-14 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center shadow-inner">
              <X size={28} strokeWidth={2.5} />
            </div>
            <div className="space-y-2">
              <h2 className="text-lg font-bold text-slate-800">Document Not Found (404)</h2>
              <p className="text-xs sm:text-sm text-slate-505 leading-relaxed">
                The signing link you clicked is invalid, has expired, or the document has already been signed. Please check the URL or contact your HR administrator.
              </p>
            </div>
          </div>
        </div>
        {toast && (
          <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />
        )}
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50/40 flex flex-col font-sans">

      {/* Stepper Wizard Progress */}
      <StepProgress currentStep={wizardStep} />

      {/* Main Container */}
      <div className="flex-1 w-full max-w-5xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        

        {/* ═══ STEP 0: REVIEW DOCUMENT ═══ */}
        {wizardStep === 0 && documentData && (
          <div className="space-y-6 animate-fade-in">
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
              <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-slate-50/50">
                <div>
                  <h2 className="text-sm font-bold text-slate-800">1. Review Document</h2>
                  <p className="text-xs text-slate-400 mt-0.5">Please scroll down and review the full PDF offer letter.</p>
                </div>
                <div className="px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-100 rounded-lg text-xs font-semibold shrink-0">
                  Required Signatures: {documentData.signatureFields.length}
                </div>
              </div>

              {/* Scrollable PDF Preview Frame */}
              <div 
                className="bg-slate-100/50 p-4 overflow-y-auto overflow-x-hidden w-full max-h-[600px] flex justify-center border-b border-slate-100 shadow-inner"
                ref={containerRef}
              >
                <Document
                  file={`${apiBaseUrl}${documentData.previewUrl}`}
                  onLoadSuccess={({ numPages: pages }) => setNumPages(pages)}
                  loading={
                    <div className="flex flex-col items-center py-20 gap-3">
                      <span className="w-7 h-7 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
                      <p className="text-xs font-semibold text-slate-400">Loading document preview...</p>
                    </div>
                  }
                >
                  {Array.from({ length: numPages }, (_, pageIndex) => (
                    <div key={`page-${pageIndex + 1}`} className="relative w-fit mx-auto mb-5 rounded-lg overflow-hidden border border-slate-200/80 shadow-md bg-white">
                      <Page pageNumber={pageIndex + 1} width={containerWidth} renderTextLayer={false} renderAnnotationLayer={false} />
                      
                      {/* Bounding Box Highlights */}
                      <div className="absolute inset-0 pointer-events-none">
                        {documentData.signatureFields
                          .map((field, index) => ({ field, index }))
                          .filter(({ field }) => field.page === pageIndex)
                          .map(({ field, index }) => (
                            <div
                              key={`${field.page}-${field.x_pct}-${field.y_pct}-${index}`}
                              className="absolute border-2 border-dashed border-amber-500 bg-amber-50/40 rounded shadow flex items-center justify-center -translate-x-1/2 -translate-y-1/2"
                              style={{
                                left: `${field.x_pct * 100}%`,
                                top: `${field.y_pct * 100}%`,
                                width: `${field.width_pct * 100}%`,
                                height: '56px'
                              }}
                            >
                              <span className="text-[8px] sm:text-[10px] font-bold text-amber-800 flex items-center gap-1 whitespace-nowrap">
                                <span className="w-3.5 h-3.5 sm:w-4.5 sm:h-4.5 bg-amber-500 text-white rounded-full flex items-center justify-center text-[8px] sm:text-[9px] font-bold shrink-0">
                                  {index + 1}
                                </span>
                                <span className="hidden sm:inline">Sign Here</span>
                                <span className="sm:hidden">Sign</span>
                              </span>
                            </div>
                          ))}
                      </div>
                    </div>
                  ))}
                </Document>
                {numPages === 0 && <p className="text-slate-400 text-xs py-20 font-medium">Failed to render PDF pages.</p>}
              </div>

              {/* Navigation Action */}
              <div className="p-4 bg-slate-50/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <p className="text-xs text-slate-400 font-medium">Scroll to read. Next step: Configure Signature</p>
                <button
                  type="button"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl transition-all shadow-md hover:shadow-indigo-100 shrink-0"
                  onClick={() => setWizardStep(1)}
                >
                  Proceed to Sign
                  <ArrowRight size={16} strokeWidth={2.5} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ═══ STEP 1: APPLY SIGNATURE ═══ */}
        {wizardStep === 1 && (
          <div className="space-y-6 max-w-xl mx-auto animate-fade-in">
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
              
              {/* Step Header */}
              <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-slate-50/50">
                <div>
                  <h2 className="text-sm font-bold text-slate-800">2. Apply Signature</h2>
                  <p className="text-xs text-slate-400 mt-0.5">Customize your legal signature configuration.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setWizardStep(0)}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-slate-400 hover:text-slate-600 transition-colors shrink-0"
                >
                  <ArrowLeft size={13} strokeWidth={2.5} /> Back to PDF
                </button>
              </div>

              <form className="p-6 space-y-6" onSubmit={onSignDocument}>
                
                {/* Full Legal Name */}
                <div className="space-y-2">
                  <label htmlFor="candidateName" className="block text-sm font-semibold text-slate-700">
                    Full Legal Name
                  </label>
                  <input
                    id="candidateName"
                    type="text"
                    required
                    className="block w-full px-4 py-2.5 bg-slate-50 focus:bg-white border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 rounded-xl text-slate-800 text-sm font-semibold transition-all"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Enter your full legal name"
                    disabled={isSigned}
                  />
                </div>

                {/* Draw vs Type Signature Choice Tabs */}
                <div className="space-y-3.5">
                  <div className="flex border border-slate-200/80 rounded-xl p-1 bg-slate-50">
                    <button
                      type="button"
                      onClick={() => setActiveTab('type')}
                      className={`flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all ${
                        activeTab === 'type' 
                          ? 'bg-white text-slate-800 shadow-sm border border-slate-200/50' 
                          : 'text-slate-400 hover:text-slate-600'
                      }`}
                    >
                      <Sparkles size={13} className="shrink-0" />
                      <span className="hidden sm:inline">Type Cursive Signature</span>
                      <span className="sm:hidden">Type</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('draw')}
                      className={`flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all ${
                        activeTab === 'draw' 
                          ? 'bg-white text-slate-800 shadow-sm border border-slate-200/50' 
                          : 'text-slate-400 hover:text-slate-600'
                      }`}
                    >
                      <Edit3 size={13} className="shrink-0" />
                      <span className="hidden sm:inline">Draw Signature Pad</span>
                      <span className="sm:hidden">Draw</span>
                    </button>
                  </div>

                  {/* Tab Contents: Typed Signature Cursive */}
                  {activeTab === 'type' && (
                    <div className="space-y-3">
                      <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Choose Signature Style</p>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {cursiveFonts.map((font) => (
                          <button
                            key={font.id}
                            type="button"
                            onClick={() => setSelectedFont(font.id)}
                            className={`p-4 border rounded-xl text-center transition-all ${
                              selectedFont === font.id
                                ? 'border-indigo-600 bg-indigo-50/50 text-indigo-900 ring-2 ring-indigo-500/20 shadow-sm'
                                : 'border-slate-200 hover:border-slate-300 text-slate-700 bg-slate-50/20'
                            }`}
                          >
                            <p className="text-[9px] uppercase font-bold tracking-wide text-slate-400">{font.name}</p>
                            <p 
                              className="text-2xl mt-2.5 truncate px-1" 
                              style={{ fontFamily: font.id }}
                            >
                              {name || 'Signature'}
                            </p>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Tab Contents: Draw Signature Canvas */}
                  {activeTab === 'draw' && (
                    <div className="space-y-3.5">
                      <div className="flex justify-between items-center">
                        <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Draw below</p>
                        <button
                          type="button"
                          onClick={clearCanvas}
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-400 hover:text-rose-500 hover:bg-rose-50 px-2 py-1 rounded transition-all"
                        >
                          <RotateCcw size={12} /> Clear Board
                        </button>
                      </div>

                      {/* Interactive Canvas Box */}
                      <div className="border border-slate-200 rounded-xl h-44 bg-slate-50/30 overflow-hidden relative shadow-inner">
                        <SignatureCanvas
                          onReady={(pad) => setSigPad(pad)}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Consent & Legally Binding Checks */}
                <div className="border border-indigo-100 bg-indigo-50/30 rounded-xl p-4.5 space-y-3">
                  <h3 className="text-xs font-bold text-indigo-950 flex items-center gap-1.5">
                    <CheckSquare size={14} className="text-indigo-600" />
                    Electronic Records Authorization
                  </h3>
                  <label className="flex items-start gap-3 cursor-pointer text-xs text-indigo-900 select-none leading-relaxed">
                    <input
                      type="checkbox"
                      checked={isConsentChecked}
                      onChange={(event) => setIsConsentChecked(event.target.checked)}
                      disabled={isSigned}
                      className="sr-only"
                    />
                    <div className={`w-5 h-5 border rounded-lg flex items-center justify-center shrink-0 transition-all mt-0.5 ${
                      isConsentChecked 
                        ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm' 
                        : 'border-slate-300 bg-white hover:border-slate-400'
                    }`}>
                      {isConsentChecked && <Check size={12} strokeWidth={3} />}
                    </div>
                    <span>
                      I confirm that my typed or hand-drawn signature here constitutes a legally binding, authorized signature, equivalent to a physical handwritten signature.
                    </span>
                  </label>
                </div>

                {/* Sign Complete button */}
                <button
                  type="submit"
                  disabled={isSubmitting || isSigned || !name || !isConsentChecked}
                  className="w-full inline-flex items-center justify-center gap-2 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 text-white disabled:text-slate-400 font-semibold text-sm rounded-xl transition-all shadow-md disabled:shadow-none hover:shadow-indigo-100"
                >
                  {isSubmitting ? (
                    <>
                      <span className="w-4 h-4 border-2 border-slate-400 border-t-white rounded-full animate-spin" />
                      Applying Secure Signature...
                    </>
                  ) : (
                    'Complete Signature & File'
                  )}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ═══ STEP 2: SIGNED COMPLETED ═══ */}
        {wizardStep === 2 && (
          <div className="max-w-md mx-auto py-8 animate-fade-in">
            <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-md text-center space-y-6">
              
              <div className="mx-auto w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center shadow-inner">
                <CheckCircle size={36} strokeWidth={2} />
              </div>

              <div className="space-y-2">
                <h2 className="text-xl font-bold text-slate-800">Signing Completed</h2>
                <p className="text-sm text-slate-400 leading-relaxed max-w-[320px] mx-auto">
                  Your offer letter has been signed, verified, and sent to your HR recruitment administrator.
                </p>
              </div>

              {/* Verified details panel */}
              <div className="border border-slate-100 bg-slate-50/50 rounded-xl p-4.5 text-left text-xs text-slate-500 space-y-2 font-medium">
                <div className="flex justify-between">
                  <span>Signee Name</span>
                  <span className="font-bold text-slate-800 truncate max-w-[180px]">{name || documentData?.status === 'signed' && 'Candidate'}</span>
                </div>
                <div className="flex justify-between">
                  <span>Security Token</span>
                  <span className="font-mono text-slate-700 bg-slate-100 px-1 rounded select-all truncate max-w-[150px]">{token}</span>
                </div>
                <div className="flex justify-between">
                  <span>Timestamp</span>
                  <span className="text-slate-700">{new Date().toLocaleString()}</span>
                </div>
              </div>

              {downloadUrl && (
                <div className="pt-2">
                  <a 
                    href={downloadUrl} 
                    className="w-full inline-flex items-center justify-center gap-2 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl transition-all shadow-md hover:shadow-emerald-100"
                    target="_blank" 
                    rel="noreferrer"
                  >
                    <Download size={16} strokeWidth={2.5} /> 
                    Download Signed PDF
                  </a>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {toast && (
        <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />
      )}
    </main>
  );
}
