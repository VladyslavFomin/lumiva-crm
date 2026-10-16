import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, In, Not, Repository } from 'typeorm';
import { HotelReview, HotelReviewDuplicate } from './reputation.entities';
import { historyFloor } from './reputation.constants';
import { ReputationSettingsService } from './reputation-settings.service';

const DAY = 864e5;
/** Окно поиска: один гость публикует отзыв на разных площадках в пределах пары дней, площадки модерируют по-разному. */
const WINDOW_DAYS = 10;
/** Порог «предложить человеку». Ниже — показываем только в ручном подборе. */
const SUGGEST_SCORE = 0.6;
/** «Дословная копия» — можно подтверждать пачкой. */
const EXACT_SCORE = 0.95;
/** Кого считать основным при одинаковой дате: площадки, где отзывы чаще пишут первыми. */
const PRIMARY_ORDER = ['google', 'tripadvisor', 'booking', 'holidaycheck', 'yandex', 'expedia', 'otelpuan', 'check24'];

type Cand = Pick<HotelReview, 'id' | 'tenantId' | 'hotelId' | 'platform' | 'author' | 'title' | 'textOriginal' | 'textTranslated' | 'translatedLang' | 'lang' | 'rating10' | 'publishedAt' | 'duplicateOfId'>;

/** Нижний регистр без диакритики и пунктуации, слова через пробел. */
function norm(text: string | null | undefined, keep = '\\p{L}\\p{N}'): string[] {
  return (text || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(new RegExp(`[^${keep}]+`, 'gu'), ' ')
    .trim()
    .split(' ')
    .filter(Boolean);
}

/**
 * Пары соседних слов. Отдельные слова не годятся: у отзывов об отелях общий словарь («отель», «еда»,
 * «персонал»), а пары слов подряд совпадают почти только у скопированного текста.
 */
function shingles(text: string | null | undefined): Set<string> {
  const w = norm(text);
  const out = new Set<string>();
  for (let i = 0; i + 1 < w.length; i++) out.add(`${w[i]} ${w[i + 1]}`);
  return out;
}

function nameKey(a: string | null | undefined): string | null {
  const s = norm(a, '\\p{L}').join(' ');
  return s.length >= 2 ? s : null;
}

/**
 * Доля пар слов меньшего текста, найденных в большем (обрезанная площадкой копия тоже совпадёт).
 * Короткие тексты (< 6 пар) не сравниваем; один текст втрое длиннее другого — это разные отзывы.
 */
function containment(a: Set<string>, b: Set<string>): number {
  if (a.size < 6 || b.size < 6) return 0;
  const [small, big] = a.size <= b.size ? [a, b] : [b, a];
  if (small.size / big.size < 0.33) return 0;
  let n = 0;
  for (const w of small) if (big.has(w)) n++;
  return n / small.size;
}

/**
 * Насколько два отзыва похожи на один и тот же отзыв гостя на разных площадках.
 * Главный признак — текст (гости копируют его целиком); имя автора и оценка — поправки.
 * Без текста с одной стороны — только полное совпадение имени + та же оценка + ≤ 3 дней.
 */
export function duplicateScore(a: Cand, b: Cand, windowDays = WINDOW_DAYS): { score: number; reason: string } | null {
  if (a.id === b.id || a.platform === b.platform || a.hotelId !== b.hotelId) return null;
  const ta = a.publishedAt?.getTime() ?? 0;
  const tb = b.publishedAt?.getTime() ?? 0;
  const days = Math.abs(ta - tb) / DAY;
  if (!ta || !tb || days > windowDays) return null;
  const ra = a.rating10 != null ? Number(a.rating10) : null;
  const rb = b.rating10 != null ? Number(b.rating10) : null;
  const dr = ra != null && rb != null ? Math.abs(ra - rb) : null;
  const na = nameKey(a.author);
  const nb = nameKey(b.author);
  const fullName = !!na && na === nb;
  const firstName = !!na && !!nb && na.split(' ')[0] === nb.split(' ')[0];
  // «D K» и «DK», «Erhan Ünal» и «Erhan Ü» — один человек с разными никами на площадках
  const sameName = fullName || firstName || (!!na && !!nb && na.replace(/ /g, '') === nb.replace(/ /g, ''));

  let text = containment(shingles([a.title, a.textOriginal].filter(Boolean).join(' ')), shingles([b.title, b.textOriginal].filter(Boolean).join(' ')));
  let reason = text >= 0.8 ? 'same_text' : 'similar_text';
  // гость написал на разных языках — сравниваем наши переводы на один язык, если они есть
  if (text < 0.5 && a.textTranslated && b.textTranslated && a.translatedLang && a.translatedLang === b.translatedLang) {
    const tr = containment(shingles(a.textTranslated), shingles(b.textTranslated)) * 0.9;
    if (tr > text) {
      text = tr;
      reason = 'translated_text';
    }
  }
  // текст совпал не целиком — разные гости пишут похожие шаблонные фразы, поэтому нужно и совместимое имя
  if (text >= 0.8 || (text >= 0.4 && sameName)) {
    let score = text + (fullName ? 0.2 : firstName ? 0.1 : 0) + (dr != null && dr <= 1 ? 0.05 : 0) - (dr != null && dr >= 3 ? 0.25 : 0) - (days > 4 ? 0.05 : 0);
    score = Math.max(0, Math.min(1, score));
    return { score: Math.round(score * 1000) / 1000, reason };
  }
  const hasTextA = !!(a.textOriginal || '').trim();
  const hasTextB = !!(b.textOriginal || '').trim();
  if ((!hasTextA || !hasTextB) && fullName && (na!.includes(' ') || na!.length >= 8) && dr != null && dr <= 0.5 && days <= 3) {
    return { score: SUGGEST_SCORE, reason: 'same_author' };
  }
  // ручной подбор: ближайшие по имени/оценке/дате; системой не предлагаются (оценка всегда ниже порога)
  const weak = (firstName ? 0.2 : 0) + (dr != null && dr <= 1 ? 0.1 : 0) + Math.max(0, 0.1 - days * 0.02) + text * 0.3;
  return { score: Math.min(SUGGEST_SCORE - 0.01, Math.round(weak * 1000) / 1000), reason: 'nearby' };
}

const CAND_COLUMNS: (keyof HotelReview)[] = [
  'id', 'tenantId', 'hotelId', 'platform', 'author', 'title', 'textOriginal', 'textTranslated', 'translatedLang', 'lang', 'rating10', 'publishedAt', 'duplicateOfId',
];

/**
 * Дубликаты между площадками: система сама находит пары (новые отзывы — сразу при сборе, история — по кнопке),
 * человек в карточке подтверждает «это дубликат» или «не дубликат». Подтверждённый дубликат не считается
 * в аналитике повторно, но ответ на своей площадке ему по-прежнему нужен.
 */
@Injectable()
export class ReputationDuplicatesService {
  private readonly log = new Logger(ReputationDuplicatesService.name);

  constructor(
    @InjectRepository(HotelReview) private readonly reviews: Repository<HotelReview>,
    @InjectRepository(HotelReviewDuplicate) private readonly dups: Repository<HotelReviewDuplicate>,
    private readonly settings: ReputationSettingsService,
  ) {}

  private async savePairs(pairs: Array<{ a: Cand; b: Cand; score: number; reason: string }>) {
    let added = 0;
    for (const p of pairs) {
      const [x, y] = p.a.id < p.b.id ? [p.a, p.b] : [p.b, p.a];
      const res = await this.dups
        .createQueryBuilder()
        .insert()
        .values({ tenantId: x.tenantId, hotelId: x.hotelId, reviewId: x.id, candidateId: y.id, score: String(p.score), reason: p.reason, status: 'suggested' })
        .orIgnore()
        .execute();
      if (res.identifiers?.length && res.identifiers[0]) added++;
    }
    return added;
  }

  /** Новые отзывы после сбора: сравниваем с отзывами того же отеля на других площадках в окне ±10 дней. */
  async detectFor(tenantId: string, reviewIds: string[]) {
    if (!reviewIds.length) return 0;
    const fresh = await this.reviews.find({ where: { id: In(reviewIds), tenantId }, select: CAND_COLUMNS });
    const pairs: Array<{ a: Cand; b: Cand; score: number; reason: string }> = [];
    for (const r of fresh) {
      if (!r.publishedAt || r.duplicateOfId) continue;
      const near = await this.reviews.find({
        where: {
          tenantId,
          hotelId: r.hotelId,
          platform: Not(r.platform),
          status: Not('deleted'),
          publishedAt: Between(new Date(r.publishedAt.getTime() - WINDOW_DAYS * DAY), new Date(r.publishedAt.getTime() + WINDOW_DAYS * DAY)),
        },
        select: CAND_COLUMNS,
        take: 500,
      });
      for (const c of near) {
        const s = duplicateScore(r, c);
        if (s && s.score >= SUGGEST_SCORE) pairs.push({ a: r, b: c, ...s });
      }
    }
    return this.savePairs(pairs);
  }

  /** Поиск по всей истории тенанта (кнопка «Найти дубликаты»): по отелю, скользящим окном по дате. */
  async scanTenant(tenantId: string) {
    const cfg = await this.settings.config(tenantId);
    const floor = new Date(historyFloor(cfg));
    const hotelIds: string[] = (
      await this.reviews.query(`SELECT DISTINCT "hotelId" FROM hotel_reviews WHERE "tenantId" = $1 AND status <> 'deleted'`, [tenantId])
    ).map((r: any) => r.hotelId);
    let found = 0;
    let checked = 0;
    for (const hotelId of hotelIds) {
      const rows = await this.reviews
        .createQueryBuilder('r')
        .select(CAND_COLUMNS.map((c) => `r.${c}`))
        .where('r.tenantId = :tenantId AND r.hotelId = :hotelId AND r.status <> :d AND r.publishedAt >= :floor', { tenantId, hotelId, d: 'deleted', floor })
        .orderBy('r.publishedAt', 'ASC')
        .getMany();
      const pairs: Array<{ a: Cand; b: Cand; score: number; reason: string }> = [];
      for (let i = 0; i < rows.length; i++) {
        const a = rows[i];
        const ta = a.publishedAt!.getTime();
        for (let j = i + 1; j < rows.length && rows[j].publishedAt!.getTime() - ta <= WINDOW_DAYS * DAY; j++) {
          const s = duplicateScore(a, rows[j]);
          if (s && s.score >= SUGGEST_SCORE) pairs.push({ a, b: rows[j], ...s });
        }
      }
      checked += rows.length;
      found += await this.savePairs(pairs);
    }
    const suggested = await this.dups.count({ where: { tenantId, status: 'suggested' } });
    this.log.log(`duplicates scan ${tenantId}: ${checked} reviews, ${found} new pairs, ${suggested} awaiting review`);
    return { checked, found, suggested };
  }

  /** Пары «дословно тот же текст» (≥ 95 %) — их можно подтвердить разом. */
  async exactCount(tenantId: string) {
    return this.dups
      .createQueryBuilder('d')
      .where('d.tenantId = :tenantId AND d.status = :s AND d.reason = :r AND d.score >= :min', { tenantId, s: 'suggested', r: 'same_text', min: EXACT_SCORE })
      .getCount();
  }

  /**
   * «Подтвердить все дословные»: в каждой паре основным остаётся более ранний отзыв (гость написал его первым,
   * потом скопировал), при равной дате — по площадке (Google, Tripadvisor, Booking, …). Остальное — как ручное «Это дубликат».
   */
  async confirmExact(tenantId: string, userId: string | null) {
    const pairs = await this.dups
      .createQueryBuilder('d')
      .where('d.tenantId = :tenantId AND d.status = :s AND d.reason = :r AND d.score >= :min', { tenantId, s: 'suggested', r: 'same_text', min: EXACT_SCORE })
      .getMany();
    let confirmed = 0;
    let skipped = 0;
    for (const p of pairs) {
      const [a, b] = await Promise.all([
        this.reviews.findOne({ where: { id: p.reviewId, tenantId } }),
        this.reviews.findOne({ where: { id: p.candidateId, tenantId } }),
      ]);
      if (!a || !b || a.status === 'deleted' || b.status === 'deleted') {
        skipped++;
        continue;
      }
      // уже в одной группе (через третий отзыв) — просто закрываем пару
      if ((a.duplicateOfId || a.id) === (b.duplicateOfId || b.id)) {
        await this.setPairStatus(tenantId, a.id, b.id, 'confirmed', userId, 'same_text');
        confirmed++;
        continue;
      }
      const ta = a.publishedAt?.getTime() ?? 0;
      const tb = b.publishedAt?.getTime() ?? 0;
      const rank = (x: HotelReview) => {
        const i = PRIMARY_ORDER.indexOf(x.platform);
        return i < 0 ? 99 : i;
      };
      const [primary, copy] = ta !== tb ? (ta < tb ? [a, b] : [b, a]) : rank(a) <= rank(b) ? [a, b] : [b, a];
      try {
        await this.mark(tenantId, userId, copy.id, primary.id);
        confirmed++;
      } catch {
        // цепочка уже схлопнута другим решением (например, копия сама стала основной) — пропускаем
        skipped++;
      }
    }
    return { confirmed, skipped, left: await this.suggestedCount(tenantId) };
  }

  async suggestedCount(tenantId: string) {
    return this.dups.count({ where: { tenantId, status: 'suggested' } });
  }

  /** Для ленты: какие из показанных отзывов имеют непроверенного кандидата. */
  async suggestedAmong(tenantId: string, ids: string[]): Promise<Set<string>> {
    if (!ids.length) return new Set();
    const rows = await this.dups
      .createQueryBuilder('d')
      .select(['d.reviewId', 'd.candidateId'])
      .where('d.tenantId = :tenantId AND d.status = :s', { tenantId, s: 'suggested' })
      .andWhere('(d.reviewId IN (:...ids) OR d.candidateId IN (:...ids))', { ids })
      .getMany();
    const out = new Set<string>();
    for (const r of rows) {
      out.add(r.reviewId);
      out.add(r.candidateId);
    }
    return out;
  }

  private brief(r: HotelReview | Cand) {
    return {
      id: r.id,
      platform: r.platform,
      author: r.author,
      rating10: r.rating10 != null ? Number(r.rating10) : null,
      publishedAt: r.publishedAt?.toISOString() ?? null,
      excerpt: [r.title, r.textOriginal].filter(Boolean).join('. ').slice(0, 240) || null,
    };
  }

  /** Блок «Дубликаты» в карточке отзыва. */
  async cardInfo(tenantId: string, review: HotelReview) {
    const of = review.duplicateOfId ? await this.reviews.findOne({ where: { id: review.duplicateOfId, tenantId } }) : null;
    const children = await this.reviews.find({ where: { tenantId, duplicateOfId: review.id }, take: 20 });
    const pairs = await this.dups.find({
      where: [
        { tenantId, reviewId: review.id, status: 'suggested' },
        { tenantId, candidateId: review.id, status: 'suggested' },
      ],
      take: 10,
    });
    const otherIds = pairs.map((p) => (p.reviewId === review.id ? p.candidateId : p.reviewId));
    const others = otherIds.length ? await this.reviews.find({ where: { id: In(otherIds), tenantId } }) : [];
    return {
      of: of ? this.brief(of) : null,
      duplicates: children.map((c) => this.brief(c)),
      suggestions: pairs
        .map((p) => {
          const o = others.find((x) => x.id === (p.reviewId === review.id ? p.candidateId : p.reviewId));
          return o && o.status !== 'deleted' ? { pairId: p.id, score: Number(p.score), reason: p.reason, review: this.brief(o) } : null;
        })
        .filter(Boolean)
        .sort((x: any, y: any) => y.score - x.score),
    };
  }

  /** Ручной подбор: отзывы того же отеля с других площадок ±14 дней, самые похожие сверху. */
  async candidates(tenantId: string, reviewId: string) {
    const r = await this.reviews.findOne({ where: { id: reviewId, tenantId }, select: CAND_COLUMNS });
    if (!r) throw new NotFoundException('Review not found');
    if (!r.publishedAt) return [];
    const near = await this.reviews.find({
      where: {
        tenantId,
        hotelId: r.hotelId,
        platform: Not(r.platform),
        status: Not('deleted'),
        publishedAt: Between(new Date(r.publishedAt.getTime() - 14 * DAY), new Date(r.publishedAt.getTime() + 14 * DAY)),
      },
      select: CAND_COLUMNS,
      take: 300,
    });
    return near
      .map((c) => ({ c, s: duplicateScore(r, c, 14) }))
      .filter((x) => x.s)
      .sort((x, y) => y.s!.score - x.s!.score)
      .slice(0, 15)
      .map((x) => ({ score: x.s!.score, reason: x.s!.reason, review: this.brief(x.c) }));
  }

  /**
   * «Это дубликат отзыва X»: отзыв выпадает из аналитики (считается X). ofId=null — снять отметку
   * (пара больше не предлагается). Цепочки схлопываем к одному основному отзыву.
   */
  async mark(tenantId: string, userId: string | null, reviewId: string, ofId: string | null) {
    const r = await this.reviews.findOne({ where: { id: reviewId, tenantId } });
    if (!r) throw new NotFoundException('Review not found');
    if (!ofId) {
      const prev = r.duplicateOfId;
      if (!prev) return;
      await this.reviews.update({ id: r.id }, { duplicateOfId: null });
      await this.setPairStatus(tenantId, r.id, prev, 'dismissed', userId, 'manual');
      return;
    }
    const target = await this.reviews.findOne({ where: { id: ofId, tenantId } });
    if (!target) throw new NotFoundException('Review not found');
    if (target.hotelId !== r.hotelId) throw new BadRequestException('Duplicates must belong to the same hotel');
    const rootId = target.duplicateOfId || target.id;
    if (rootId === r.id) throw new BadRequestException('This review is already the main one for that duplicate');
    await this.reviews.update({ id: r.id }, { duplicateOfId: rootId });
    // отзывы, которые считались дубликатами этого, теперь указывают на основной
    await this.reviews.update({ tenantId, duplicateOfId: r.id }, { duplicateOfId: rootId });
    await this.setPairStatus(tenantId, r.id, target.id, 'confirmed', userId, 'manual');
  }

  async dismiss(tenantId: string, userId: string | null, pairId: string) {
    const p = await this.dups.findOne({ where: { id: pairId, tenantId } });
    if (!p) throw new NotFoundException('Pair not found');
    await this.dups.update({ id: p.id }, { status: 'dismissed', decidedBy: userId, decidedAt: new Date() });
  }

  private async setPairStatus(tenantId: string, a: string, b: string, status: 'confirmed' | 'dismissed', userId: string | null, reason: string) {
    const [x, y] = a < b ? [a, b] : [b, a];
    const p = await this.dups.findOne({ where: { reviewId: x, candidateId: y } });
    if (p) {
      await this.dups.update({ id: p.id }, { status, decidedBy: userId, decidedAt: new Date() });
      return;
    }
    const rx = await this.reviews.findOne({ where: { id: x, tenantId }, select: ['id', 'hotelId'] });
    if (!rx) return;
    await this.dups.insert({ tenantId, hotelId: rx.hotelId, reviewId: x, candidateId: y, score: '1', reason, status, decidedBy: userId, decidedAt: new Date() });
  }
}
