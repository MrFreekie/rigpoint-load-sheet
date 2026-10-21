// Job and hang panels (BRIEF.md 9.2 and 9.3).

import type { Dispatch } from 'react';
import { WARNING_MESSAGES } from '../engine/messages';
import type { HoistOrientation } from '../engine/types';
import { JOB_STATUSES, type JobStatus } from '../schema/show-file';
import type { EditorAction, EditorHang, EditorShow } from './editor';
import { ChoiceField, DateField, NumberField, SelectField, TextField } from './fields';
import { contingencyToPercent } from './format';

const STATUS_LABELS: Record<JobStatus, string> = {
  draft: 'Draft',
  issued: 'Issued',
  approved: 'Approved',
  superseded: 'Superseded',
};

export function JobPanel({ job, dispatch }: { job: EditorShow['job']; dispatch: Dispatch<EditorAction> }) {
  const set = <F extends keyof EditorShow['job']>(field: F, value: EditorShow['job'][F]) =>
    dispatch({ type: 'job', field, value });
  return (
    <section className="card panel" aria-labelledby="job-heading">
      <h2 id="job-heading">Job</h2>
      <div className="grid">
        <TextField className="span-2" label="Job" value={job.name} onChange={(v) => set('name', v)} />
        <DateField label="Job Date" value={job.date} onChange={(v) => set('date', v)} />
        <TextField label="Designer" value={job.designer} onChange={(v) => set('designer', v)} />
        <TextField className="span-2" label="Venue" value={job.venue} onChange={(v) => set('venue', v)} />
        <SelectField
          label="Status"
          value={job.status}
          options={JOB_STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] }))}
          onChange={(v) => set('status', v)}
        />
        <TextField label="Revision" value={job.revision} placeholder="blank for first issue" onChange={(v) => set('revision', v)} />
        <NumberField
          label="Contingency"
          unit="%"
          max={100}
          required
          value={contingencyToPercent(job.contingency)}
          onChange={(v) => v !== null && set('contingency', v / 100)}
          hint="Unlisted items and measurement error. Not a safety factor."
        />
      </div>
      {job.contingency === 0 ? (
        <p className="warning" role="status">
          ⚠ {WARNING_MESSAGES.contingency_zero}
        </p>
      ) : null}
    </section>
  );
}

const ORIENTATION_HINTS: Record<HoistOrientation, string> = {
  body_down: 'Body down: the hoist hangs from the load and climbs its chain (usual for touring).',
  body_up: 'Body up: the hoist is fixed at the top and the chain hangs down to the load.',
};

export function HangPanel({ hang, dispatch }: { hang: EditorHang; dispatch: Dispatch<EditorAction> }) {
  return (
    <section className="card panel" aria-labelledby="hang-heading">
      <h2 id="hang-heading">Hang</h2>
      <div className="grid">
        <TextField
          className="span-2"
          label="Sub System"
          placeholder="e.g. Main Hang Left"
          value={hang.name}
          onChange={(v) => dispatch({ type: 'hang', field: 'name', value: v })}
        />
        <TextField
          className="span-2"
          label="Point ID / Location"
          value={hang.point_id}
          onChange={(v) => dispatch({ type: 'hang', field: 'point_id', value: v })}
        />
        <ChoiceField
          className="span-2"
          legend="Load over people?"
          value={hang.over_people}
          options={[
            { value: true, label: 'Yes' },
            { value: false, label: 'No' },
            { value: null, label: 'Not stated' },
          ]}
          onChange={(v) => dispatch({ type: 'hang', field: 'over_people', value: v })}
        />
        <ChoiceField
          className="span-2"
          legend="Top rigging included?"
          value={hang.top_rigging_included}
          options={[
            { value: true, label: 'Yes' },
            { value: false, label: 'No' },
          ]}
          onChange={(v) => dispatch({ type: 'hang', field: 'top_rigging_included', value: v })}
          hint={
            hang.top_rigging_included
              ? 'Components above the hoist are listed in the top rigging zone and checked.'
              : 'Components above the hoist are NOT listed and NOT checked.'
          }
        />
        <ChoiceField
          className="span-4"
          legend="Hoist orientation"
          value={hang.hoist_orientation}
          options={[
            { value: 'body_down', label: 'Body down' },
            { value: 'body_up', label: 'Body up' },
          ]}
          onChange={(v) => dispatch({ type: 'hang', field: 'hoist_orientation', value: v })}
          hint={
            <>
              {ORIENTATION_HINTS.body_down}
              <br />
              {ORIENTATION_HINTS.body_up}
            </>
          }
        />
      </div>
    </section>
  );
}
