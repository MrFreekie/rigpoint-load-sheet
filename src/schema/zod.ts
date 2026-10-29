// Zod for the app's schemas. Import z from here, not from 'zod', so this runs first.
// jitless: Zod 4 otherwise probes `new Function('')` to see whether it may compile
// validators, and the strict Content Security Policy reports the blocked probe.

import { z } from 'zod';

z.config({ jitless: true });

export { z };
