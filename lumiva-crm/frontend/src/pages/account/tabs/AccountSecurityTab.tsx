import React, { useEffect, useState } from 'react';
import { changeMyPassword, fetchMe, type MeDto } from '../../../api/users';
import { fetchStaff, type StaffUser } from '../../../api/staff';
import { getStoredUser, clearSession } from '../../../auth/session';
import {
  fetchApiTokensSummary,
  fetchMySessions,
  fetchSecurityLog,
  revokeMySession,
  revokeOtherSessions,
  setup2FA,
  verify2FA,
  disable2FA,
  regenerateBackupCodes,
  transferOwnership,
  deleteMyAccount,
  exportMyData,
  type AccountSession,
  type ApiTokenSummary,
  type SecurityLogItem,
} from '../../../api/account';

function formatDate(iso: string | null | undefined) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('ru-RU');
  } catch {
    return iso;
  }
}

function Modal({ title, onClose, children, foot }: { title: string; onClose: () => void; children: React.ReactNode; foot?: React.ReactNode }) {
  return (
    <div className="acc-modal-back" onClick={onClose}>
      <div className="acc-modal" onClick={(e) => e.stopPropagation()}>
        <div className="acc-modal-head">
          <h3>{title}</h3>
          <button type="button" className="acc-modal-close" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="acc-modal-body">{children}</div>
        {foot && <div className="acc-modal-foot">{foot}</div>}
      </div>
    </div>
  );
}

