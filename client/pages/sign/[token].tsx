import axios from 'axios';
import { useRouter } from 'next/router';
import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { Check, ShieldCheck, Lock, FileCheck, ArrowRight, ArrowLeft, CheckCircle, Download } from 'lucide-react';
import Toast from '../../components/Toast';

const apiBaseUrl = process.env.NEXT_PUBLIC_SINGLE_PORT === 'true'
  ? ''
  : process.env.NEXT_PUBLIC_API_BASE_URL || 'https://esign.stitchbyte.in';

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

function StepProgress({ currentStep }: { currentStep: number }) {
  const steps = ['Review', 'Sign', 'Done'];
  return (
    <div className="step-progress">
      {steps.map((label, index) => {
        let className = 'step-item';
        if (index < currentStep) className += ' step-done';
        else if (index === currentStep) className += ' step-active';
        return (
          <div key={label} className={className}>
            <span className="step-number" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {index < currentStep ? <Check size={14} strokeWidth={3} /> : index + 1}
            </span>
            <span className="step-label">{label}</span>
          </div>
        );
      })}
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
  const [isConsentChecked, setIsConsentChecked] = useState(false);
  const [documentData, setDocumentData] = useState<DocumentPayload | null>(null);
  const [downloadUrl, setDownloadUrl] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSigned, setIsSigned] = useState(false);
  const [numPages, setNumPages] = useState(0);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Wizard step: 0 = Review, 1 = Sign, 2 = Done
  const [wizardStep, setWizardStep] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(800);

  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        setContainerWidth(Math.min(containerRef.current.clientWidth - 16, 800));
      }
    };
    // Initial update
    const timer = setTimeout(updateWidth, 50);
    window.addEventListener('resize', updateWidth);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', updateWidth);
    };
  }, [wizardStep]);

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

  const createTypedSignatureDataUrl = (typedName: string) => {
    const canvas = document.createElement('canvas');
    canvas.width = 700;
    canvas.height = 220;
    const context = canvas.getContext('2d');

    if (!context) {
      throw new Error('Could not create typed signature');
    }

    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = '#111827';
    context.font = '56px cursive';
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

    if (!documentData || documentData.signatureFields.length === 0) {
      setToast({ message: 'This document has no signature locations configured.', type: 'error' });
      return;
    }

    try {
      setIsSubmitting(true);
      const signatureDataUrl = createTypedSignatureDataUrl(name);

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

  // Loading state
  if (isLoading) {
    return (
      <main className="app-shell">
        <section className="app-card">
          <div style={{ textAlign: 'center', padding: '80px 20px' }}>
            <span className="loading-spinner" style={{ width: '28px', height: '28px' }} />
            <p className="body-text" style={{ marginTop: '14px' }}>Loading secure signing session...</p>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <section className="app-card">
        {/* Hero */}
        <div className="sign-hero">
          <p className="eyebrow">Secure eSignature</p>
          <h1 className="hero-title">Offer Letter Signing</h1>
          <p className="hero-copy">
            Review the document, confirm your consent, and complete a legally binding electronic signature.
          </p>
          <div className="badge-row">
            <span className="trust-badge"><ShieldCheck size={14} strokeWidth={2.5} /> Token Verified</span>
            <span className="trust-badge"><Lock size={14} strokeWidth={2.5} /> Single-use Link</span>
            <span className="trust-badge"><FileCheck size={14} strokeWidth={2.5} /> Audit Logged</span>
          </div>
        </div>

        {/* Step Progress */}
        <StepProgress currentStep={wizardStep} />

        {/* ═══ STEP 0: REVIEW ═══ */}
        {wizardStep === 0 && documentData && (
          <div className="wizard-step">
            <div className="wizard-step-header">
              <div>
                <h2 className="wizard-step-title">Review Your Offer Letter</h2>
                <p className="helper-text" style={{ marginTop: '4px' }}>
                  Please read through the entire document before proceeding.
                </p>
              </div>
            </div>

            <div className="preview-box preview-box-full" ref={containerRef}>
              <Document
                file={`${apiBaseUrl}${documentData.previewUrl}`}
                onLoadSuccess={({ numPages: pages }) => setNumPages(pages)}
              >
                {Array.from({ length: numPages }, (_, pageIndex) => (
                  <div key={`page-${pageIndex + 1}`} className="pdf-page-frame">
                    <Page pageNumber={pageIndex + 1} width={containerWidth} renderTextLayer={false} renderAnnotationLayer={false} />
                    <div className="marker-overlay">
                      {documentData.signatureFields
                        .map((field, index) => ({ field, index }))
                        .filter(({ field }) => field.page === pageIndex)
                        .map(({ field, index }) => (
                          <div
                            key={`${field.page}-${field.x_pct}-${field.y_pct}-${index}`}
                            className="marker-point marker-point-outline"
                            style={{ left: `${field.x_pct * 100}%`, top: `${field.y_pct * 100}%` }}
                          >
                            <span className="marker-point-label marker-point-label-outline">{index + 1}</span>
                          </div>
                        ))}
                    </div>
                  </div>
                ))}
              </Document>
              {numPages === 0 && <p className="empty-state">Loading document...</p>}
            </div>

            <div className="wizard-nav">
              <div />
              <button
                type="button"
                className="button-primary wizard-next-btn"
                onClick={() => setWizardStep(1)}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
              >
                Next — Proceed to Sign <ArrowRight size={16} strokeWidth={2.5} />
              </button>
            </div>
          </div>
        )}

        {/* ═══ STEP 1: SIGN ═══ */}
        {wizardStep === 1 && (
          <div className="wizard-step">
            <div className="wizard-step-header">
              <div>
                <h2 className="wizard-step-title">Complete Your Signature</h2>
                <p className="helper-text" style={{ marginTop: '4px' }}>
                  Enter your full legal name and confirm your consent.
                </p>
              </div>
              <button
                type="button"
                className="nav-link"
                onClick={() => setWizardStep(0)}
              >
                <ArrowLeft size={14} strokeWidth={2.5} /> Back to Review
              </button>
            </div>

            <div className="sign-form-centered">
              <form className="sign-form-card" onSubmit={onSignDocument}>
                <div className="panel">
                  <p className="eyebrow">Signature Details</p>
                  <p className="detail-note" style={{ marginTop: '8px' }}>
                    Required signature spots: <strong>{documentData?.signatureFields?.length || 0}</strong>
                  </p>
                </div>

                <div className="form-group">
                  <label htmlFor="candidateName" className="field-label">
                    Full Name
                  </label>
                  <input
                    id="candidateName"
                    type="text"
                    className="text-input"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Enter your full legal name"
                    disabled={isSigned}
                  />
                </div>

                <div className="panel">
                  <p className="eyebrow">Typed Signature Preview</p>
                  <p className="signature-script">
                    {name || 'Your signature'}
                  </p>
                </div>

                <label className="panel consent-row">
                  <input
                    type="checkbox"
                    checked={isConsentChecked}
                    onChange={(event) => setIsConsentChecked(event.target.checked)}
                    disabled={isSigned}
                    className="checkbox-input"
                  />
                  I confirm this electronic signature is legally binding and authorized by me.
                </label>

                <button
                  type="submit"
                  disabled={isSubmitting || isSigned}
                  className="button-primary"
                >
                  {isSubmitting ? (
                    <><span className="loading-spinner" /> Signing...</>
                  ) : (
                    'Complete Signature'
                  )}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ═══ STEP 2: DONE ═══ */}
        {wizardStep === 2 && (
          <div className="wizard-step">
            <div className="done-screen">
              <div className="done-icon"><CheckCircle size={48} strokeWidth={2.5} /></div>
              <h2 className="wizard-step-title">Document Signed Successfully</h2>
              <p className="body-text" style={{ textAlign: 'center', maxWidth: '460px', margin: '8px auto 0' }}>
                Your signature has been applied and the document is now legally binding. An audit trail has been recorded.
              </p>

              {downloadUrl && (
                <a href={downloadUrl} className="download-link" style={{ marginTop: '24px', maxWidth: '320px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Download size={18} strokeWidth={2.5} /> Download Signed PDF
                </a>
              )}
            </div>
          </div>
        )}
      </section>

      {toast && (
        <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />
      )}
    </main>
  );
}
