import React, { useRef, useState } from 'react';
import { previewCsvImport, importLeadsWithMapping } from '../../api/leads';

interface Props {
  open: boolean;
  onClose: () => void;
  onImported?: (count: number) => void;
}

type Step = 'upload' | 'mapping' | 'importing' | 'done';

// CRM lead fields available for mapping
const CRM_FIELDS: { value: string; label: string }[] = [
  { value: 'skip', label: '-- skip (ignore) --' },
  { value: 'firstName', label: 'First Name' },
  { value: 'lastName', label: 'Last Name' },
  { value: 'name', label: 'Full Name' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone' },
  { value: 'source', label: 'Source' },
  { value: 'status', label: 'Status' },
  { value: 'company', label: 'Company' },
  { value: 'notes', label: 'Notes' },
];

/** Auto-map a CSV column header to a CRM field key */
function autoMapColumn(header: string): string {
  const h = header.toLowerCase().replace(/[\s_-]+/g, '');
  if (h.includes('email')) return 'email';
  if (h.includes('phone') || h.includes('tel') || h.includes('mobile') || h.includes('cell')) return 'phone';
  if (h.includes('firstname') || h.includes('forename') || h.includes('givenname')) return 'firstName';
  if (h.includes('lastname') || h.includes('surname') || h.includes('familyname')) return 'lastName';
  if (h.includes('fullname') || h.includes('name')) return 'name';
  if (h.includes('source') || h.includes('origin')) return 'source';
  if (h.includes('status')) return 'status';
  if (h.includes('company') || h.includes('org') || h.includes('firm')) return 'company';
  if (h.includes('note') || h.includes('comment') || h.includes('desc')) return 'notes';
  return 'skip';
}

export function LeadsCsvImportModal({ open, onClose, onImported }: Props) {
  const [step, setStep] = useState<Step>('upload');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Preview state
  const [csvData, setCsvData] = useState('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [previewRows, setPreviewRows] = useState<string[][]>([]);
  const [totalRows, setTotalRows] = useState(0);

  // Mapping: csvColumn -> crmField
  const [mapping, setMapping] = useState<Record<string, string>>({});

  // Result
  const [result, setResult] = useState<{ imported: number; skipped: number; errors: number } | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setStep('upload');
    setLoading(false);
    setError('');
    setCsvData('');
    setHeaders([]);
    setPreviewRows([]);
    setTotalRows(0);
    setMapping({});
    setResult(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError('');
    setLoading(true);

    try {
      const text = await readFileAsText(file);
      setCsvData(text);

      const res = await previewCsvImport(text, true);
      setHeaders(res.headers);
      setPreviewRows(res.rows);
      setTotalRows(res.totalRows);

      // Auto-map columns
      const autoMapping: Record<string, string> = {};
      for (const h of res.headers) {
        autoMapping[h] = autoMapColumn(h);
      }
      setMapping(autoMapping);

      setStep('mapping');
    } catch (err: any) {
      setError(err?.message || 'Failed to parse CSV');
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    setStep('importing');
    setLoading(true);
    setError('');

    try {
      const res = await importLeadsWithMapping(csvData, mapping);
      setResult(res);
      setStep('done');
      if (onImported) onImported(res.imported);
    } catch (err: any) {
      setError(err?.message || 'Import failed');
      setStep('mapping');
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: 16,
          width: '100%',
          maxWidth: 720,
          maxHeight: '90vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px 16px',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>Import Leads from CSV</h2>
            <p style={{ margin: 0, fontSize: 12, color: '#64748b', marginTop: 2 }}>
              {step === 'upload' && 'Step 1: Upload your CSV file'}
              {step === 'mapping' && 'Step 2: Map columns to CRM fields'}
              {step === 'importing' && 'Importing leads...'}
              {step === 'done' && 'Import complete!'}
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: 22,
              cursor: 'pointer',
              color: '#94a3b8',
              lineHeight: 1,
            }}
          >
            &times;
          </button>
        </div>

        {/* Step indicator */}
        <div
          style={{
            display: 'flex',
            gap: 0,
            padding: '0 24px',
            background: '#f8fafc',
            borderBottom: '1px solid #e2e8f0',
          }}
        >
          {[
            { key: 'upload', label: '1. Upload' },
            { key: 'mapping', label: '2. Map columns' },
            { key: 'done', label: '3. Done' },
          ].map((s) => (
            <div
              key={s.key}
              style={{
                padding: '10px 0',
                marginRight: 24,
                borderBottom:
                  step === s.key || (step === 'importing' && s.key === 'mapping')
                    ? '2px solid #0f172a'
                    : '2px solid transparent',
                fontSize: 12,
                fontWeight:
                  step === s.key || (step === 'importing' && s.key === 'mapping') ? 700 : 400,
                color:
                  step === s.key || (step === 'importing' && s.key === 'mapping')
                    ? '#0f172a'
                    : '#94a3b8',
              }}
            >
              {s.label}
            </div>
          ))}
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>
          {/* STEP 1: UPLOAD */}
          {step === 'upload' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div
                style={{
                  border: '2px dashed #e2e8f0',
                  borderRadius: 12,
                  padding: 40,
                  textAlign: 'center',
                  cursor: 'pointer',
                }}
                onClick={() => fileRef.current?.click()}
              >
                <svg
                  width="32"
                  height="32"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#94a3b8"
                  strokeWidth="1.5"
                  style={{ margin: '0 auto 10px' }}
                >
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                <p style={{ margin: '0 0 6px', fontWeight: 600, fontSize: 14 }}>
                  Click to select a CSV file
                </p>
                <p style={{ margin: 0, fontSize: 12, color: '#94a3b8' }}>
                  Supports .csv files. First row should be column headers.
                </p>
              </div>

              <input
                ref={fileRef}
                type="file"
                accept=".csv,.txt"
                style={{ display: 'none' }}
                onChange={handleFileChange}
              />

              {loading && (
                <p style={{ textAlign: 'center', color: '#64748b', fontSize: 13 }}>
                  Loading preview...
                </p>
              )}

              {error && (
                <div
                  style={{
                    background: '#fef2f2',
                    border: '1px solid #fecaca',
                    borderRadius: 8,
                    padding: '10px 14px',
                    fontSize: 13,
                    color: '#dc2626',
                  }}
                >
                  {error}
                </div>
              )}

              <div style={{ fontSize: 12, color: '#64748b' }}>
                <strong>Supported columns:</strong> Full Name, First Name, Last Name, Email, Phone,
                Source, Status, Company, Notes
              </div>
            </div>
          )}

          {/* STEP 2: MAPPING */}
          {(step === 'mapping' || step === 'importing') && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ fontSize: 13, color: '#64748b' }}>
                <strong>{totalRows}</strong> row(s) detected.{' '}
                Map each CSV column to a CRM field below.
              </div>

              {/* Mapping table */}
              <div
                style={{
                  border: '1px solid #e2e8f0',
                  borderRadius: 10,
                  overflow: 'hidden',
                }}
              >
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: '#f8fafc' }}>
                      <th
                        style={{
                          padding: '10px 14px',
                          textAlign: 'left',
                          borderBottom: '1px solid #e2e8f0',
                          fontWeight: 600,
                          fontSize: 12,
                          color: '#64748b',
                          width: '40%',
                        }}
                      >
                        Your column
                      </th>
                      <th
                        style={{
                          padding: '10px 14px',
                          textAlign: 'left',
                          borderBottom: '1px solid #e2e8f0',
                          fontWeight: 600,
                          fontSize: 12,
                          color: '#64748b',
                          width: '40%',
                        }}
                      >
                        CRM field
                      </th>
                      <th
                        style={{
                          padding: '10px 14px',
                          textAlign: 'left',
                          borderBottom: '1px solid #e2e8f0',
                          fontWeight: 600,
                          fontSize: 12,
                          color: '#64748b',
                          width: '20%',
                        }}
                      >
                        Sample value
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {headers.map((header, colIdx) => (
                      <tr
                        key={header}
                        style={{ borderBottom: colIdx < headers.length - 1 ? '1px solid #f1f5f9' : 'none' }}
                      >
                        <td style={{ padding: '8px 14px', fontWeight: 500, color: '#334155' }}>
                          {header}
                        </td>
                        <td style={{ padding: '8px 14px' }}>
                          <select
                            value={mapping[header] || 'skip'}
                            onChange={(e) =>
                              setMapping((prev) => ({ ...prev, [header]: e.target.value }))
                            }
                            style={{
                              width: '100%',
                              border: '1px solid #e2e8f0',
                              borderRadius: 6,
                              padding: '5px 8px',
                              fontSize: 12,
                              background:
                                mapping[header] && mapping[header] !== 'skip' ? '#f0fdf4' : '#fff',
                            }}
                          >
                            {CRM_FIELDS.map((f) => (
                              <option key={f.value} value={f.value}>
                                {f.label}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td
                          style={{
                            padding: '8px 14px',
                            color: '#94a3b8',
                            fontSize: 12,
                            maxWidth: 140,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {previewRows[0]?.[colIdx] || ''}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Data preview */}
              {previewRows.length > 0 && (
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 6 }}>
                    Data preview (first {Math.min(previewRows.length, 3)} rows)
                  </div>
                  <div style={{ overflowX: 'auto' }}>
                    <table
                      style={{
                        width: '100%',
                        borderCollapse: 'collapse',
                        fontSize: 11,
                        border: '1px solid #e2e8f0',
                        borderRadius: 8,
                        overflow: 'hidden',
                      }}
                    >
                      <thead>
                        <tr style={{ background: '#f8fafc' }}>
                          {headers.map((h) => (
                            <th
                              key={h}
                              style={{
                                padding: '6px 10px',
                                textAlign: 'left',
                                borderBottom: '1px solid #e2e8f0',
                                color: '#64748b',
                                whiteSpace: 'nowrap',
                                fontWeight: 600,
                              }}
                            >
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {previewRows.slice(0, 3).map((row, i) => (
                          <tr
                            key={i}
                            style={{
                              borderBottom: i < 2 ? '1px solid #f1f5f9' : 'none',
                            }}
                          >
                            {row.map((cell, j) => (
                              <td
                                key={j}
                                style={{
                                  padding: '6px 10px',
                                  color: '#334155',
                                  maxWidth: 120,
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {cell}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {error && (
                <div
                  style={{
                    background: '#fef2f2',
                    border: '1px solid #fecaca',
                    borderRadius: 8,
                    padding: '10px 14px',
                    fontSize: 13,
                    color: '#dc2626',
                  }}
                >
                  {error}
                </div>
              )}
            </div>
          )}

          {/* STEP: DONE */}
          {step === 'done' && result && (
            <div style={{ textAlign: 'center', padding: '32px 16px' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}></div>
              <h3 style={{ margin: '0 0 12px', fontSize: 18, fontWeight: 700 }}>Import complete!</h3>
              <div
                style={{
                  display: 'inline-flex',
                  flexDirection: 'column',
                  gap: 8,
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: 12,
                  padding: '16px 32px',
                  textAlign: 'left',
                  minWidth: 200,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 32, fontSize: 14 }}>
                  <span style={{ color: '#64748b' }}>Imported</span>
                  <strong style={{ color: '#16a34a' }}>{result.imported}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 32, fontSize: 14 }}>
                  <span style={{ color: '#64748b' }}>Skipped (empty)</span>
                  <strong style={{ color: '#94a3b8' }}>{result.skipped}</strong>
                </div>
                {result.errors > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 32, fontSize: 14 }}>
                    <span style={{ color: '#64748b' }}>Errors</span>
                    <strong style={{ color: '#dc2626' }}>{result.errors}</strong>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '14px 24px',
            borderTop: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'space-between',
            gap: 8,
          }}
        >
          {step !== 'done' && step !== 'importing' ? (
            <>
              <button
                type="button"
                onClick={() => {
                  if (step === 'upload') handleClose();
                  else if (step === 'mapping') setStep('upload');
                }}
                style={{
                  padding: '8px 20px',
                  border: '1px solid #e2e8f0',
                  borderRadius: 8,
                  background: '#fff',
                  cursor: 'pointer',
                  fontSize: 13,
                }}
              >
                {step === 'upload' ? 'Cancel' : 'Back'}
              </button>

              {step === 'mapping' && (
                <button
                  type="button"
                  onClick={() => void handleImport()}
                  disabled={loading}
                  style={{
                    padding: '8px 24px',
                    border: 'none',
                    borderRadius: 8,
                    background: loading ? '#94a3b8' : '#0f172a',
                    color: '#fff',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    fontSize: 13,
                    fontWeight: 600,
                  }}
                >
                  Import {totalRows} lead{totalRows !== 1 ? 's' : ''}
                </button>
              )}
            </>
          ) : step === 'importing' ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 13, color: '#64748b' }}>Importing, please wait...</span>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleClose}
              style={{
                padding: '8px 24px',
                border: 'none',
                borderRadius: 8,
                background: '#0f172a',
                color: '#fff',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 600,
                marginLeft: 'auto',
              }}
            >
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// Helper: read file as text
function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file, 'UTF-8');
  });
}
