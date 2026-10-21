// Zod schema for show files (*.loadsheet.json, format "loadsheet/1").
// Every opened file is untrusted: it is validated here before anything reads it.

import { z } from 'zod';
import type { Hang, Row, Snapshot } from '../engine/types';

export const SHOW_FORMAT = 'loadsheet/1';

export const JOB_STATUSES = ['draft', 'issued', 'approved', 'superseded'] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

const isoDate = (what: string) =>
  z.iso.date({ error: `${what} must be a date in the form yyyy-mm-dd` }).nullable();

const nonNegative = (what: string) =>
  z.number({ error: `${what} must be a number` }).finite().nonnegative({ error: `${what} must not be negative` });

export const SnapshotSchema = z.object({
  kg: nonNegative('Snapshot weight').nullable(),
  per: z.enum(['each', 'm'], { error: 'Snapshot "per" must be "each" or "m"' }),
  swl_kg: nonNegative('Snapshot SWL').nullable(),
});

export const RowSchema = z
  .object({
    note: z.string({ error: 'Note must be text' }).nullable(),
    item: z.string({ error: 'Item must be text' }).nullable(),
    length_m: nonNegative('Length').nullable(),
    qty: z
      .number({ error: 'Quantity must be a number' })
      .int({ error: 'Quantity must be a whole number' })
      .nonnegative({ error: 'Quantity must not be negative' })
      .nullable(),
    snapshot: SnapshotSchema.nullable(),
  })
  .superRefine((row, ctx) => {
    if (row.item && row.snapshot === null) {
      ctx.addIssue({
        code: 'custom',
        path: ['snapshot'],
        message: `Item "${row.item}" has no snapshot of its weight and SWL`,
      });
    }
  });

const zoneRows = z.array(RowSchema, { error: 'Zone must be a list of rows' });

export const HangSchema = z.object({
  id: z.string(),
  name: z.string({ error: 'Hang name must be text' }),
  point_id: z.string(),
  over_people: z.boolean({ error: 'Load over people must be true, false or null' }).nullable(),
  hoist_orientation: z.enum(['body_down', 'body_up'], {
    error: 'Hoist orientation must be "body_down" or "body_up"',
  }),
  top_rigging_included: z.boolean({ error: 'Top rigging included must be true or false' }),
  point_capacity: z.object({
    kg: nonNegative('Point capacity').nullable(),
    source: z.string(),
    conditions: z.string(),
    print: z.boolean(),
  }),
  zones: z.object({
    top_rigging: zoneRows,
    hoist: zoneRows,
    hook: zoneRows,
    path1: zoneRows,
    path2: zoneRows,
  }),
});

export const JobSchema = z.object({
  name: z.string({ error: 'Job name must be text' }),
  date: isoDate('Job date'),
  designer: z.string(),
  venue: z.string(),
  status: z.enum(JOB_STATUSES, { error: 'Status must be draft, issued, approved or superseded' }),
  revision: z.string(),
  contingency: z
    .number({ error: 'Contingency must be a number' })
    .finite()
    .min(0, { error: 'Contingency must not be negative' })
    .max(1, { error: 'Contingency must be 100% or less' }),
  sheet_date: isoDate('Sheet date'),
});

export const ShowFileSchema = z.object({
  format: z.literal(SHOW_FORMAT, { error: `This is not a "${SHOW_FORMAT}" show file` }),
  app_version: z.string(),
  spec_version: z.string(),
  saved_at: z.iso.datetime({ offset: true, error: 'saved_at must be an ISO date and time' }),
  job: JobSchema,
  hangs: z.array(HangSchema).min(1, { error: 'A show file must contain at least one hang' }),
});

export type ShowFile = z.infer<typeof ShowFileSchema>;
export type Job = z.infer<typeof JobSchema>;

// The schema and the engine types must describe the same shape.
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
const sameSnapshot: Same<z.infer<typeof SnapshotSchema>, Snapshot> = true;
const sameRow: Same<z.infer<typeof RowSchema>, Row> = true;
const sameHang: Same<z.infer<typeof HangSchema>, Hang> = true;
void [sameSnapshot, sameRow, sameHang];
