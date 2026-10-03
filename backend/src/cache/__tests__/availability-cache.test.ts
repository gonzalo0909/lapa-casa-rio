import { availabilityCache } from '../availability-cache';

describe('availabilityCache', () => {
  beforeEach(() => { jest.useFakeTimers(); availabilityCache.invalidate(); });
  afterEach(() => jest.useRealTimers());

  it('devuelve lo guardado hasta que vence (60 s)', () => {
    availabilityCache.set('k', [1]);
    expect(availabilityCache.get('k')).toEqual([1]);
    jest.advanceTimersByTime(59_000);
    expect(availabilityCache.get('k')).toEqual([1]);
    jest.advanceTimersByTime(2_000);
    expect(availabilityCache.get('k')).toBeNull();
  });

  it('invalidate() borra todo', () => {
    availabilityCache.set('a', 1);
    availabilityCache.set('b', 2);
    availabilityCache.invalidate();
    expect(availabilityCache.get('a')).toBeNull();
    expect(availabilityCache.size()).toBe(0);
  });

  it('no crece sin limite: descarta lo mas viejo al pasar de 500 entradas', () => {
    for (let i = 0; i < 600; i++) {availabilityCache.set(`k${i}`, i);}
    expect(availabilityCache.size()).toBeLessThanOrEqual(500);
    expect(availabilityCache.get('k599')).toBe(599);
    expect(availabilityCache.get('k0')).toBeNull();
  });
});
