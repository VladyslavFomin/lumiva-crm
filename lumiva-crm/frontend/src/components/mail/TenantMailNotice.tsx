import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { fetchNotificationSender, type NotificationSender } from '../../api/tenantMail';

/** Статус ящика для уведомлений: для форм с получателями писем и кнопок «Отправить». */
export function useNotificationSender() {
  const [st, setSt] = useState<NotificationSender | null>(null);
  useEffect(() => {
    let alive = true;
    fetchNotificationSender().then((x) => alive && setSt(x)).catch(() => alive && setSt(null));
    return () => {
      alive = false;
    };
  }, []);
  return st;
}

/**
 * Письма уходят с почты компании, а не с адреса платформы. Почта не подключена (или не выбран ящик) —
 * предупреждение «письма не отправляются» со ссылкой на настройку; подключена — тихая строка «с адреса …».
 */
export const TenantMailNotice: React.FC<{ showOk?: boolean; style?: React.CSSProperties }> = ({ showOk = true, style }) => {
  const { t } = useTranslation();
  const st = useNotificationSender();
  if (!st) return null;
  const box: React.CSSProperties = { fontSize: 12.5, lineHeight: 1.5, padding: '9px 12px', borderRadius: 10, ...style };
  if (st.account) {
    if (!showOk) return null;
    return (
      <div style={{ ...box, background: 'var(--bg-muted, #f4f5f7)', color: 'var(--fg-3, #6b7280)' }}>
        {t('crm.tenantMail.okLine', { email: st.account.email })}{' '}
        <Link to="/email" style={{ color: 'inherit', textDecoration: 'underline' }}>{t('crm.tenantMail.change')}</Link>
      </div>
    );
  }
  return (
    <div role="status" style={{ ...box, background: '#fdf3e2', color: '#7a5210' }}>
      <b>{t('crm.tenantMail.offTitle')}</b> {t(`crm.tenantMail.reason.${st.reason}`)}{' '}
      <Link to="/email" style={{ color: 'inherit', fontWeight: 600, textDecoration: 'underline' }}>{t('crm.tenantMail.setup')} →</Link>
    </div>
  );
};