export const AccountSecurityTab: React.FC = () => {
  const storedUser = getStoredUser();
  const isOwner = String(storedUser?.role || '').toLowerCase() === 'owner';

  const [me, setMe] = useState<MeDto | null>(null);
  const [sessions, setSessions] = useState<AccountSession[]>([]);
  const [tokens, setTokens] = useState<ApiTokenSummary[]>([]);
  const [log, setLog] = useState<SecurityLogItem[]>([]);
  const [staff, setStaff] = useState<StaffUser[]>([]);

  const reloadAll = () => {
    fetchMe().then(setMe).catch(() => {});
    fetchMySessions().then(setSessions).catch(() => {});
    fetchApiTokensSummary().then(setTokens).catch(() => {});
    fetchSecurityLog().then((r) => setLog(r.items)).catch(() => {});
  };
  useEffect(() => {
    reloadAll();
    if (isOwner) fetchStaff().then(setStaff).catch(() => {});
  }, [isOwner]);

  // ---- пароль ----
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPassword2, setNewPassword2] = useState('');
  const [passSaving, setPassSaving] = useState(false);
  const [passError, setPassError] = useState<string | null>(null);
  const [passSuccess, setPassSuccess] = useState<string | null>(null);

  const handleChangePassword = async () => {
    setPassError(null);
    setPassSuccess(null);
    if (!oldPassword || !newPassword) {
      setPassError('Заполните оба поля');
      return;
    }
    if (newPassword !== newPassword2) {
      setPassError('Пароли не совпадают');
      return;
    }
    setPassSaving(true);
    try {
      await changeMyPassword(oldPassword, newPassword);
      setPassSuccess('Пароль изменён');
      setOldPassword('');
      setNewPassword('');
      setNewPassword2('');
    } catch (e: any) {
      setPassError(e.message || 'Не удалось сменить пароль');
    } finally {
      setPassSaving(false);
    }
  };

  // ---- 2FA ----
  const [tfaModal, setTfaModal] = useState<'setup' | 'disable' | 'codes' | null>(null);
  const [tfaQr, setTfaQr] = useState<string | null>(null);
  const [tfaSecret, setTfaSecret] = useState<string | null>(null);
  const [tfaCode, setTfaCode] = useState('');
  const [tfaPassword, setTfaPassword] = useState('');
  const [tfaBackupCodes, setTfaBackupCodes] = useState<string[] | null>(null);
  const [tfaBusy, setTfaBusy] = useState(false);
  const [tfaError, setTfaError] = useState<string | null>(null);

  const openSetup = async () => {
    setTfaError(null);
    setTfaBusy(true);
    try {
      const r = await setup2FA();
      setTfaQr(r.qrDataUrl);
      setTfaSecret(r.secret);
      setTfaModal('setup');
    } catch (e: any) {
      setTfaError(e?.message || 'Не удалось начать настройку');
    } finally {
      setTfaBusy(false);
    }
  };

  const confirmSetup = async () => {
    setTfaError(null);
    setTfaBusy(true);
    try {
      const r = await verify2FA(tfaCode);
      setTfaBackupCodes(r.backupCodes);
      setTfaModal('codes');
      setTfaCode('');
      reloadAll();
    } catch (e: any) {
      setTfaError(e?.message || 'Неверный код');
    } finally {
      setTfaBusy(false);
    }
  };

  const confirmDisable = async () => {
    setTfaError(null);
    setTfaBusy(true);
    try {
      await disable2FA(tfaPassword);
      setTfaModal(null);
      setTfaPassword('');
      reloadAll();
    } catch (e: any) {
      setTfaError(e?.message || 'Неверный пароль');
    } finally {
      setTfaBusy(false);
    }
  };

  const [regenBusy, setRegenBusy] = useState(false);
  const handleRegenerate = async () => {
    const password = window.prompt('Подтвердите пароль, чтобы пересоздать резервные коды');
    if (!password) return;
    setRegenBusy(true);
    try {
      const r = await regenerateBackupCodes(password);
      setTfaBackupCodes(r.backupCodes);
      setTfaModal('codes');
    } catch (e: any) {
      alert(e?.message || 'Не удалось пересоздать коды');
    } finally {
      setRegenBusy(false);
    }
  };

  // ---- сессии ----
  const revoke = async (id: string) => {
    await revokeMySession(id).catch(() => {});
    setSessions((prev) => prev.filter((s) => s.id !== id));
  };
  const revokeAllOthers = async () => {
    await revokeOtherSessions().catch(() => {});
    reloadAll();
  };

  // ---- опасная зона ----
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferTarget, setTransferTarget] = useState('');
  const [transferPassword, setTransferPassword] = useState('');
  const [transferBusy, setTransferBusy] = useState(false);
  const [transferError, setTransferError] = useState<string | null>(null);

  const handleTransfer = async () => {
    setTransferError(null);
    if (!transferTarget || !transferPassword) {
      setTransferError('Выберите сотрудника и введите пароль');
      return;
    }
    setTransferBusy(true);
    try {
      await transferOwnership(transferTarget, transferPassword);
      alert('Владение передано. Сейчас вы будете выйдены из системы.');
      clearSession();
      window.location.href = '/login';
    } catch (e: any) {
      setTransferError(e?.message || 'Не удалось передать владение');
    } finally {
      setTransferBusy(false);
    }
  };

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleDelete = async () => {
    setDeleteError(null);
    if (!deletePassword) {
      setDeleteError('Введите пароль');
      return;
    }
    setDeleteBusy(true);
    try {
      await deleteMyAccount(deletePassword);
      clearSession();
      window.location.href = '/login';
    } catch (e: any) {
      setDeleteError(e?.message || 'Не удалось удалить аккаунт');
    } finally {
      setDeleteBusy(false);
    }
  };

  const eligibleTargets = staff.filter((s) => s.role !== 'owner' && s.isActive);

  return (
    <div className="acc-grid">
      <div className="acc-col">
        <div className="acc-card">
          <div className="acc-card-head">
            <div>
              <h3>Двухфакторная защита</h3>
              <div className="sub">Второй фактор при входе с нового устройства.</div>
            </div>
            {me?.twoFactorEnabled ? (
              <span className="acc-pill ok">
                <span className="dot" />
                включена
              </span>
            ) : (
              <span className="acc-pill warn">
                <span className="dot" />
                выключена
              </span>
            )}
          </div>
          <div className="acc-body">
            {!me?.twoFactorEnabled ? (
              <div className="acc-note">
                <span>Пока 2FA выключена, доступ к аккаунту держится на одном пароле.</span>
              </div>
            ) : (
              <div className="acc-note ok">
                <span>Вход защищён кодом из приложения-аутентификатора. Если потеряете телефон или доступ к приложению — войдите с помощью одного из резервных кодов, которые вы сохранили при включении 2FA.</span>
              </div>
            )}
          </div>
          <div className="acc-foot">
            {me?.twoFactorEnabled ? (
              <>
                <button type="button" className="btn btn-sm" disabled={regenBusy} onClick={() => void handleRegenerate()}>
                  Пересоздать резервные коды
                </button>
                <button type="button" className="btn btn-sm btn-danger" onClick={() => setTfaModal('disable')}>
                  Выключить 2FA
                </button>
              </>
            ) : (
              <>
                <span>Приложение — Google Authenticator, 1Password, Authy</span>
                <button type="button" className="btn btn-sm btn-primary" disabled={tfaBusy} onClick={() => void openSetup()}>
                  Включить 2FA
                </button>
              </>
            )}
          </div>
        </div>

        <div className="acc-card">
          <div className="acc-card-head">
            <div>
              <h3>Пароль</h3>
            </div>
          </div>
          <div className="acc-body">
            {passError && (
              <div className="acc-note" style={{ marginBottom: 12 }}>
                <span>{passError}</span>
              </div>
            )}
            {passSuccess && (
              <div className="acc-note ok" style={{ marginBottom: 12 }}>
                <span>{passSuccess}</span>
              </div>
            )}
            <div className="acc-fields">
              <div className="acc-f wide">
                <label>Текущий пароль</label>
                <input className="acc-in" type="password" value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} autoComplete="current-password" />
              </div>
              <div className="acc-f">
                <label>Новый пароль</label>
                <input className="acc-in" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} autoComplete="new-password" />
              </div>
              <div className="acc-f">
                <label>Повторите пароль</label>
                <input className="acc-in" type="password" value={newPassword2} onChange={(e) => setNewPassword2(e.target.value)} autoComplete="new-password" />
              </div>
            </div>
          </div>
          <div className="acc-foot">
            <span>Все прочие сессии будут завершены</span>
            <button type="button" className="btn btn-sm btn-primary" disabled={passSaving} onClick={() => void handleChangePassword()}>
              {passSaving ? '…' : 'Сменить пароль'}
            </button>
          </div>
        </div>

        <div className="acc-card">
          <div className="acc-card-head">
            <div>
              <h3>Сессии и устройства</h3>
              <div className="sub">Завершение сессии моментально отзывает токен доступа.</div>
            </div>
            <button type="button" className="btn btn-sm" onClick={() => void revokeAllOthers()}>
              Завершить все, кроме этой
            </button>
          </div>
          <div className="acc-body tight">
            {sessions.map((s) => (
              <div key={s.id} className="acc-row">
                <div className="ic">{s.os === 'iOS' || s.os === 'Android' ? '📱' : '💻'}</div>
                <div>
                  <div className="t">
                    {s.os} · {s.browser}
                  </div>
                  <div className="d">{s.ip || '—'}</div>
                </div>
                <span className="when">{formatDate(s.lastSeenAt)}</span>
                {s.isCurrent ? (
                  <span className="acc-pill ok">
                    <span className="dot" />
                    это вы
                  </span>
                ) : (
                  <button type="button" className="btn btn-sm btn-danger" onClick={() => void revoke(s.id)}>
                    Завершить
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="acc-col">
        <div className="acc-card">
          <div className="acc-card-head">
            <h3>Ключи API</h3>
          </div>
          <div className="acc-body">
            {tokens.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--fg-3)' }}>Ключей пока нет</div>
            ) : (
              tokens.map((tok) => (
                <div key={tok.id} className="acc-kv">
                  <span className="k">{tok.name || 'Без имени'}</span>
                  <span className="v mono">{formatDate(tok.createdAt).slice(0, 10)}</span>
                </div>
              ))
            )}
            <a className="btn btn-sm" href="/app/settings/api-tokens" style={{ marginTop: 12 }}>
              Управлять ключами
            </a>
          </div>
        </div>

        <div className="acc-card">
          <div className="acc-card-head">
            <h3>События безопасности</h3>
          </div>
          <div className="acc-log">
            {log.length === 0 ? (
              <div className="acc-log-empty">Пока нет событий</div>
            ) : (
              log.map((l) => (
                <div key={l.id} className="acc-log-i">
                  <span className="tm">{formatDate(l.createdAt)}</span>
                  <span className="pt" />
                  <span className="tx">{l.summary}</span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="acc-card acc-danger">
          <div className="acc-card-head">
            <div>
              <h3>Опасная зона</h3>
              <div className="sub">Действия необратимы.</div>
            </div>
          </div>
          <div className="acc-body">
            <div className="acc-kv">
              <span className="k">Выгрузить мои данные</span>
              <button type="button" className="btn btn-sm" onClick={() => void exportMyData()}>
                Скачать
              </button>
            </div>
            {isOwner && (
              <div className="acc-kv">
                <span className="k">Передать владение</span>
                <button type="button" className="btn btn-sm" onClick={() => setTransferOpen(true)}>
                  Выбрать
                </button>
              </div>
            )}
            {!isOwner && (
              <div className="acc-kv">
                <span className="k">Удалить аккаунт</span>
                <button type="button" className="btn btn-sm btn-danger" onClick={() => setDeleteOpen(true)}>
                  Удалить
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {tfaModal === 'setup' && (
        <Modal
          title="Включить 2FA"
          onClose={() => setTfaModal(null)}
          foot={
            <>
              <button type="button" className="btn btn-sm" onClick={() => setTfaModal(null)}>
                Отмена
              </button>
              <button type="button" className="btn btn-sm btn-primary" disabled={tfaBusy || tfaCode.length < 6} onClick={() => void confirmSetup()}>
                Подтвердить
              </button>
            </>
          }
        >
          <p style={{ fontSize: 12.5, color: 'var(--fg-2)', margin: '0 0 4px' }}>
            Отсканируйте QR-код в приложении-аутентификаторе, затем введите 6-значный код.
          </p>
          {tfaQr && (
            <div className="acc-qr">
              <img src={tfaQr} alt="QR" />
            </div>
          )}
          {tfaSecret && (
            <div className="acc-kv">
              <span className="k">Секрет вручную</span>
              <span className="v mono">{tfaSecret}</span>
            </div>
          )}
          {tfaError && (
            <div className="acc-note" style={{ marginTop: 10 }}>
              <span>{tfaError}</span>
            </div>
          )}
          <div className="acc-f" style={{ marginTop: 12 }}>
            <label>Код из приложения</label>
            <input className="acc-in" value={tfaCode} onChange={(e) => setTfaCode(e.target.value)} placeholder="000000" />
          </div>
        </Modal>
      )}

      {tfaModal === 'disable' && (
        <Modal
          title="Выключить 2FA"
          onClose={() => setTfaModal(null)}
          foot={
            <>
              <button type="button" className="btn btn-sm" onClick={() => setTfaModal(null)}>
                Отмена
              </button>
              <button type="button" className="btn btn-sm btn-danger" disabled={tfaBusy} onClick={() => void confirmDisable()}>
                Выключить
              </button>
            </>
          }
        >
          {tfaError && (
            <div className="acc-note" style={{ marginBottom: 10 }}>
              <span>{tfaError}</span>
            </div>
          )}
          <div className="acc-f">
            <label>Подтвердите пароль</label>
            <input className="acc-in" type="password" value={tfaPassword} onChange={(e) => setTfaPassword(e.target.value)} />
          </div>
        </Modal>
      )}

      {tfaModal === 'codes' && tfaBackupCodes && (
        <Modal
          title="Резервные коды"
          onClose={() => setTfaModal(null)}
          foot={
            <button type="button" className="btn btn-sm btn-primary" onClick={() => setTfaModal(null)}>
              Готово
            </button>
          }
        >
          <p style={{ fontSize: 12.5, color: 'var(--fg-2)', margin: '0 0 4px' }}>
            Сохраните эти коды в надёжном месте. Если потеряете телефон или доступ к приложению-аутентификатору — войдите, используя один из них вместо обычного кода; каждый код работает только один раз.
          </p>
          <div className="acc-backup-codes">
            {tfaBackupCodes.map((c) => (
              <div key={c}>{c}</div>
            ))}
          </div>
        </Modal>
      )}

      {transferOpen && (
        <Modal
          title="Передать владение"
          onClose={() => setTransferOpen(false)}
          foot={
            <>
              <button type="button" className="btn btn-sm" onClick={() => setTransferOpen(false)}>
                Отмена
              </button>
              <button type="button" className="btn btn-sm btn-danger" disabled={transferBusy} onClick={() => void handleTransfer()}>
                Передать
              </button>
            </>
          }
        >
          {transferError && (
            <div className="acc-note" style={{ marginBottom: 10 }}>
              <span>{transferError}</span>
            </div>
          )}
          <div className="acc-f" style={{ marginBottom: 12 }}>
            <label>Новый владелец</label>
            <select className="acc-sel" value={transferTarget} onChange={(e) => setTransferTarget(e.target.value)}>
              <option value="">Выберите сотрудника</option>
              {eligibleTargets.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.fullName} ({s.email})
                </option>
              ))}
            </select>
          </div>
          <div className="acc-f">
            <label>Ваш пароль</label>
            <input className="acc-in" type="password" value={transferPassword} onChange={(e) => setTransferPassword(e.target.value)} />
          </div>
        </Modal>
      )}

      {deleteOpen && (
        <Modal
          title="Удалить аккаунт"
          onClose={() => setDeleteOpen(false)}
          foot={
            <>
              <button type="button" className="btn btn-sm" onClick={() => setDeleteOpen(false)}>
                Отмена
              </button>
              <button type="button" className="btn btn-sm btn-danger" disabled={deleteBusy} onClick={() => void handleDelete()}>
                Удалить
              </button>
            </>
          }
        >
          {deleteError && (
            <div className="acc-note" style={{ marginBottom: 10 }}>
              <span>{deleteError}</span>
            </div>
          )}
          <p style={{ fontSize: 12.5, color: 'var(--fg-2)', margin: '0 0 12px' }}>Действие необратимо. Вы будете выйдены из системы.</p>
          <div className="acc-f">
            <label>Подтвердите пароль</label>
            <input className="acc-in" type="password" value={deletePassword} onChange={(e) => setDeletePassword(e.target.value)} />
          </div>
        </Modal>
      )}
    </div>
  );
};
