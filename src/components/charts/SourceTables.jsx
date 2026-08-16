/* ------------------------------------------------------------------
   Every number, in the shape it was reported in.

   The report is not one table — it is a stack of them: ballots issued,
   returned by mail, returned by drop box, mail requesters who voted in
   person instead, and turnout by site. Each has its own sub-columns.
   Flattening all of that into one wide table was the old behaviour and
   it lost the structure; tabs keep each table whole.

   Sub-columns (UOCAVA, domestic, the surrendered-ballot split) are
   hidden until asked for. They are a small fraction of every table and
   showing them by default triples the width for a reader who came for
   the total.

   The first tab is a summary across tables, because the most common
   question — how many ballots came in each day, by method — is the one
   question none of the source tables answers on its own.
------------------------------------------------------------------ */
import { useMemo, useState } from 'react';
import { fmt, longDate } from '../../lib/format.js';
import WeatherIcon from '../WeatherIcon.jsx';

/* Column tints. Each numeric column is scaled against its own maximum and
   tinted with its table's hue, so a column of small numbers still shows
   its own shape instead of being flattened by a larger column. Alpha tops
   out well below full so the figure stays legible in ink. */
const SUMMARY_RGB = {
  inPerson: [42, 120, 214],
  returnedMail: [235, 104, 52],
  returnedDropbox: [27, 175, 122],
  ballotsMailed: [124, 135, 155],
};
const MAX_ALPHA = 0.5;

/** Shared sort state: click a header to sort, click again to reverse. */
function useSort(initial = 'date') {
  const [key, setKey] = useState(initial);
  const [dir, setDir] = useState('asc');
  const click = (k) => {
    if (k === key) setDir(dir === 'asc' ? 'desc' : 'asc');
    else {
      setKey(k);
      setDir(k === 'date' ? 'asc' : 'desc');
    }
  };
  return { key, dir, click };
}

function sortRows(rows, { key, dir }, valueOf) {
  const a = [...rows];
  a.sort((x, y) => {
    if (key === 'date') {
      return dir === 'asc'
        ? x.date.localeCompare(y.date)
        : y.date.localeCompare(x.date);
    }
    const nx = valueOf(x, key) ?? -1;
    const ny = valueOf(y, key) ?? -1;
    return dir === 'asc' ? nx - ny : ny - nx;
  });
  return a;
}

