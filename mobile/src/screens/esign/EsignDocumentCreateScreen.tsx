import React, { useEffect, useMemo, useState } from 'react';
import { Text } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import {
  createEsignDocument, fetchEsignTemplates, fetchEsignAmountSuggestions,
  EsignTemplate, EsignAmountSuggestion,
} from '../../api/esign';
import { fetchContacts, Contact } from '../../api/contacts';
import { useCurrencyMode } from '../../context/CurrencyModeContext';
import { useTheme, fonts } from '../../theme/ThemeContext';
import { showToast } from '../../components/ui';
import { EntityFormShell, FieldCard, EntityField, ChipPicker } from '../../components/mg';

const PickLabel: React.FC<{ label: string; marginTop?: number }> = ({ label, marginTop }) => {
  const { colors } = useTheme();
  return <Text style={{ fontSize: 11.5, fontFamily: fonts.regular, color: colors.textSecondary, marginBottom: 6, marginTop }}>{label}</Text>;
};

function todayStr() {
  return new Date().toLocaleDateString('ru-RU', { day: '2-digit', month: 'long', year: 'numeric' });
}

export const EsignDocumentCreateScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { codes } = useCurrencyMode();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [templates, setTemplates] = useState<EsignTemplate[]>([]);
  const [contactId, setContactId] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [suggestions, setSuggestions] = useState<EsignAmountSuggestion[]>([]);
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('EUR');
  const [contractDate, setContractDate] = useState(todayStr());
  const [service, setService] = useState('');
  const [term, setTerm] = useState('');
  const [payTerms, setPayTerms] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchContacts().then(setContacts).catch(() => {});
    fetchEsignTemplates().then(setTemplates).catch(() => {});
  }, []);

  useEffect(() => { if (codes[0]) setCurrency(codes[0]); }, [codes]);

  useEffect(() => {
    if (!contactId) { setSuggestions([]); return; }
    fetchEsignAmountSuggestions(contactId).then((rows) => {
      setSuggestions(rows);
      if (rows[0] && !amount) {
        setAmount(rows[0].amount);
        if (rows[0].currency) setCurrency(rows[0].currency);
      }
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contactId]);

  const selectedContact = useMemo(() => contacts.find((c) => c.id === contactId), [contacts, contactId]);
  const selectedTemplate = useMemo(() => templates.find((t) => t.id === templateId), [templates, templateId]);

  const missing = [
    ...(!contactId ? ['клиент'] : []),
    ...(!templateId ? ['шаблон'] : []),
  ];

  const submit = async () => {
    setSaving(true);
    try {
      const extraFields: Record<string, string> = {};
      if (amount.trim()) extraFields.AMOUNT = amount.trim();
      if (currency) extraFields.CURRENCY = currency;
      if (contractDate.trim()) extraFields.CONTRACT_DATE = contractDate.trim();
      if (service.trim()) extraFields.SERVICE = service.trim();
      if (term.trim()) extraFields.TERM = term.trim();
      if (payTerms.trim()) extraFields.PAY_TERMS = payTerms.trim();
      const doc = await createEsignDocument({ templateId, contactId, extraFields });
      showToast('Документ создан', { variant: 'success' });
      navigation.replace('EsignDocumentDetail', { id: doc.id });
    } catch (e: any) {
      const msg = e?.response?.data?.message;
      showToast((Array.isArray(msg) ? msg.join(', ') : msg) || 'Не удалось создать документ', { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <EntityFormShell
      title="Новый документ" kicker="Подписание" sub="Товары/услуги в документе и правка текста шаблона — на ПК"
      missing={missing} entityLabel="документ" saving={saving}
      onCancel={() => navigation.goBack()} onSave={submit}
    >
      <FieldCard icon="person-outline" title="Клиент и шаблон">
        <PickLabel label="Клиент" />
        <ChipPicker options={contacts.slice(0, 30).map((c) => ({ key: c.id, label: c.fullName }))} value={contactId} onChange={setContactId} />
        <PickLabel label="Шаблон документа" marginTop={12} />
        <ChipPicker options={templates.map((t) => ({ key: t.id, label: `${t.kind}: ${t.name}` }))} value={templateId} onChange={setTemplateId} />
        {selectedTemplate?.description ? (
          <Text style={{ fontSize: 11.5, color: '#8a8f98', marginTop: 8 }}>{selectedTemplate.description}</Text>
        ) : null}
      </FieldCard>

      {contactId && (
        <FieldCard icon="cash-outline" title="Сумма и условия">
          {suggestions.length > 0 && (
            <>
              <PickLabel label={`Сумма из карточки клиента (${selectedContact?.fullName || ''})`} />
              <ChipPicker
                options={suggestions.map((s) => ({ key: `${s.source}:${s.refId}`, label: `${s.label} · ${s.amount} ${s.currency}` }))}
                value=""
                onChange={(key) => {
                  const s = suggestions.find((x) => `${x.source}:${x.refId}` === key);
                  if (s) { setAmount(s.amount); if (s.currency) setCurrency(s.currency); }
                }}
              />
            </>
          )}
          <EntityField label="Сумма договора" value={amount} onChangeText={setAmount} placeholder="0" keyboardType="numeric" />
          <PickLabel label="Валюта" />
          <ChipPicker options={codes.map((c) => ({ key: c, label: c }))} value={currency} onChange={setCurrency} />
          <EntityField label="Дата договора" value={contractDate} onChangeText={setContractDate} placeholder="12 сентября 2026" />
          <EntityField label="Предмет договора" value={service} onChangeText={setService} placeholder="Оказание услуг по…" multiline />
          <EntityField label="Срок оказания" value={term} onChangeText={setTerm} placeholder="30 дней с даты подписания" />
          <EntityField label="Условия оплаты" value={payTerms} onChangeText={setPayTerms} placeholder="100% предоплата" />
        </FieldCard>
      )}
    </EntityFormShell>
  );
};
