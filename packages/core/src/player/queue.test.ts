import { describe, expect, it } from 'vitest';
import {
  currentTrack, cycleRepeat, emptyQueue, enqueue, moveInUpNext, next, playContext, playNext, previous,
  removeFromUpNext, setShuffle, shuffled, trackEnded, upcoming, type QueueState,
} from './queue';

type T = { id: string };
const tracks = (n: number): T[] => Array.from({ length: n }, (_, i) => ({ id: `t${i}` }));
const ids = (list: readonly T[]) => list.map((t) => t.id);
/** Tekrarlanabilir rastgele sayı üreteci (mulberry32). */
const seeded = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let x = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
  return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
};
const start = (n = 5, at = 0, s: QueueState<T> = emptyQueue<T>()) => playContext(s, tracks(n), at, 'pl1');

describe('bağlam ve sıra', () => {
  it('bağlamı istenen şarkıdan başlatır', () => {
    const s = start(5, 2);
    expect(currentTrack(s)?.id).toBe('t2');
    expect(ids(upcoming(s))).toEqual(['t3', 't4']);
  });

  it('sonuna gelince tekrar kapalıysa durur', () => {
    let s = start(2, 1);
    const r = next(s);
    expect(r.track).toBeNull();
    s = r.state;
    expect(currentTrack(s)?.id).toBe('t1');
  });

  it('tekrar "tümü" ise başa döner', () => {
    const s = cycleRepeat(start(3, 2));
    expect(s.repeat).toBe('all');
    expect(next(s).track?.id).toBe('t0');
  });

  it('tekrar "tek" ise şarkı bitince baştan çalar, elle "sonraki" yine ilerler', () => {
    const s = cycleRepeat(cycleRepeat(start(3, 0)));
    expect(s.repeat).toBe('one');
    expect(trackEnded(s)).toMatchObject({ restart: true, track: { id: 't0' } });
    expect(next(s).track?.id).toBe('t1');
  });

  it('tekrar döngüsü kapalı -> tümü -> tek -> kapalı', () => {
    let s = start();
    const seen = [s.repeat];
    for (let i = 0; i < 3; i++) { s = cycleRepeat(s); seen.push(s.repeat); }
    expect(seen).toEqual(['off', 'all', 'one', 'off']);
  });

  it('boş bağlam boş kuyruk verir, ayarlar korunur', () => {
    const s = playContext(cycleRepeat(emptyQueue<T>()), [], 0);
    expect(currentTrack(s)).toBeNull();
    expect(s.repeat).toBe('all');
    expect(next(s).track).toBeNull();
  });
});

describe('önceki', () => {
  it('3 saniyeden fazla çaldıysa şarkıyı baştan alır', () => {
    const s = start(5, 2);
    expect(previous(s, 10)).toMatchObject({ restart: true, track: { id: 't2' } });
  });

  it('3 saniyeden azsa bir önceki şarkıya gider', () => {
    expect(previous(start(5, 2), 1).track?.id).toBe('t1');
  });

  it('ilk şarkıda, tekrar kapalıyken baştan alır; tekrar "tümü" ise sona gider', () => {
    expect(previous(start(5, 0), 0)).toMatchObject({ restart: true, track: { id: 't0' } });
    expect(previous(cycleRepeat(start(5, 0)), 0).track?.id).toBe('t4');
  });

  it('"Sıradaki"nden çalarken bağlamdaki son şarkıya döner', () => {
    const s = next(enqueue(start(5, 1), { id: 'x' })).state;
    expect(currentTrack(s)?.id).toBe('x');
    expect(previous(s, 0).track?.id).toBe('t1');
  });
});

