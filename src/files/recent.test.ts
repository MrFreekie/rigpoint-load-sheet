import { describe, expect, it } from 'vitest';
import { memoryStore } from './autosave';
import { firstLaunchedFile } from './launch';
import { addRecent, listRecent, MAX_RECENT, removeRecent, sameHandle, type SameFile } from './recent';

// Real file handles compare with isSameEntry; plain objects stand in for them here.
type FakeHandle = { name: string };
const same: SameFile<FakeHandle> = async (a, b) => a.name === b.name;
const h = (name: string): FakeHandle => ({ name });

describe('recent files', () => {
  it('starts empty and ignores junk in storage', async () => {
    const store = memoryStore();
    expect(await listRecent(store)).toEqual([]);
    store.data.set('recent-files', [{ nope: 1 }, 'x', { name: 'a', usedAt: 1, handle: h('a') }]);
    expect((await listRecent<FakeHandle>(store)).map((r) => r.name)).toEqual(['a']);
  });

  it('puts the latest file first and does not repeat a file', async () => {
    const store = memoryStore();
    await addRecent(store, h('a'), same, 1);
    await addRecent(store, h('b'), same, 2);
    const list = await addRecent(store, h('a'), same, 3);
    expect(list.map((r) => [r.name, r.usedAt])).toEqual([
      ['a', 3],
      ['b', 2],
    ]);
  });

  it(`keeps at most ${MAX_RECENT}`, async () => {
    const store = memoryStore();
    for (let i = 0; i < MAX_RECENT + 3; i++) await addRecent(store, h(`f${i}`), same, i);
    const list = await listRecent<FakeHandle>(store);
    expect(list).toHaveLength(MAX_RECENT);
    expect(list[0]!.name).toBe(`f${MAX_RECENT + 2}`);
  });

  it('removes a file', async () => {
    const store = memoryStore();
    await addRecent(store, h('a'), same, 1);
    await addRecent(store, h('b'), same, 2);
    expect((await removeRecent(store, h('a'), same)).map((r) => r.name)).toEqual(['b']);
  });

  it('treats a handle that cannot be compared (e.g. its file was deleted) as a different file', async () => {
    const store = memoryStore();
    await addRecent(store, h('a'), same, 1);
    const failing: SameFile<FakeHandle> = async () => {
      throw new DOMException('gone', 'NotFoundError');
    };
    expect((await addRecent(store, h('b'), failing, 2)).map((r) => r.name)).toEqual(['b', 'a']);
  });
});

describe('recent files: failures and concurrency', () => {
  it('a comparison that throws at once (not a rejection) counts as a different file', async () => {
    const store = memoryStore();
    await addRecent(store, h('a'), same, 1);
    const throwing: SameFile<FakeHandle> = () => {
      throw new TypeError('isSameEntry is not a function');
    };
    expect((await addRecent(store, h('b'), throwing, 2)).map((r) => r.name)).toEqual(['b', 'a']);
    expect((await removeRecent(store, h('a'), throwing)).map((r) => r.name)).toEqual(['b', 'a']);
  });

  it('sameHandle turns a synchronous throw into a rejection', async () => {
    const broken = {} as FileSystemFileHandle; // no isSameEntry
    await expect(sameHandle(broken, broken)).rejects.toThrow();
  });

  it('adds made at the same time are all kept', async () => {
    const store = memoryStore();
    const slow = new Proxy(store, {
      get(target, prop, receiver) {
        if (prop === 'get') return async (k: string) => (await new Promise((r) => setTimeout(r, 5)), target.get(k));
        return Reflect.get(target, prop, receiver);
      },
    });
    await Promise.all([addRecent(slow, h('a'), same, 1), addRecent(slow, h('b'), same, 2), addRecent(slow, h('c'), same, 3)]);
    expect((await listRecent<FakeHandle>(store)).map((r) => r.name).sort()).toEqual(['a', 'b', 'c']);
  });
});

describe('launch queue', () => {
  const file = { kind: 'file', name: 'x.loadsheet.json' } as unknown as FileSystemHandle;
  const dir = { kind: 'directory', name: 'folder' } as unknown as FileSystemHandle;

  it('takes the first launched file', () => {
    expect(firstLaunchedFile({ files: [file] })).toBe(file);
  });

  it('ignores folders and empty launches', () => {
    expect(firstLaunchedFile({ files: [dir] })).toBeNull();
    expect(firstLaunchedFile({ files: [] })).toBeNull();
  });
});
