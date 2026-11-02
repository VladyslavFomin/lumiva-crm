import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { fetchBookingProject, type BookingBusinessType, type BookingProject } from '../../api/bookings';

/**
 * Тип бизнеса проекта бронирований — общий кэш на всё приложение (сайдбар MainLayout и
 * подменю модуля читают его на каждой странице; запрос к /bookings/project — один раз).
 * Последний известный тип хранится в localStorage, чтобы меню не «прыгало» при перезагрузке.
 */
const LS_KEY = 'lumiva_booking_business_type';
let cached: BookingBusinessType | null = null;
let inflight: Promise<void> | null = null;
const listeners = new Set<(t: BookingBusinessType) => void>();

function readLs(): BookingBusinessType | null {
  try {
    const v = localStorage.getItem(LS_KEY);
    return v && ['salon', 'restaurant', 'fitness', 'consultation', 'rental'].includes(v) ? (v as BookingBusinessType) : null;
  } catch {
    return null;
  }
}

export function setBookingBusinessType(t: BookingBusinessType) {
  cached = t;
  try {
    localStorage.setItem(LS_KEY, t);
  } catch {
    /* private mode */
  }
  listeners.forEach((l) => l(t));
}

/** Вызывать после сохранения проекта (смена типа в настройках). */
export function syncBookingProject(p: Pick<BookingProject, 'businessType'>) {
  setBookingBusinessType(p.businessType);
}

function load() {
  if (inflight) return inflight;
  inflight = fetchBookingProject()
    .then((p) => setBookingBusinessType(p.businessType))
    .catch(() => undefined)
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

export function useBookingBusinessType(enabled = true): BookingBusinessType {
  const [type, setType] = useState<BookingBusinessType>(cached || readLs() || 'salon');
  useEffect(() => {
    if (!enabled) return;
    listeners.add(setType);
    if (!cached) load();
    else setType(cached);
    return () => {
      listeners.delete(setType);
    };
  }, [enabled]);
  return type;
}

export interface BookingTerms {
  staff: string;
  staffPlural: string;
  service: string;
  servicePlural: string;
  resource: string;
  resourcePlural: string;
  client: string;
  clientPlural: string;
  booking: string;
  bookingPlural: string;
}

/** Терминология под тип бизнеса: «Мастер/Кабинет» → «Официант/Стол», «Тренер/Зал», «Специалист», «Ресурс». */
export function useBookingVertical() {
  const { t } = useTranslation();
  const type = useBookingBusinessType();
  const k = (key: string) => t(`crm.bookings.terms.${type}.${key}`);
  const terms: BookingTerms = {
    staff: k('staff'),
    staffPlural: k('staffPlural'),
    service: k('service'),
    servicePlural: k('servicePlural'),
    resource: k('resource'),
    resourcePlural: k('resourcePlural'),
    client: k('client'),
    clientPlural: k('clientPlural'),
    booking: k('booking'),
    bookingPlural: k('bookingPlural'),
  };
  return { type, terms };
}
