import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import {
  fetchReservation, updateReservation, fetchBookingServices, fetchBookingLocations, fetchBookingResources,
  Reservation, BookingService, BookingLocation, BookingResource,
} from '../../api/bookings';
import { fetchStaff, Staff } from '../../api/staff';
import { useCurrencyMode } from '../../context/CurrencyModeContext';
import { DateCalendar } from '../../components/ui/DateCalendar';
import { parseIsoDate, toIsoDate } from '../../utils/dateValues';
import { useTheme, fonts } from '../../theme/ThemeContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { showToast } from '../../components/ui';
import { EntityFormShell, FieldCard, EntityField, ChipPicker } from '../../components/mg';

const PAYMENT_STATUSES = ['not_required', 'unpaid', 'deposit_paid', 'paid', 'partially_refunded', 'refunded', 'failed'] as const;
const pad = (n: number) => String(n).padStart(2, '0');

const PickLabel: React.FC<{ label: string }> = ({ label }) => {
  const { colors } = useTheme();
  return <Text style={{ fontSize: 11.5, fontFamily: fonts.regular, color: colors.textSecondary, marginBottom: 6 }}>{label}</Text>;
};

/** Edit booking — the fields of the website's "Edit booking" modal: date + start time + duration, location, service, staff, resource,
 *  participants, price + currency, payment status. The server re-validates staff/resource conflicts and returns a readable error. */
