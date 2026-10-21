// Utilisation with its traffic light. Always a word and a percentage, never colour alone.

import type { Light } from '../engine/types';
import { formatPct, LIGHT_WORDS } from './format';

export function TrafficLight({ used, light, large }: { used: number; light: Light | null; large?: boolean }) {
  return (
    <span className={`light light-${light ?? 'none'}${large ? ' light-large' : ''}`}>
      <span className="light-dot" aria-hidden="true" />
      <span className="light-pct">{formatPct(used)}</span>
      {light ? <strong className="light-word">{LIGHT_WORDS[light]}</strong> : null}
    </span>
  );
}
