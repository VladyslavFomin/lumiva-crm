import React from 'react';
import type { HelpMedia } from '../../api/helpContent';

/** YouTube / Vimeo / Loom → адрес для встраивания; прямой файл → null. */
function embedUrl(url: string): string | null {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\.|^m\./, '');
    if (host === 'youtu.be') return `https://www.youtube-nocookie.com/embed/${u.pathname.slice(1)}?rel=0`;
    if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
      const id = u.searchParams.get('v') || u.pathname.match(/\/(?:embed|shorts|live)\/([^/?]+)/)?.[1];
      if (id) return `https://www.youtube-nocookie.com/embed/${id}?rel=0`;
    }
    if (host === 'vimeo.com') {
      const id = u.pathname.match(/\/(\d+)/)?.[1];
      if (id) return `https://player.vimeo.com/video/${id}`;
    }
    if (host === 'player.vimeo.com') return url;
    if (host === 'loom.com') {
      const id = u.pathname.match(/\/(?:share|embed)\/([^/?]+)/)?.[1];
      if (id) return `https://www.loom.com/embed/${id}`;
    }
  } catch {
    /* не URL — покажем как есть */
  }
  return null;
}

/**
 * Видео или gif к подсказке. gif — картинка (img), видео — встраивание YouTube/Vimeo/Loom
 * или прямой файл (mp4/webm): короткие ролики в шагах крутятся без звука по кругу.
 */
export const HelpMediaView: React.FC<{ media: HelpMedia; compact?: boolean; className?: string }> = ({
  media,
  compact,
  className,
}) => {
  const box = `overflow-hidden rounded-xl border border-slate-200 bg-slate-100 ${className || ''}`;
  if (media.kind === 'gif') {
    return (
      <div className={box}>
        <img src={media.url} alt="" loading="lazy" className="block h-auto max-h-[60vh] w-full object-contain" />
      </div>
    );
  }
  const embed = embedUrl(media.url);
  if (embed) {
    return (
      <div className={box}>
        <iframe
          src={embed}
          title="video"
          className="block aspect-video w-full"
          allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
          allowFullScreen
        />
      </div>
    );
  }
  return (
    <div className={box}>
      <video
        src={media.url}
        className="block max-h-[60vh] w-full bg-black"
        controls={!compact}
        autoPlay={compact}
        muted={compact}
        loop={compact}
        playsInline
        preload="metadata"
      />
    </div>
  );
};