export const BookingEditScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { id } = useRoute<any>().params as { id: string };
  const { t } = useLanguage();
  const { colors } = useTheme();
  const { codes } = useCurrencyMode();

  const [original, setOriginal] = useState<Reservation | null>(null);
  const [locationId, setLocationId] = useState('');
  const [serviceId, setServiceId] = useState('');
  const [staffUserId, setStaffUserId] = useState('');
  const [resourceId, setResourceId] = useState('');
  const [date, setDate] = useState<string | null>(null);
  const [time, setTime] = useState('10:00');
  const [duration, setDuration] = useState('60');
  const [participants, setParticipants] = useState('1');
  const [price, setPrice] = useState('');
  const [currency, setCurrency] = useState('EUR');
  const [paymentStatus, setPaymentStatus] = useState('unpaid');
  const [locations, setLocations] = useState<BookingLocation[]>([]);
  const [services, setServices] = useState<BookingService[]>([]);
  const [resources, setResources] = useState<BookingResource[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      fetchReservation(id), fetchBookingLocations().catch(() => []), fetchBookingServices().catch(() => []),
      fetchBookingResources().catch(() => []), fetchStaff().catch(() => [] as Staff[]),
    ]).then(([r, loc, svc, res, sf]) => {
      setOriginal(r);
      setLocationId(r.locationId); setServiceId(r.serviceId || ''); setStaffUserId(r.staffUserId || ''); setResourceId(r.resourceId || '');
      const start = new Date(r.startAt); const end = new Date(r.endAt);
      setDate(toIsoDate(start)); setTime(`${pad(start.getHours())}:${pad(start.getMinutes())}`);
      setDuration(String(Math.max(1, Math.round((end.getTime() - start.getTime()) / 60000))));
      setParticipants(String(r.participants)); setPrice(r.price != null ? String(r.price) : '');
      setCurrency(r.currency || 'EUR'); setPaymentStatus(r.paymentStatus);
      setLocations(loc); setServices(svc); setResources(res); setStaff(sf);
    }).catch(() => { showToast(t('bookingDetail.loadError'), { variant: 'error' }); navigation.goBack(); })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const locationResources = useMemo(() => resources.filter((r) => r.locationId === locationId), [resources, locationId]);
  const currencyOptions = useMemo(() => (codes.includes(currency) ? codes : [...codes, currency]).map((c) => ({ key: c, label: c })), [codes, currency]);
  const timeOk = /^([01]\d|2[0-3]):[0-5]\d$/.test(time);
  const missing = [
    ...(!date ? [t('bookingEdit.field.date')] : []),
    ...(!timeOk ? [t('bookingEdit.field.time')] : []),
    ...(!(Number(duration) > 0) ? [t('bookingEdit.field.duration')] : []),
    ...(price.trim() !== '' && !Number.isFinite(Number(price.replace(',', '.'))) ? [t('bookingDetail.prop.price')] : []),
  ];

  const submit = async () => {
    if (!original || !date) return;
    setSaving(true);
    try {
      const startAt = new Date(`${date}T${time}:00`);
      const endAt = new Date(startAt.getTime() + (Number(duration) || 60) * 60000);
      await updateReservation(id, {
        locationId,
        serviceId: serviceId || null,
        staffUserId: staffUserId || null,
        resourceId: resourceId || null,
        startAt: startAt.toISOString(),
        endAt: endAt.toISOString(),
        participants: Math.max(1, Number(participants) || 1),
        price: price.trim() ? price.trim().replace(',', '.') : null,
        currency,
        paymentStatus,
      });
      showToast(t('bookingEdit.saved'), { variant: 'success' });
      navigation.goBack();
    } catch (e: any) {
      const msg = e?.response?.data?.message;
      showToast((Array.isArray(msg) ? msg.join(', ') : msg) || t('bookingEdit.saveError'), { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}><ActivityIndicator color={colors.ink} /></View>;

  return (
    <EntityFormShell
      title={t('bookingEdit.title')} kicker={t('more.item.bookings')} sub={original?.customerName || ''}
      missing={missing} entityLabel={t('bookingEdit.entityLabel')} saving={saving}
      onCancel={() => navigation.goBack()} onSave={submit}
    >
      <FieldCard icon="calendar-outline" title={t('bookingEdit.section.when')}>
        <DateCalendar mode="single" value={date} onChange={(v) => v && setDate(v)} initialMonth={parseIsoDate(date) || undefined} />
        <EntityField label={t('bookingEdit.field.time')} value={time} onChangeText={setTime} placeholder="HH:mm" keyboardType="numbers-and-punctuation" />
        <EntityField label={t('bookingEdit.field.duration')} value={duration} onChangeText={setDuration} keyboardType="numeric" />
      </FieldCard>

      <FieldCard icon="location-outline" title={t('bookingEdit.section.what')}>
        <PickLabel label={t('bookingDetail.prop.location')} />
        <View style={{ marginBottom: 12 }}>
          <ChipPicker options={locations.map((l) => ({ key: l.id, label: l.name }))} value={locationId} onChange={(v: string) => { setLocationId(v); setResourceId(''); }} />
        </View>
        <PickLabel label={t('bookingDetail.prop.service')} />
        <View style={{ marginBottom: 12 }}>
          <ChipPicker options={[{ key: '', label: t('linkPicker.none') }, ...services.map((s) => ({ key: s.id, label: s.name }))]} value={serviceId} onChange={setServiceId} />
        </View>
        <PickLabel label={t('bookingDetail.prop.staff')} />
        <View style={{ marginBottom: 12 }}>
          <ChipPicker options={[{ key: '', label: t('linkPicker.none') }, ...staff.map((s) => ({ key: s.id, label: s.fullName }))]} value={staffUserId} onChange={setStaffUserId} />
        </View>
        {locationResources.length > 0 && (
          <>
            <PickLabel label={t('bookingDetail.prop.resource')} />
            <ChipPicker options={[{ key: '', label: t('linkPicker.none') }, ...locationResources.map((r) => ({ key: r.id, label: r.name }))]} value={resourceId} onChange={setResourceId} />
          </>
        )}
      </FieldCard>

      <FieldCard icon="cash-outline" title={t('bookingEdit.section.payment')}>
        <EntityField label={t('bookingDetail.prop.participants')} value={participants} onChangeText={setParticipants} keyboardType="numeric" />
        <EntityField label={t('bookingDetail.prop.price')} value={price} onChangeText={setPrice} keyboardType="numeric" />
        <PickLabel label={t('leadCreate.field.currency')} />
        <View style={{ marginBottom: 12 }}><ChipPicker options={currencyOptions} value={currency} onChange={setCurrency} /></View>
        <PickLabel label={t('bookingEdit.field.paymentStatus')} />
        <ChipPicker options={PAYMENT_STATUSES.map((p) => ({ key: p, label: t(`paymentStatus.${p}`) }))} value={paymentStatus} onChange={setPaymentStatus} />
      </FieldCard>
    </EntityFormShell>
  );
};
