const store = new Map<string, { value: string; expiresAt?: number }>();

const alive = (key: string): boolean => {
  const e = store.get(key);
  if (!e) return false;
  if (e.expiresAt && Date.now() > e.expiresAt) { store.delete(key); return false; }
  return true;
};

class RedisClient {
  async get<T>(key: string): Promise<T | null> {
    if (!alive(key)) return null;
    const e = store.get(key);
    return e ? (JSON.parse(e.value) as T) : null;
  }

  async set(key: string, value: any, ttlSeconds?: number): Promise<boolean> {
    store.set(key, { value: JSON.stringify(value), expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : undefined });
    return true;
  }

  async del(key: string): Promise<boolean> {
    store.delete(key); return true;
  }

  async delPattern(pattern: string): Promise<number> {
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    let n = 0;
    for (const k of store.keys()) { if (regex.test(k)) { store.delete(k); n++; } }
    return n;
  }

  async exists(key: string): Promise<boolean> { return alive(key); }

  async expire(key: string, seconds: number): Promise<boolean> {
    const e = store.get(key);
    if (e) store.set(key, { ...e, expiresAt: Date.now() + seconds * 1000 });
    return true;
  }

  async ttl(key: string): Promise<number> {
    const e = store.get(key);
    if (!e?.expiresAt) return -1;
    return Math.max(0, Math.floor((e.expiresAt - Date.now()) / 1000));
  }

  async increment(key: string, amount: number = 1): Promise<number> {
    const e = store.get(key);
    const n = (e ? parseInt(JSON.parse(e.value), 10) : 0) + amount;
    store.set(key, { value: JSON.stringify(n), expiresAt: e?.expiresAt });
    return n;
  }

  async decrement(key: string, amount: number = 1): Promise<number> { return this.increment(key, -amount); }

  async hget<T>(key: string, field: string): Promise<T | null> {
    if (!alive(key)) return null;
    const e = store.get(key);
    return e ? (JSON.parse(e.value)[field] ?? null) : null;
  }

  async hset(key: string, field: string, value: any): Promise<boolean> {
    const e = store.get(key);
    const map = e ? JSON.parse(e.value) : {};
    map[field] = JSON.stringify(value);
    store.set(key, { value: JSON.stringify(map), expiresAt: e?.expiresAt });
    return true;
  }

  async hgetall<T>(key: string): Promise<Record<string, T> | null> {
    if (!alive(key)) return null;
    const e = store.get(key);
    if (!e) return null;
    const raw = JSON.parse(e.value);
    const result: Record<string, T> = {};
    for (const [k, v] of Object.entries(raw)) result[k] = JSON.parse(v as string) as T;
    return result;
  }

  async hdel(key: string, field: string): Promise<boolean> {
    const e = store.get(key);
    if (!e) return true;
    const map = JSON.parse(e.value);
    delete map[field];
    store.set(key, { value: JSON.stringify(map), expiresAt: e.expiresAt });
    return true;
  }

  async sadd(key: string, ...members: string[]): Promise<number> {
    const e = store.get(key);
    const set: Set<string> = e ? new Set(JSON.parse(e.value)) : new Set();
    members.forEach(m => set.add(m));
    store.set(key, { value: JSON.stringify([...set]), expiresAt: e?.expiresAt });
    return members.length;
  }

  async smembers(key: string): Promise<string[]> {
    if (!alive(key)) return [];
    const e = store.get(key);
    return e ? JSON.parse(e.value) : [];
  }

  async sismember(key: string, member: string): Promise<boolean> {
    return (await this.smembers(key)).includes(member);
  }

  async srem(key: string, ...members: string[]): Promise<number> {
    const e = store.get(key);
    if (!e) return 0;
    const set: Set<string> = new Set(JSON.parse(e.value));
    members.forEach(m => set.delete(m));
    store.set(key, { value: JSON.stringify([...set]), expiresAt: e.expiresAt });
    return members.length;
  }

  async lpush(key: string, ...values: string[]): Promise<number> {
    const e = store.get(key);
    const arr: string[] = e ? JSON.parse(e.value) : [];
    arr.unshift(...values);
    store.set(key, { value: JSON.stringify(arr), expiresAt: e?.expiresAt });
    return arr.length;
  }

  async rpush(key: string, ...values: string[]): Promise<number> {
    const e = store.get(key);
    const arr: string[] = e ? JSON.parse(e.value) : [];
    arr.push(...values);
    store.set(key, { value: JSON.stringify(arr), expiresAt: e?.expiresAt });
    return arr.length;
  }

  async lrange(key: string, start: number, stop: number): Promise<string[]> {
    if (!alive(key)) return [];
    const e = store.get(key);
    const arr: string[] = e ? JSON.parse(e.value) : [];
    return arr.slice(start, stop === -1 ? undefined : stop + 1);
  }

  async ltrim(key: string, start: number, stop: number): Promise<boolean> {
    const e = store.get(key);
    if (!e) return true;
    const arr: string[] = JSON.parse(e.value);
    store.set(key, { value: JSON.stringify(arr.slice(start, stop + 1)), expiresAt: e.expiresAt });
    return true;
  }

  async flushdb(): Promise<boolean> { store.clear(); return true; }

  async ping(): Promise<boolean> { return true; }

  async keys(pattern: string): Promise<string[]> {
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    return [...store.keys()].filter(k => regex.test(k));
  }

  isClientConnected(): boolean { return true; }

  async disconnect(): Promise<void> {}

  async invalidateAvailability(roomId: string): Promise<void> {
    await this.delPattern(`room:${roomId}:availability:*`);
  }

  async cacheWithFallback<T>(key: string, fetchFn: () => Promise<T>, ttl: number = 300): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) return cached;
    const fresh = await fetchFn();
    await this.set(key, fresh, ttl);
    return fresh;
  }

  async invalidateCache(pattern: string): Promise<number> {
    return this.delPattern(pattern);
  }
}

export default new RedisClient();