function Th({ col, sort, onClick }) {
  const on = sort.key === col.k;
  const sortable = col.sortable !== false;
  return (
    <th
      onClick={() => sortable && onClick(col.k)}
      className={`${on ? 'is-on' : ''} ${sortable ? '' : 'is-static'}`}
      aria-sort={on ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      {/* Two-line headers: the group on top, the specific measure beneath.
          Splitting the label is what lets the column be as narrow as its
          numbers rather than as wide as its name — which is most of what
          was pushing this table off the side of a phone. */}
      <span className="th-l1">
        {col.l}
        {sortable && (
          <span className="caret">
            {on ? (sort.dir === 'asc' ? '▲' : '▼') : '↕'}
          </span>
        )}
      </span>
      <span className="th-l2">{col.l2 || ' '}</span>
    </th>
  );
}

/** rgba tint for a value against its column's own maximum. */
function tinter(rgb, max, on) {
  return (v) => {
    if (!on || v == null || !rgb || !max) return undefined;
    const [r, g, b] = rgb;
    // sqrt so the long tail of small days stays visible rather than
    // collapsing to white against a few very large ones.
    const a = Math.sqrt(Math.max(0, v) / max) * MAX_ALPHA;
    return `rgba(${r},${g},${b},${a.toFixed(3)})`;
  };
}

/* ---------------------------- summary tab ---------------------------- */

function SummaryTable({ ds, shade }) {
  const sort = useSort();

  const cols = [
    { k: 'date', l: 'Date', render: (r) => longDate(r.date) },
    { k: 'inPerson', l: 'In person', l2: 'ballots' },
    {
      k: 'returnedMail',
      l: 'Vote by mail',
      l2: ds.detail.returnRoute ? 'by mail' : 'returned',
    },
    /* A column the dataset does not record is left out entirely rather
       than filled with dashes: an empty column is still column width,
       and on a phone that is the scarce thing. */
    ds.detail.returnRoute && { k: 'returnedDropbox', l: 'Vote by mail', l2: 'drop box' },
    ds.detail.ballotsIssued && { k: 'ballotsMailed', l: 'Issued', l2: 'by mail' },
    ds.days.some((d) => d.weather) && {
      k: 'weather',
      l: 'Weather',
      l2: '',
      sortable: false,
      render: (r) =>
        r.weather ? (
          <span className={`wx ${r.weather.wet ? 'is-wet' : ''} ${r.weather.snowy ? 'is-snowy' : ''}`}>
            <WeatherIcon wet={r.weather.wet} snowy={r.weather.snowy} /> {r.weather.label},{' '}
            {Math.round(r.weather.tempMax)}°/{Math.round(r.weather.tempMin)}°
            {r.weather.precip >= 0.01 ? ` · ${r.weather.precip.toFixed(2)}″` : ''}
          </span>
        ) : '—',
    },
  ].filter(Boolean);

  const tint = useMemo(() => {
    const t = {};
    for (const c of cols) {
      if (!SUMMARY_RGB[c.k]) continue;
      const max = Math.max(...ds.days.map((d) => d[c.k] ?? 0), 1);
      t[c.k] = tinter(SUMMARY_RGB[c.k], max, shade);
    }
    return t;
  }, [ds, shade]);

  const rows = sortRows(ds.days, sort, (r, k) => r[k]);

  return (
    <table className="table">
      <thead>
        <tr>
          {cols.map((c) => (
            <Th key={c.k} col={c} sort={sort} onClick={sort.click} />
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.date}>
            {cols.map((c) => (
              <td
                key={c.k}
                className={c.k === 'date' ? 'td-date' : c.k === 'weather' ? 'td-wx' : 'td-num'}
                style={{ background: tint[c.k]?.(r[c.k]) }}
              >
                {c.render ? c.render(r) : fmt(r[c.k])}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/* --------------------------- one source table ------------------------ */

function SourceTable({ table, shade, detail }) {
  const sort = useSort();
  const shown = table.columns.filter((c) => detail || !c.detail);

  const tint = useMemo(() => {
    const t = {};
    for (const c of shown) {
      const max = Math.max(...table.rows.map((r) => r.values[c.key] ?? 0), 1);
      t[c.key] = tinter(table.hue, max, shade);
    }
    return t;
  }, [table, shade, detail]);

  const rows = sortRows(table.rows, sort, (r, k) => r.values[k]);
  const cols = [
    { k: 'date', l: 'Date' },
    ...shown.map((c) => ({ k: c.key, l: c.label })),
  ];

  return (
    <table className="table">
      <thead>
        <tr>
          {cols.map((c) => (
            <Th key={c.k} col={c} sort={sort} onClick={sort.click} />
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.date}>
            <td className="td-date">
              {longDate(r.date)}
              {/* Marks live on the row, next to the date they qualify,
                  rather than in a footnote the reader has to connect. */}
              {r.estimated && <abbr className="mark" title="Best-effort figure">†</abbr>}
              {r.corrected && <abbr className="mark" title="Includes an upstream correction">‡</abbr>}
              {r.span > 1 && (
                <abbr className="mark" title={`Covered by one combined figure spanning ${r.span} days`}>*</abbr>
              )}
            </td>
            {shown.map((c) => (
              <td
                key={c.key}
                className="td-num"
                style={{ background: tint[c.key]?.(r.values[c.key]) }}
              >
                {fmt(r.values[c.key])}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr>
          <td className="td-date">Total</td>
          {shown.map((c) => (
            <td key={c.key} className="td-num">
              {table.totals[c.key] == null ? '—' : fmt(table.totals[c.key])}
            </td>
          ))}
        </tr>
      </tfoot>
    </table>
  );
}

/* ------------------------------- shell ------------------------------- */

export default function SourceTables({ ds }) {
  const tabs = [
    { key: 'summary', label: 'Summary' },
    ...ds.tables.map((t) => ({ key: t.key, label: t.label })),
  ];
  const [tab, setTab] = useState('summary');
  const [shade, setShade] = useState(true);
  const [detail, setDetail] = useState(false);

  const active = ds.tables.find((t) => t.key === tab) || null;
  const hasDetail = active?.columns.some((c) => c.detail);

  const download = () => {
    let head;
    let lines;
    if (active) {
      const cols = active.columns.filter((c) => detail || !c.detail);
      head = ['date', ...cols.map((c) => c.key)];
      lines = active.rows.map((r) =>
        [r.date, ...cols.map((c) => r.values[c.key] ?? '')].join(','));
    } else {
      const fields = [
        ['early_in_person', (d) => d.inPerson],
        [ds.detail.returnRoute ? 'returned_by_mail' : 'vote_by_mail_returned',
          (d) => d.returnedMail],
        ...(ds.detail.returnRoute
          ? [['returned_by_dropbox', (d) => d.returnedDropbox]] : []),
        ...(ds.detail.ballotsIssued
          ? [['ballots_mailed', (d) => d.ballotsMailed]] : []),
      ];
      head = ['date', ...fields.map(([n]) => n)];
      lines = ds.days.map((d) =>
        [d.date, ...fields.map(([, get]) => get(d) ?? '')].join(','));
    }
    const blob = new Blob([[head.join(','), ...lines].join('\n')], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${ds.id}-${tab}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <section className="section">
      <div className="wrap">
        <div className="sec-head">
          <div>
            <div className="eyebrow">Full detail</div>
            <h2 className="h2">Every day, every number</h2>
          </div>
          <div className="table-tools">
            {hasDetail && (
              <label className="rhythm-check">
                <input
                  type="checkbox"
                  checked={detail}
                  onChange={(e) => setDetail(e.target.checked)}
                />
                Show sub-columns
              </label>
            )}
            <label className="rhythm-check">
              <input
                type="checkbox"
                checked={shade}
                onChange={(e) => setShade(e.target.checked)}
              />
              Shade by value
            </label>
            <button className="btn" onClick={download}>Download CSV</button>
          </div>
        </div>

        {tabs.length > 1 && (
          <div className="seg seg-tabs" role="tablist" aria-label="Source table">
            {tabs.map((t) => (
              <button
                key={t.key}
                role="tab"
                aria-selected={tab === t.key}
                className={tab === t.key ? 'is-on' : ''}
                onClick={() => setTab(t.key)}
              >
                {t.label}
              </button>
            ))}
          </div>
        )}

        <div className="card tablewrap">
          {active
            ? <SourceTable table={active} shade={shade} detail={detail} />
            : <SummaryTable ds={ds} shade={shade} />}
        </div>
        {active?.note && <p className="note" style={{ marginTop: 12 }}>{active.note}</p>}
      </div>
    </section>
  );
}
