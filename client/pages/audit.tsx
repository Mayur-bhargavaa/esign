import axios from 'axios';
import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { ClipboardList, ArrowLeft, CheckCircle2, Clock } from 'lucide-react';
import Toast from '../components/Toast';

const apiBaseUrl = process.env.NODE_ENV === 'production' || process.env.NEXT_PUBLIC_SINGLE_PORT === 'true'
  ? ''
  : process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';

type SignedLocation = {
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
  expiresAt: string;
  signedBy: string | null;
  signedAt: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  signedLocations: SignedLocation[];
};

function formatDate(value: string | null) {
  if (!value) return '-';
  return new Date(value).toLocaleString();
}

function getExpiryInfo(expiresAt: string, status: string) {
  if (status === 'signed') return null;
  const now = Date.now();
  const expiry = new Date(expiresAt).getTime();
  if (expiry < now) return { label: 'Expired', isExpired: true };
  const hoursLeft = Math.round((expiry - now) / (1000 * 60 * 60));
  if (hoursLeft < 1) {
    const minsLeft = Math.round((expiry - now) / (1000 * 60));
    return { label: `${minsLeft}m left`, isExpired: false };
  }
  return { label: `${hoursLeft}h left`, isExpired: false };
}

export default function AuditPage() {
  const [records, setRecords] = useState<AuditRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [tokenQuery, setTokenQuery] = useState('');
  const [selectedToken, setSelectedToken] = useState('');
  const [selectedRecord, setSelectedRecord] = useState<AuditRecord | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  useEffect(() => {
    async function fetchAudit() {
      try {
        setIsLoading(true);
        const response = await axios.get<AuditRecord[]>(`${apiBaseUrl}/api/audit`);
        setRecords(response.data);
      } catch (fetchError: any) {
        setToast({ message: fetchError?.response?.data?.error || 'Failed to load audit records.', type: 'error' });
      } finally {
        setIsLoading(false);
      }
    }

    fetchAudit();
  }, []);

  const filteredRecords = useMemo(() => {
    const trimmed = tokenQuery.trim().toLowerCase();
    if (!trimmed) return records;
    return records.filter(
      (record) =>
        record.token.toLowerCase().includes(trimmed) || record.candidateEmail.toLowerCase().includes(trimmed)
    );
  }, [records, tokenQuery]);

  const onSearchSingleToken = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!selectedToken.trim()) {
      setSelectedRecord(null);
      return;
    }

    try {
      const response = await axios.get<AuditRecord>(`${apiBaseUrl}/api/audit/${selectedToken.trim()}`);
      setSelectedRecord(response.data);
    } catch (fetchError: any) {
      setSelectedRecord(null);
      setToast({ message: fetchError?.response?.data?.error || 'Failed to load token details.', type: 'error' });
    }
  };

  return (
    <main className="app-shell">
      <section className="app-card">
        <div className="page-header">
          <div className="page-header-left">
            <div className="brand-icon">
              <ClipboardList size={20} strokeWidth={2.5} />
            </div>
            <div>
              <h1 className="page-title">Audit Trail</h1>
              <p className="page-subtitle">Track signatures, timestamps, expiry, and metadata.</p>
            </div>
          </div>
          <Link href="/" className="nav-link">
            <ArrowLeft size={15} strokeWidth={2} />
            Back to Admin
          </Link>
        </div>

        <div className="toolbar-grid">
          <input
            type="text"
            value={tokenQuery}
            onChange={(event) => setTokenQuery(event.target.value)}
            placeholder="Filter by token or email..."
            className="text-input"
          />

          <form onSubmit={onSearchSingleToken} className="inline-form">
            <input
              type="text"
              value={selectedToken}
              onChange={(event) => setSelectedToken(event.target.value)}
              placeholder="Paste exact token..."
              className="text-input"
            />
            <button type="submit" className="button-primary">
              Search
            </button>
          </form>
        </div>

        {isLoading ? (
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <span className="loading-spinner" style={{ width: '24px', height: '24px' }} />
            <p className="body-text" style={{ marginTop: '12px' }}>Loading audit records...</p>
          </div>
        ) : (
          <div className="audit-table-wrap">
            <table className="audit-table">
              <thead>
                <tr>
                  <th>Token</th>
                  <th>Candidate</th>
                  <th>Status</th>
                  <th>Expiry</th>
                  <th>Signed By</th>
                  <th>Signed At</th>
                  <th>IP Address</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
                      No records found
                    </td>
                  </tr>
                ) : (
                  filteredRecords.map((record) => {
                    const expiryInfo = getExpiryInfo(record.expiresAt, record.status);
                    return (
                      <tr key={record.token}>
                        <td className="token-cell">{record.token}</td>
                        <td>{record.candidateEmail}</td>
                        <td>
                          <span className={`status-pill ${record.status}`}>
                            {record.status === 'signed' ? <CheckCircle2 size={12} strokeWidth={3} /> : <Clock size={12} strokeWidth={3} />}
                            {record.status}
                          </span>
                        </td>
                        <td>
                          {expiryInfo ? (
                            <span className={`expiry-badge ${expiryInfo.isExpired ? 'expired' : 'active'}`}>
                              {expiryInfo.label}
                            </span>
                          ) : (
                            '-'
                          )}
                        </td>
                        <td>{record.signedBy || '-'}</td>
                        <td>{formatDate(record.signedAt)}</td>
                        <td>{record.ipAddress || '-'}</td>
                        <td>{formatDate(record.createdAt)}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {selectedRecord && (
          <div className="panel detail-panel">
            <h2 className="detail-title">Token Detail</h2>
            <p className="body-text"><strong>Token:</strong> {selectedRecord.token}</p>
            <p className="body-text"><strong>Signed By:</strong> {selectedRecord.signedBy || '-'}</p>
            <p className="body-text"><strong>Signed At:</strong> {formatDate(selectedRecord.signedAt)}</p>
            <p className="body-text"><strong>IP:</strong> {selectedRecord.ipAddress || '-'}</p>
            <p className="body-text"><strong>User Agent:</strong> {selectedRecord.userAgent || '-'}</p>

            <div>
              <p className="panel-title" style={{ marginTop: '14px' }}>Signed Locations</p>
              <ul className="detail-list">
                {selectedRecord.signedLocations.map((location, index) => (
                  <li key={`${location.page}-${location.x_pct}-${location.y_pct}-${index}`}>
                    Page {location.page + 1}, X {location.x_pct}, Y {location.y_pct}, Width {location.width_pct}
                  </li>
                ))}
              </ul>
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