describe('Sıradaki (elle eklenen)', () => {
  it('bağlamdan önce çalar, sonra bağlam kaldığı yerden devam eder', () => {
    let s = enqueue(start(5, 1), { id: 'a' }, { id: 'b' });
    expect(ids(upcoming(s))).toEqual(['a', 'b', 't2', 't3', 't4']);
    const played: string[] = [];
    for (let i = 0; i < 4; i++) { const r = next(s); s = r.state; played.push(r.track?.id ?? '-'); }
    expect(played).toEqual(['a', 'b', 't2', 't3']);
  });

  it('"Sonra çal" listenin başına ekler', () => {
    const s = playNext(enqueue(start(), { id: 'a' }), { id: 'b' });
    expect(ids(s.upNext)).toEqual(['b', 'a']);
  });

  it('çıkarma ve taşıma', () => {
    let s = enqueue(start(), { id: 'a' }, { id: 'b' }, { id: 'c' });
    s = moveInUpNext(s, 2, 0);
    expect(ids(s.upNext)).toEqual(['c', 'a', 'b']);
    s = removeFromUpNext(s, 1);
    expect(ids(s.upNext)).toEqual(['c', 'b']);
    expect(moveInUpNext(s, 5, 0)).toBe(s);
  });

  it('yeni bağlam başlatmak "Sıradaki" listesini korur', () => {
    const s = playContext(enqueue(start(), { id: 'a' }), tracks(3), 0, 'al2');
    expect(ids(s.upNext)).toEqual(['a']);
    expect(s.contextId).toBe('al2');
  });
});

describe('karışık çalma', () => {
  it('Fisher-Yates: aynı tohum aynı sonucu verir, hiçbir öğe kaybolmaz', () => {
    const list = tracks(20);
    const a = shuffled(list, seeded(7));
    expect(ids(a)).toEqual(ids(shuffled(list, seeded(7))));
    expect([...ids(a)].sort()).toEqual([...ids(list)].sort());
    expect(ids(a)).not.toEqual(ids(list));
  });

  it('dağılım tarafsız: her öğe her konuma yaklaşık eşit sıklıkta düşer', () => {
    const n = 4;
    const runs = 40000;
    const counts = Array.from({ length: n }, () => new Array<number>(n).fill(0));
    const rng = seeded(42);
    for (let r = 0; r < runs; r++) shuffled([0, 1, 2, 3], rng).forEach((v, pos) => { counts[v]![pos]! += 1; });
    const expected = runs / n;
    for (const row of counts) for (const c of row) expect(Math.abs(c - expected) / expected).toBeLessThan(0.05);
  });

  it('açınca çalan şarkı yerinde kalır, aynı şarkı tekrar gelmez', () => {
    let s = setShuffle(start(10, 3), true, seeded(1));
    expect(currentTrack(s)?.id).toBe('t3');
    const seen = new Set([currentTrack(s)?.id]);
    for (let i = 0; i < 9; i++) { const r = next(s); s = r.state; seen.add(r.track?.id); }
    expect(seen.size).toBe(10);
    expect(next(s).track).toBeNull();
  });

  it('kapatınca özgün sıradaki yerine döner', () => {
    let s = setShuffle(start(10, 0), true, seeded(3));
    s = next(next(s).state).state;
    const playing = currentTrack(s)?.id;
    s = setShuffle(s, false);
    expect(currentTrack(s)?.id).toBe(playing);
    expect(s.order).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(upcoming(s)[0]?.id).toBe(`t${Number(playing?.slice(1)) + 1}`);
  });

  it('karışık bağlam başlatınca seçilen şarkı ilk çalar', () => {
    const s = playContext(setShuffle(emptyQueue<T>(), true), tracks(8), 5, 'pl1', seeded(9));
    expect(currentTrack(s)?.id).toBe('t5');
    expect(s.position).toBe(0);
  });

  it('karışık + tekrar "tümü": tur bitince yeniden karıştırıp devam eder', () => {
    let s = cycleRepeat(playContext(setShuffle(emptyQueue<T>(), true), tracks(4), 0, null, seeded(5)));
    for (let i = 0; i < 3; i++) s = next(s, seeded(i)).state;
    const r = next(s, seeded(11));
    expect(r.track).not.toBeNull();
    expect(r.state.position).toBe(0);
    expect([...r.state.order].sort()).toEqual([0, 1, 2, 3]);
  });
});
