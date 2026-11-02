import type { PdfFlipbookLabels } from './PdfFlipbook';

/** Подписи PDF-журнала: общие ключи для CRM и публичной страницы (там t — getFixedT языка посетителя) */
export const pdfLabels = (t: (k: string) => string): PdfFlipbookLabels => ({
  book: t('pdfViewer.book'),
  scroll: t('pdfViewer.scroll'),
  prev: t('pdfViewer.prev'),
  next: t('pdfViewer.next'),
  thumbs: t('pdfViewer.thumbs'),
  fullscreen: t('pdfViewer.fullscreen'),
  exitFullscreen: t('pdfViewer.exitFullscreen'),
  zoomIn: t('pdfViewer.zoomIn'),
  zoomOut: t('pdfViewer.zoomOut'),
  loading: t('pdfViewer.loading'),
  error: t('pdfViewer.error'),
  download: t('pdfViewer.download'),
  first: t('pdfViewer.first'),
  last: t('pdfViewer.last'),
  pageShort: t('pdfViewer.pageShort'),
  search: t('pdfViewer.search'),
  searchPlaceholder: t('pdfViewer.searchPlaceholder'),
  nothingFound: t('pdfViewer.nothingFound'),
  spread: t('pdfViewer.spread'),
  singlePage: t('pdfViewer.singlePage'),
});
