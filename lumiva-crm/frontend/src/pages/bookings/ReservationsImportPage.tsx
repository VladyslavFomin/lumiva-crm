import React, { useMemo, useRef, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MainLayout } from '../../layout/MainLayout';
import { PageHelpButton } from '../../components/help/PageHelpButton';
import { useAlertModal } from '../../contexts/AlertModalContext';
import { BookingsSubnav } from './BookingsSubnav';
import {
  previewReservationsImport,
  applyReservationsImport,
  fetchBookingLocations,
  type ReservationImportPreview,
  type ReservationImportResult,
  type BookingLocation,
} from '../../api/bookings';
import './bookings-design.css';

export const ReservationsImportPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { showAlert } = useAlertModal();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [locations, setLocations] = useState<BookingLocation[]>([]);
  const [defaultLocationId, setDefaultLocationId] = useState('');

  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<ReservationImportPreview | null>(null);
  const [columnToField, setColumnToField] = useState<Record<string, string>>({});
  const [mappableFields, setMappableFields] = useState<Array<{ key: string; label: string }>>([]);
  const [applying, setApplying] = useState(false);
  const [result, setResult] = useState<ReservationImportResult | null>(null);

  useEffect(() => {
    fetchBookingLocations().then(setLocations).catch(() => {});
  }, []);

  const handleFile = async (file: File) => {
    setLoading(true);
    try {
      const res = await previewReservationsImport(file);
      setPreview(res);
      setMappableFields(res.mappableFields);
      const inverted: Record<string, string> = {};
      for (const [fieldKey, column] of Object.entries(res.suggestedMapping || {})) {
        if (column) inverted[column] = fieldKey;
      }
      setColumnToField(inverted);
    } catch (err: any) {
      showAlert(err.message || t('crm.bookings.import.parseError'), { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const mappedCount = useMemo(
    () => (preview ? preview.columns.filter((c) => columnToField[c]).length : 0),
    [preview, columnToField],
  );

  const handleApply = async () => {
    if (!preview) return;
    setApplying(true);
    try {
      const mapping: Record<string, string | null> = {};
      for (const [column, fieldKey] of Object.entries(columnToField)) {
        if (!fieldKey) continue;
        mapping[fieldKey] = column;
      }
      const res = await applyReservationsImport({
        importId: preview.importId,
        mapping,
        defaultLocationId: defaultLocationId || undefined,
      });
      setResult(res);
    } catch (err: any) {
      showAlert(err.message || t('crm.bookings.import.applyError'), { variant: 'error' });
    } finally {
      setApplying(false);
    }
  };

  const resetPreview = () => {
    setPreview(null);
    setColumnToField({});
    setMappableFields([]);
    setResult(null);
  };

  return (
    <MainLayout>
      <PageHelpButton topic="reservationsImport" />
      <div className="px-scope">
        <BookingsSubnav active="reservations" />
        <button
          type="button"
          className="btn btn-sm"
          style={{ marginBottom: 12 }}
          onClick={() => navigate('/bookings/reservations')}
        >
          {t('crm.bookings.import.backToBookings')}
        </button>
        <div className="bk-hero">
          <div>
            <div className="kicker"><span className="dot" />{t('crm.bookings.import.kicker')}</div>
            <h1>{t('crm.bookings.import.title')}</h1>
            <p className="sub">{t('crm.bookings.import.subtitle')}</p>
          </div>
        </div>

        {result ? (
          <div className="bk-panel" style={{ maxWidth: 480, marginTop: 20 }}>
            <div className="bk-panel-head"><div className="t">{t('crm.bookings.import.result.title')}</div></div>
            <div className="bk-panel-body" style={{ padding: '0 18px 18px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, color: 'var(--fg-2)' }}>
              <div>{t('crm.bookings.import.result.created', { count: result.created })}</div>
              <div>{t('crm.bookings.import.result.errors', { count: result.errors.length })}</div>
              <div>{t('crm.bookings.import.result.total', { count: result.total })}</div>
            </div>
            {!!result.errors.length && (
              <div style={{ marginTop: 14, maxHeight: 200, overflowY: 'auto', border: '1px solid var(--line-2)', borderRadius: 8, padding: 10 }}>
                {result.errors.map((e, i) => (
                  <div key={i} style={{ fontSize: 12, color: '#9a1f31', marginBottom: 4 }}>
                    {t('crm.bookings.import.result.rowError', { row: e.row, message: e.message })}
                  </div>
                ))}
              </div>
            )}
            <button type="button" className="btn btn-primary btn-sm" style={{ marginTop: 16 }} onClick={() => navigate('/bookings/reservations')}>
              {t('crm.bookings.import.result.done')}
            </button>
            </div>
          </div>
        ) : !preview ? (
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            style={{
              marginTop: 20,
              border: '2px dashed var(--line-2)', borderRadius: 16, padding: '64px 24px', textAlign: 'center',
              cursor: 'pointer', background: 'var(--bg-muted)', color: 'var(--fg-3)', fontSize: 14,
            }}
          >
            {loading ? t('crm.bookings.import.dropzone.loading') : t('crm.bookings.import.dropzone.prompt')}
            <div style={{ marginTop: 14 }}>
              <button type="button" className="btn btn-sm" onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}>
                {t('crm.bookings.import.dropzone.chooseFile')}
              </button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              style={{ display: 'none' }}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
            />
          </div>
        ) : (
          <div style={{ marginTop: 20 }}>
            <div style={{ fontSize: 13, color: 'var(--fg-3)', marginBottom: 4 }}>
              {t('crm.bookings.import.preview.columnsRows', { columns: preview.columns.length, rows: preview.totalRows })}
            </div>
            <div style={{ fontSize: 13, color: 'var(--fg-3)', marginBottom: 16 }}>
              {t('crm.bookings.import.preview.mapped', { mapped: mappedCount, total: preview.columns.length })}
            </div>

            {locations.length > 1 && (
              <div className="bk-field" style={{ maxWidth: 320, marginBottom: 20 }}>
                <label>{t('crm.bookings.import.preview.defaultLocationLabel')}</label>
                <select className="bk-select" value={defaultLocationId} onChange={(e) => setDefaultLocationId(e.target.value)}>
                  <option value="">{t('crm.bookings.import.preview.notSelected')}</option>
                  {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              </div>
            )}

            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', marginBottom: 8 }}>
              {t('crm.bookings.import.preview.mappingTitle')}
            </div>
            <div className="bk-table-wrap" style={{ marginBottom: 20 }}>
              <table className="bk-table">
                <thead>
                  <tr>
                    <th>{t('crm.bookings.import.preview.colFileColumn')}</th>
                    <th>{t('crm.bookings.import.preview.colBookingField')}</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.columns.map((column) => {
                    const mappedKey = columnToField[column] || '';
                    return (
                      <tr key={column}>
                        <td style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={column}>
                          {column}
                        </td>
                        <td>
                          <select
                            className="bk-select"
                            style={{ minWidth: 200 }}
                            value={mappedKey}
                            onChange={(e) => setColumnToField((p) => ({ ...p, [column]: e.target.value }))}
                          >
                            <option value="">{t('crm.bookings.import.preview.notMapped')}</option>
                            {mappableFields.map((f) => (
                              <option key={f.key} value={f.key}>{f.label}</option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" className="btn btn-sm" onClick={resetPreview}>
                {t('crm.bookings.import.preview.back')}
              </button>
              <button type="button" className="btn btn-primary btn-sm" onClick={handleApply} disabled={applying}>
                {applying ? t('crm.bookings.import.preview.importingBtn') : t('crm.bookings.import.preview.importBtn')}
              </button>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
};
