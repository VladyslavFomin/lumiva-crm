import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HelpMedia } from './help-media.entity';
import { HELP_GROUPS, HELP_PAGES } from './help-pages';
import { TOUR_STEPS } from './tour-steps';
import { PAGE_GUIDE_STEP, type HelpLang, type HelpMediaKind } from './help-content.types';

const LANGS: HelpLang[] = ['ru', 'en', 'tr'];
const KINDS: HelpMediaKind[] = ['video', 'gif'];

@Injectable()
export class HelpContentService {
  constructor(@InjectRepository(HelpMedia) private readonly mediaRepo: Repository<HelpMedia>) {}

  private lang(raw?: string): HelpLang {
    const l = String(raw || '').slice(0, 2).toLowerCase() as HelpLang;
    return LANGS.includes(l) ? l : 'ru';
  }

  /** Для CRM: шаги тура страницы на языке пользователя + видео/gif, если заданы в pl1. */
  async getTour(topic: string, rawLang?: string) {
    const lang = this.lang(rawLang);
    const page = HELP_PAGES.find((p) => p.topic === topic);
    if (!page) return { topic, steps: [], pageMedia: null };
    const media = await this.mediaRepo.find({ where: { topic } });
    const byStep = new Map(media.map((m) => [m.stepId, { kind: m.kind, url: m.url }]));
    const steps = (TOUR_STEPS[topic] || []).map((s) => ({
      id: s.id,
      target: s.target || null,
      title: s.title[lang] || s.title.ru,
      body: s.body[lang] || s.body.ru,
      media: byStep.get(s.id) || null,
    }));
    return { topic, title: page.title[lang], steps, pageMedia: byStep.get(PAGE_GUIDE_STEP) || null };
  }

  /** Для pl1: все страницы по группам, их шаги (ru) и уже заданные ссылки. */
  async getCatalog() {
    const media = await this.mediaRepo.find();
    return {
      groups: HELP_GROUPS.map((g) => ({ id: g.id, title: g.title.ru })),
      pages: HELP_PAGES.map((p) => ({
        topic: p.topic,
        group: p.group,
        title: p.title.ru,
        steps: (TOUR_STEPS[p.topic] || []).map((s) => ({ id: s.id, title: s.title.ru, body: s.body.ru })),
      })),
      media: media.map((m) => ({ topic: m.topic, stepId: m.stepId, kind: m.kind, url: m.url, updatedAt: m.updatedAt })),
    };
  }

  /** Пустая ссылка — удалить (подсказка снова показывается только текстом). */
  async setMedia(body: { topic?: string; stepId?: string; kind?: string; url?: string | null }) {
    const topic = String(body.topic || '');
    const stepId = String(body.stepId || '');
    if (!HELP_PAGES.some((p) => p.topic === topic)) throw new BadRequestException('Unknown page');
    if (stepId !== PAGE_GUIDE_STEP && !(TOUR_STEPS[topic] || []).some((s) => s.id === stepId)) {
      throw new BadRequestException('Unknown step');
    }
    const url = String(body.url || '').trim();
    if (!url) {
      await this.mediaRepo.delete({ topic, stepId });
      return { topic, stepId, kind: null, url: null };
    }
    if (!/^https?:\/\/\S+$/i.test(url) || url.length > 2000) throw new BadRequestException('Ссылка должна начинаться с http:// или https://');
    const kind = KINDS.includes(body.kind as HelpMediaKind) ? (body.kind as HelpMediaKind) : 'video';
    const existing = await this.mediaRepo.findOne({ where: { topic, stepId } });
    const saved = await this.mediaRepo.save(
      existing ? Object.assign(existing, { kind, url }) : this.mediaRepo.create({ topic, stepId, kind, url }),
    );
    return { topic, stepId, kind: saved.kind, url: saved.url, updatedAt: saved.updatedAt };
  }
}
