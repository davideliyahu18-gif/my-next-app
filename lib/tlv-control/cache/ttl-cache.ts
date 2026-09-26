/** Generic server-side TTL cache with in-flight de-duplication: concurrent
 * callers during a refresh await the same in-progress fetch instead of each
 * triggering their own upstream request. Backed by globalThis so it survives
 * across warm serverless invocations, matching the rest of this codebase. */
export class TtlCache<T> {
  private value: T | null = null;
  private fetchedAt = 0;
  private inflight: Promise<T> | null = null;

  constructor(
    private readonly ttlMs: number,
    private readonly fetcher: () => Promise<T>,
  ) {}

  async get(force = false): Promise<T> {
    const age = Date.now() - this.fetchedAt;
    if (!force && this.value !== null && age < this.ttlMs) {
      return this.value;
    }
    if (this.inflight) return this.inflight;

    this.inflight = (async () => {
      try {
        const result = await this.fetcher();
        this.value = result;
        this.fetchedAt = Date.now();
        return result;
      } finally {
        this.inflight = null;
      }
    })();

    return this.inflight;
  }

  /** Last good value, even if stale — for graceful degradation on failure. */
  peek(): T | null {
    return this.value;
  }
}

/** Keeps a single TtlCache per key alive across module reloads (dev) and
 * warm serverless instances, via globalThis. */
export function getOrCreateCache<T>(
  key: string,
  ttlMs: number,
  fetcher: () => Promise<T>,
): TtlCache<T> {
  const globalRef = globalThis as typeof globalThis & {
    __tlvCaches?: Map<string, TtlCache<unknown>>;
  };
  if (!globalRef.__tlvCaches) globalRef.__tlvCaches = new Map();
  const existing = globalRef.__tlvCaches.get(key);
  if (existing) return existing as TtlCache<T>;

  const created = new TtlCache<T>(ttlMs, fetcher);
  globalRef.__tlvCaches.set(key, created as TtlCache<unknown>);
  return created;
}
