import axios from 'axios';
import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import Toast from '../components/Toast';
import { FileText, ClipboardList, Plus, X, Pointer, Check, Copy, CheckCircle2, Clock } from 'lucide-react';

const apiBaseUrl = process.env.NEXT_PUBLIC_SINGLE_PORT === 'true'
  ? ''
  : process.env.NEXT_PUBLIC_API_BASE_URL || 'https://esign.stitchbyte.in';

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

  // Resize logic for responsive PDF
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(720);

  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        setContainerWidth(Math.min(containerRef.current.clientWidth - 16, 720));
      }
    };
    const timer = setTimeout(updateWidth, 50);
    window.addEventListener('resize', updateWidth);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', updateWidth);
    };
  }, [previewUrl]);

  // Toast state
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Dashboard stats
  const [recentDocs, setRecentDocs] = useState<AuditRecord[]>([]);
  const [stats, setStats] = useState({ total: 0, pending: 0, signed: 0 });

  useEffect(() => {
    async function fetchStats() {
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
    }
    fetchStats();
  }, []);

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
      const auditResponse = await axios.get<AuditRecord[]>(`${apiBaseUrl}/api/audit`);
      const records = auditResponse.data;
      setRecentDocs(records.slice(0, 5));
      setStats({
        total: records.length,
        pending: records.filter((r) => r.status === 'pending').length,
        signed: records.filter((r) => r.status === 'signed').length
      });
    } catch (error: any) {
      setToast({ message: error?.response?.data?.error || 'Failed to upload and send signing link.', type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="app-shell">
      <section className="app-card">
        <div className="page-header">
          <div className="page-header-left">
            <div className="brand-icon">
              <FileText size={20} strokeWidth={2.5} />
            </div>
            <div>
              <h1 className="page-title">Offer Letter Admin</h1>
              <p className="page-subtitle">Upload PDF, place signature locations, and send the signing link.</p>
            </div>
          </div>
          <Link href="/audit" className="nav-link">
            <ClipboardList size={15} strokeWidth={2} />
            View Audit
          </Link>
        </div>

        {/* Dashboard Stats */}
        <div className="stats-grid">
          <div className="stat-card">
            <p className="stat-label">Total Sent</p>
            <p className="stat-value">{stats.total}</p>
          </div>
          <div className="stat-card">
            <p className="stat-label">Pending</p>
            <p className="stat-value stat-pending">{stats.pending}</p>
          </div>
          <div className="stat-card">
            <p className="stat-label">Signed</p>
            <p className="stat-value stat-signed">{stats.signed}</p>
          </div>
        </div>

        <form className="two-column-layout" onSubmit={onSubmit}>
          <aside className="sidebar-stack sticky-sidebar">
            <div className="form-group">
              <label htmlFor="candidateEmail" className="field-label">
                Candidate Email
              </label>
              <input
                id="candidateEmail"
                type="email"
                className="text-input"
                value={candidateEmail}
                onChange={(event) => setCandidateEmail(event.target.value)}
                placeholder="candidate@example.com"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="pdfFile" className="field-label">
                Offer Letter PDF
              </label>
              <input
                id="pdfFile"
                type="file"
                accept="application/pdf"
                className="file-input"
                onChange={(event) => setFile(event.target.files?.[0] || null)}
                required
              />
            </div>

            <div className="panel">
              <div className="panel-row">
                <p className="panel-title">Signature Fields</p>
                <button
                  type="button"
                  onClick={() => setIsPlacingField((previous) => !previous)}
                  className="button-secondary"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  {isPlacingField ? <><X size={14} strokeWidth={2.5} /> Cancel</> : <><Plus size={14} strokeWidth={2.5} /> Place field</>}
                </button>
              </div>

              <p className="helper-text" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                {isPlacingField ? <><Pointer size={14} /> Click on the PDF preview to place a field.</> : 'Placement mode is off.'}
              </p>

              <p className="count-text">Count: {signatureFields.length}</p>

              {signatureFields.length > 0 && (
                <div className="chip-list">
                  {signatureFields.map((field, index) => (
                    <button
                      key={`remove-${field.page}-${field.x_pct}-${field.y_pct}-${index}`}
                      type="button"
                      onClick={() => removeSignatureField(index)}
                      className="button-chip"
                      style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                      <X size={12} strokeWidth={3} /> #{index + 1} (P{field.page + 1})
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="button-primary"
            >
              {isSubmitting ? (
                <><span className="loading-spinner" /> Sending...</>
              ) : (
                'Upload & Send Link'
              )}
            </button>
          </aside>

          <section className="content-stack">
            <p className="preview-title">PDF Preview</p>
            <div className="preview-box" ref={containerRef}>
              {previewUrl ? (
                <Document file={previewUrl} onLoadSuccess={({ numPages: pages }) => setNumPages(pages)}>
                  {Array.from({ length: numPages }, (_, pageIndex) => (
                    <div
                      key={`page-${pageIndex + 1}`}
                      className="pdf-page-wrap"
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
                      <Page pageNumber={pageIndex + 1} width={containerWidth} renderTextLayer={false} renderAnnotationLayer={false} />
                      <div className="marker-overlay">
                        {signatureFields
                          .map((field, index) => ({ field, index }))
                          .filter(({ field }) => field.page === pageIndex)
                          .map(({ field, index }) => (
                            <div
                              key={`${field.page}-${field.x_pct}-${field.y_pct}-${index}`}
                              className="marker-point marker-point-filled"
                              style={{ left: `${field.x_pct * 100}%`, top: `${field.y_pct * 100}%` }}
                            >
                              <span className="marker-point-label">{index + 1}</span>
                            </div>
                          ))}
                      </div>
                    </div>
                  ))}
                </Document>
              ) : (
                <p className="empty-state">Upload a PDF to show preview here.</p>
              )}
              {previewUrl && numPages === 0 && <p className="empty-state">Loading PDF preview...</p>}
            </div>
          </section>
        </form>

        {/* Signing Link with Copy */}
        {signingLink && (
          <div className="link-row">
            <a href={signingLink}>{signingLink}</a>
            <button type="button" className={`copy-btn ${isCopied ? 'copied' : ''}`} onClick={copyLink} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              {isCopied ? <><Check size={14} strokeWidth={3} /> Copied!</> : <><Copy size={14} /> Copy</>}
            </button>
          </div>
        )}

        {/* Recent Documents */}
        {recentDocs.length > 0 && (
          <div className="recent-section">
            <h2 className="section-title">Recent Documents</h2>
            <table className="recent-table">
              <thead>
                <tr>
                  <th>Candidate</th>
                  <th>Status</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {recentDocs.map((doc) => (
                  <tr key={doc.token}>
                    <td>{doc.candidateEmail}</td>
                    <td>
                      <span className={`status-pill ${doc.status}`}>
                        {doc.status === 'signed' ? <CheckCircle2 size={12} strokeWidth={3} /> : <Clock size={12} strokeWidth={3} />}
                        {doc.status}
                      </span>
                    </td>
                    <td>{new Date(doc.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

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
