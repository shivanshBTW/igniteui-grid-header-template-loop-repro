import { useEffect, useRef, useState } from 'react';
import {
  IgrColumn,
  IgrGrid,
  SortingDirection,
  type IgrGridHeaderTemplateContext,
} from '@infragistics/igniteui-react-grids';

const COLUMNS = Array.from({ length: 10 }, (_, i) => `col${i}`);

function makeData() {
  return Array.from({ length: 50 }, (_, i) => {
    const row: Record<string, number | string> = { id: i };
    for (const col of COLUMNS) row[col] = `${col}-${i}`;
    return row;
  });
}

// Any template prop whose context carries `ctx.implicit` (header icon
// templates, among others) is affected. These two are deliberately trivial —
// the regression is that the renderer re-invokes them on every internal grid
// update tick instead of only when the column's data actually changed, not
// anything in the template body itself.
export const counts = { sort: 0, filter: 0 };

function SortIcon(ctx: IgrGridHeaderTemplateContext) {
  counts.sort++;
  return <span style={{ marginLeft: 4 }}>↕</span>;
}

function FilterIcon(ctx: IgrGridHeaderTemplateContext) {
  counts.filter++;
  return <span style={{ marginLeft: 4 }}>⋮</span>;
}

export default function App() {
  const renderCount = useRef(0);
  renderCount.current += 1;
  const [, forceTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => forceTick((n) => n + 1), 250);
    return () => clearInterval(id);
  }, []);

  // Stand-in for any periodic data refresh (polling, websocket push, a layout
  // recompute interval, etc.) — a new `data` array reference is a normal,
  // common thing for a live grid to receive. This is what actually kicks the
  // grid's internal Lit update cycle on a recurring basis in a real app.
  const [data, setData] = useState(makeData);
  useEffect(() => {
    const id = setInterval(() => setData(makeData()), 100);
    return () => clearInterval(id);
  }, []);

  const gridRef = useRef<IgrGrid>(null);

  const stressTest = () => {
    let asc = true;
    for (let i = 0; i < 200; i++) {
      gridRef.current?.sort([
        { fieldName: 'col0', dir: asc ? SortingDirection.Asc : SortingDirection.Desc },
      ]);
      asc = !asc;
    }
  };

  return (
    <div style={{ padding: 16, fontFamily: 'sans-serif' }}>
      <h1>
        IgrGrid header template runaway re-invocation — 19.9.0 regression
        repro
      </h1>
      <p>
        <b>sortHeaderIconTemplate invocations: {counts.sort}</b>
        <br />
        <b>excelStyleHeaderIconTemplate invocations: {counts.filter}</b>
      </p>
      <p>
        These numbers climb continuously just from leaving this page open,
        with no sort/filter/column-width changes happening. See README.md for
        the exact upstream code diff this traces back to. In a larger grid
        (more columns, plus any app-level polling or layout-diff hook) this
        same defect compounds into a full React &quot;Maximum update depth
        exceeded&quot; crash — that's what prompted this report. This minimal
        shell reliably reproduces the underlying over-invocation; the button
        below is one attempt at forcing the full crash synchronously, though
        it isn't guaranteed to trip it in isolation.
      </p>
      <button onClick={stressTest}>Run 200 rapid sorts (optional stress test)</button>
      <div style={{ height: 400, width: 600 }}>
        <IgrGrid
          ref={gridRef}
          autoGenerate={false}
          data={data}
          height="100%"
          width="100%"
          allowFiltering
          filterMode="excelStyleFilter"
          sortHeaderIconTemplate={SortIcon}
          excelStyleHeaderIconTemplate={FilterIcon}
        >
          <IgrColumn field="id" header="ID" sortable />
          {COLUMNS.map((col) => (
            <IgrColumn key={col} field={col} header={col} sortable filterable />
          ))}
        </IgrGrid>
      </div>
    </div>
  );
}
