// Cache de disponibilidad en memoria del proceso. Antes vivia en Redis: cada consulta del motor de
// reservas (publica, la mas frecuente) costaba 1-2 comandos y cada reserva un borrado por patron
// (SCAN + DEL), que cuentan contra el tope mensual gratis de Upstash.
//
// Es solo una optimizacion de lectura: la verificacion bajo lock al crear una reserva sigue siendo la
// unica autoridad anti-overbooking. Las invalidaciones hechas en esta misma API (reservas, bloqueos,
// propietarios) lo limpian al instante; las que hace el worker (otro proceso, p. ej. al liberar
// reservas vencidas) no llegan hasta aca, y se resuelven cuando vence el TTL (60 s).

const TTL_MS = 60 * 1000;
const MAX_ENTRIES = 500;

const store = new Map<string, { value: unknown; expiresAt: number }>();

export const availabilityCache = {
  get<T>(key: string): T | null {
    const entry = store.get(key);
    if (!entry) {return null;}
    if (entry.expiresAt <= Date.now()) {
      store.delete(key);
      return null;
    }
    return entry.value as T;
  },

  set(key: string, value: unknown): void {
    if (store.size >= MAX_ENTRIES) {
      const now = Date.now();
      for (const [k, entry] of store) {if (entry.expiresAt <= now) {store.delete(k);}}
      if (store.size >= MAX_ENTRIES) {store.delete(store.keys().next().value as string);}
    }
    store.set(key, { value, expiresAt: Date.now() + TTL_MS });
  },

  /** Borra todo el cache: cualquier cambio de reservas o bloqueos puede afectar cualquier rango de fechas. */
  invalidate(): void {
    store.clear();
  },

  size(): number {
    return store.size;
  },
};
