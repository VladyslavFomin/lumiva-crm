/**
 * Общий таймаут для fetch, чтобы UI не оставался в вечной загрузке при «зависших» ответах.
 */
export const DEFAULT_FETCH_TIMEOUT_MS = 30_000;

export function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(
      () => reject(new Error(`${label} timed out after ${ms}ms`)),
      ms,
    );
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}
