import { describe, expect, it } from 'vitest';
import { writeToHandle } from './fs-access';

/** A file handle whose writable stream records what happened to it. */
function fakeHandle(opts: { failWrite?: Error; failAbort?: boolean } = {}) {
  const calls: string[] = [];
  const writable = {
    write: async (text: string) => {
      calls.push(`write:${text}`);
      if (opts.failWrite) throw opts.failWrite;
    },
    close: async () => void calls.push('close'),
    abort: async () => {
      calls.push('abort');
      if (opts.failAbort) throw new Error('abort failed');
    },
  };
  const handle = { createWritable: async () => writable } as unknown as FileSystemFileHandle;
  return { handle, calls };
}

describe('writeToHandle', () => {
  it('writes then closes', async () => {
    const { handle, calls } = fakeHandle();
    await writeToHandle(handle, 'abc');
    expect(calls).toEqual(['write:abc', 'close']);
  });

  it('on a failed write, aborts (never closes) and reports the original error', async () => {
    const original = new DOMException('Disk full', 'QuotaExceededError');
    const { handle, calls } = fakeHandle({ failWrite: original });
    await expect(writeToHandle(handle, 'abc')).rejects.toBe(original);
    expect(calls).toEqual(['write:abc', 'abort']);
  });

  it('still reports the original error when the abort also fails', async () => {
    const original = new Error('write failed');
    const { handle } = fakeHandle({ failWrite: original, failAbort: true });
    await expect(writeToHandle(handle, 'abc')).rejects.toBe(original);
  });
});
