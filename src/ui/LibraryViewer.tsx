// Read-only, searchable view of the Spec library.

import { useId, useMemo, useState } from 'react';
import { library } from '../library';
import { formatDate, formatSpecKg, formatSwl } from './format';
import { searchItems } from './item-search';

export function LibraryViewer() {
  const id = useId();
  const [query, setQuery] = useState('');
  const [tbcOnly, setTbcOnly] = useState(false);
  const items = useMemo(
    () => searchItems(library.items, query).filter((i) => !tbcOnly || i.kg === null),
    [query, tbcOnly],
  );
  const tbcCount = library.items.filter((i) => i.kg === null).length;

  return (
    <section className="card library" aria-labelledby="library-heading">
      <h2 id="library-heading">Spec library</h2>
      <p className="section-hint">
        Spec {library.spec_version} · {library.items.length} items · {tbcCount} with no recorded weight (TBC). Read
        only – library changes are made by pull request so a second person reviews every weight or rating.
      </p>
      <div className="library-tools">
        <div className="field">
          <label htmlFor={id}>Search</label>
          <input id={id} type="search" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <label className="checkbox">
          <input type="checkbox" checked={tbcOnly} onChange={(e) => setTbcOnly(e.target.checked)} />
          TBC items only
        </label>
        <p className="library-count" role="status">
          {items.length} shown
        </p>
      </div>
      <div className="table-scroll" tabIndex={0} role="region" aria-label="Spec library table">
        <table className="library-table">
          <thead>
            <tr>
              <th scope="col">Name</th>
              <th scope="col">kg</th>
              <th scope="col">Per</th>
              <th scope="col">SWL / WLL</th>
              <th scope="col">Weight note</th>
              <th scope="col">Source</th>
              <th scope="col">Verified</th>
            </tr>
          </thead>
          <tbody>
            {items.map((i) => (
              <tr key={i.name} className={i.kg === null ? 'tbc' : undefined}>
                <th scope="row">{i.name}</th>
                <td className="num" data-label="kg">{i.kg === null ? <strong>TBC</strong> : formatSpecKg(i.kg, i.per)}</td>
                <td data-label="Per">{i.per === 'm' ? 'metre' : 'each'}</td>
                <td className="num" data-label="SWL / WLL">{i.swl_kg ? formatSwl(i.swl_kg) : '–'}</td>
                <td data-label="Weight note">{i.weight_note ?? ''}</td>
                <td data-label="Source">{i.source ?? ''}</td>
                <td data-label="Verified">{formatDate(i.verified)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
