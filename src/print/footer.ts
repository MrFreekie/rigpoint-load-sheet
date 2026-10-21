import { isoWithOffset } from '../files/show-io';
import { formatDate } from '../ui/format';

/** Footer on every print: makes the printout traceable to the code, data and file (BRIEF.md 10.10). */
export function printFooter(opts: {
  appVersion: string;
  showSpec: string;
  librarySpec: string;
  fileName: string | null;
  defaultName: string;
  dirty: boolean;
  printedAt: Date;
}): string {
  const spec = opts.showSpec === opts.librarySpec ? opts.showSpec : `${opts.showSpec} (app library ${opts.librarySpec})`;
  const file = opts.fileName
    ? `${opts.fileName}${opts.dirty ? ' (unsaved changes)' : ''}`
    : `${opts.defaultName} (not saved)`;
  const time = opts.printedAt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  return `RigPoint Load Sheet app ${opts.appVersion} · Spec ${spec} · ${file} · Printed ${formatDate(isoWithOffset(opts.printedAt).slice(0, 10))} ${time}`;
}
