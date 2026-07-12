// src/pages/products/ProductBarcodePreview.tsx
import React, { useEffect, useRef, useState } from 'react';
import JsBarcode from 'jsbarcode';
import QRCode from 'qrcode';
import { useTranslation } from 'react-i18next';

const LINE = '#e7e7e7';
const FG3 = '#888';

/** Превью штрихкода (Code128) и QR-кода для значения barcode/sku — для печати этикеток. */
export const ProductBarcodePreview: React.FC<{ value: string }> = ({ value }) => {
  const { t } = useTranslation();
  const svgRef = useRef<SVGSVGElement>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [barcodeError, setBarcodeError] = useState(false);

  useEffect(() => {
    if (!value || !svgRef.current) return;
    try {
      JsBarcode(svgRef.current, value, { format: 'CODE128', height: 40, fontSize: 11, margin: 4 });
      setBarcodeError(false);
    } catch {
      setBarcodeError(true);
    }
  }, [value]);

  useEffect(() => {
    if (!value) {
      setQrDataUrl(null);
      return;
    }
    let alive = true;
    QRCode.toDataURL(value, { width: 96, margin: 1 })
      .then((url) => { if (alive) setQrDataUrl(url); })
      .catch(() => { if (alive) setQrDataUrl(null); });
    return () => { alive = false; };
  }, [value]);

  if (!value) return null;

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-start', marginTop: 10, padding: 12, border: `1px solid ${LINE}`, borderRadius: 10 }}>
      <div style={{ maxWidth: '100%', overflowX: 'auto' }}>
        <svg ref={svgRef} style={{ display: barcodeError ? 'none' : 'block', maxWidth: '100%', height: 'auto' }} />
        {barcodeError && <div style={{ fontSize: 11, color: FG3 }}>{t('crm.products.form.fields.barcodeInvalid')}</div>}
      </div>
      {qrDataUrl && (
        <div style={{ textAlign: 'center' }}>
          <img src={qrDataUrl} alt="QR" width={64} height={64} />
          <div style={{ fontSize: 9, color: FG3, marginTop: 2 }}>QR</div>
        </div>
      )}
    </div>
  );
};
