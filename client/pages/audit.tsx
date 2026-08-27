import axios from 'axios';
import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { 
  ClipboardList, 
  ArrowLeft, 
  CheckCircle2, 
  Clock, 
  Search, 
  Activity, 
  ShieldAlert, 
  Calendar, 
  Globe, 
  User, 
  MapPin, 
  Cpu,
  Download,
  ArrowRight
} from 'lucide-react';
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
  return new Date(value).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
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
      setToast({ message: 'Token details loaded.', type: 'success' });
    } catch (fetchError: any) {
      setSelectedRecord(null);
      setToast({ message: fetchError?.response?.data?.error || 'Failed to load token details.', type: 'error' });
    }
  };

  return (
    <main className="min-h-screen bg-slate-50/50 py-8 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header section */}
        <header className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4 transition-all duration-300">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-indigo-600 text-white rounded-xl flex items-center justify-center shadow-md shadow-indigo-200">
              <ClipboardList size={24} strokeWidth={2} />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">Audit Trail Dashboard</h1>
              <p className="text-sm text-slate-500 mt-0.5">Trace legally binding e-signature records, timestamps, and geolocation tags.</p>
            </div>
          </div>
          <Link href="/" className="inline-flex items-center gap-2 px-4.5 py-2.5 bg-slate-100 hover:bg-slate-200/80 border border-slate-200 rounded-xl text-slate-700 hover:text-slate-900 font-semibold text-sm transition-all duration-200 shadow-sm shrink-0">
            <ArrowLeft size={15} strokeWidth={2.5} />
            Back to Admin Dashboard
          </Link>
        </header>

        {/* Filter Toolbar */}
        <section className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="relative rounded-xl shadow-sm">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <Search size={16} />
            </div>
            <input
              type="text"
              value={tokenQuery}
              onChange={(event) => setTokenQuery(event.target.value)}
              placeholder="Search by candidate email or token..."
              className="block w-full pl-10 pr-4 py-2.5 bg-slate-50/50 focus:bg-white border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 rounded-xl text-slate-800 text-sm font-medium transition-all"
            />
          </div>

          <form onSubmit={onSearchSingleToken} className="flex gap-2">
            <input
              type="text"
              value={selectedToken}
              onChange={(event) => setSelectedToken(event.target.value)}
              placeholder="Paste exact verification token..."
              className="block flex-1 px-4 py-2.5 bg-slate-50/50 focus:bg-white border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 rounded-xl text-slate-800 text-sm font-medium transition-all"
            />
            <button 
              type="submit" 
              className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl transition-all shadow-sm shrink-0"
            >
              Verify Token
            </button>
          </form>
        </section>

        {/* Audit Records Table */}
        <section className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex items-center gap-2">
            <Activity size={18} className="text-indigo-600" />
            <h2 className="text-base font-bold text-slate-900">Historical Signature Ledger</h2>
          </div>
          
          {isLoading ? (
            <div className="flex flex-col items-center py-20 gap-3">
              <span className="w-8 h-8 border-3 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
              <p className="text-sm font-semibold text-slate-400">Fetching audit logs...</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[900px]">
                <thead>
                  <tr className="bg-slate-50/75 border-b border-slate-100 text-xs font-bold text-slate-500 uppercase tracking-wider">
                    <th className="py-4 px-6">Verification Token</th>
                    <th className="py-4 px-6">Candidate</th>
                    <th className="py-4 px-6">Status</th>
                    <th className="py-4 px-6">Link Expiry</th>
                    <th className="py-4 px-6">Signee Name</th>
                    <th className="py-4 px-6">IP Address</th>
                    <th className="py-4 px-6">Created On</th>
                    <th className="py-4 px-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                  {filteredRecords.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-16 px-6 text-slate-400 font-medium">
                        No audit records matched your filter query.
                      </td>
                    </tr>
                  ) : (
                    filteredRecords.map((record) => {
                      const expiryInfo = getExpiryInfo(record.expiresAt, record.status);
                      const isSelected = selectedRecord?.token === record.token;
                      return (
                        <tr 
                          key={record.token} 
                          className={`hover:bg-slate-50/50 transition-colors cursor-pointer ${
                            isSelected ? 'bg-indigo-50/20 hover:bg-indigo-50/30' : ''
                          }`}
                          onClick={() => setSelectedRecord(record)}
                        >
                          <td className="py-4 px-6 font-mono text-xs text-indigo-600 font-bold truncate max-w-[150px]">{record.token}</td>
                          <td className="py-4 px-6 font-semibold text-slate-800">{record.candidateEmail}</td>
                          <td className="py-4 px-6">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                              record.status === 'signed' 
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' 
                                : 'bg-amber-50 text-amber-700 border border-amber-100'
                            }`}>
                              {record.status === 'signed' ? <CheckCircle2 size={11} strokeWidth={2.5} /> : <Clock size={11} strokeWidth={2.5} />}
                              {record.status}
                            </span>
                          </td>
                          <td className="py-4 px-6">
                            {expiryInfo ? (
                              <span className={`inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-lg ${
                                expiryInfo.isExpired 
                                  ? 'bg-rose-50 text-rose-700 border border-rose-100' 
                                  : 'bg-slate-100 text-slate-600 border border-slate-200'
                              }`}>
                                {expiryInfo.label}
                              </span>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </td>
                          <td className="py-4 px-6 font-medium text-slate-800">{record.signedBy || <span className="text-slate-300">-</span>}</td>
                          <td className="py-4 px-6 font-mono text-xs text-slate-500">{record.ipAddress || <span className="text-slate-300">-</span>}</td>
                          <td className="py-4 px-6 text-slate-400">{formatDate(record.createdAt)}</td>
                          <td className="py-4 px-6 text-right" onClick={(e) => e.stopPropagation()}>
                            {record.status === 'signed' ? (
                              <a
                                href={`${apiBaseUrl}/api/document/${record.token}/signed`}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-all"
                              >
                                <Download size={13} strokeWidth={2.5} />
                                Download
                              </a>
                            ) : (
                              <Link
                                href={`/sign/${record.token}`}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold shadow-sm transition-all"
                              >
                                <ArrowRight size={13} strokeWidth={2.5} />
                                Sign Page
                              </Link>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Detailed Record Inspector */}
        {selectedRecord && (
          <section className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6 animate-fade-in">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <ShieldAlert size={18} className="text-indigo-600" />
                Ledger Record Inspector
              </h2>
              <button 
                onClick={() => setSelectedRecord(null)}
                className="text-slate-400 hover:text-slate-600 text-xs font-semibold transition-colors"
              >
                Close Inspector
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Metadata rows */}
              <div className="space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Signature Metadata</h3>
                
                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-3 bg-slate-50/75 rounded-xl border border-slate-100">
                    <User className="text-slate-400 shrink-0" size={16} />
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Signee Legal Name</p>
                      <p className="text-sm font-semibold text-slate-800 truncate mt-0.5">
                        {selectedRecord.signedBy || 'Pending Signature'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-3 bg-slate-50/75 rounded-xl border border-slate-100">
                    <Calendar className="text-slate-400 shrink-0" size={16} />
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Signed Timestamp</p>
                      <p className="text-sm font-semibold text-slate-800 truncate mt-0.5">
                        {formatDate(selectedRecord.signedAt)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-3 bg-slate-50/75 rounded-xl border border-slate-100">
                    <Globe className="text-slate-400 shrink-0" size={16} />
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Audited IP Address</p>
                      <p className="text-sm font-mono font-bold text-slate-700 mt-0.5">
                        {selectedRecord.ipAddress || 'Unrecorded'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Signature locations & client device */}
              <div className="space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Audited Hardware & Coordinates</h3>

                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-3 bg-slate-50/75 rounded-xl border border-slate-100">
                    <Cpu className="text-slate-400 shrink-0" size={16} />
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Signee User Agent</p>
                      <p className="text-xs font-semibold text-slate-700 truncate mt-0.5" title={selectedRecord.userAgent || ''}>
                        {selectedRecord.userAgent || 'Unrecorded'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 bg-slate-50/75 rounded-xl border border-slate-100">
                    <MapPin className="text-slate-400 shrink-0 mt-0.5" size={16} />
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Document Stamp Coordinates</p>
                      <ul className="mt-1.5 space-y-1.5">
                        {selectedRecord.signedLocations.length === 0 ? (
                          <li className="text-xs text-slate-400 font-medium">No signature locations defined</li>
                        ) : (
                          selectedRecord.signedLocations.map((location, idx) => (
                            <li key={`${location.page}-${location.x_pct}-${location.y_pct}-${idx}`} className="text-xs text-slate-700 font-semibold flex items-center justify-between border-b border-slate-200/40 last:border-0 pb-1 last:pb-0">
                              <span>Page {location.page + 1}</span>
                              <span className="font-mono text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                                X: {(location.x_pct * 100).toFixed(1)}% | Y: {(location.y_pct * 100).toFixed(1)}%
                              </span>
                            </li>
                          ))
                        )}
                      </ul>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </section>
        )}

      </div>

      {toast && (
        <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />
      )}
    </main>
  );
}
