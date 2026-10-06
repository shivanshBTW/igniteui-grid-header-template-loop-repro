import {
  IgrColumn,
  IgrGrid,
  type IgrGridHeaderTemplateContext,
} from '@infragistics/igniteui-react-grids';

const data = Array.from({ length: 20 }, (_, i) => ({
  id: i,
  name: `Item ${i}`,
  qty: i * 3,
}));

const SortIcon = (_ctx: IgrGridHeaderTemplateContext) => <span>↕</span>;
const FilterIcon = (_ctx: IgrGridHeaderTemplateContext) => <span>⋮</span>;

const params = new URLSearchParams(location.search);
const withHeaderTemplates = params.get('headerTemplates') !== 'off';
const undefinedTemplateProp = params.get('undefinedProp') !== 'omit';

// A template prop that is conditionally disabled, e.g.
// rowEditTextTemplate={isRowEditable ? MyTemplate : undefined}
const conditionalTemplateProps = undefinedTemplateProp
  ? { rowEditTextTemplate: undefined }
  : {};

export default function App() {
  return (
    <div style={{ padding: 16, fontFamily: 'sans-serif' }}>
      <h1>IgrGrid 19.9.0: Maximum update depth exceeded</h1>
      <p>
        header icon templates: <b>{withHeaderTemplates ? 'on' : 'off'}</b> ·
        rowEditTextTemplate:{' '}
        <b>{undefinedTemplateProp ? 'passed as undefined' : 'omitted'}</b>
      </p>
      <p>
        <a href="?">both (hangs)</a> ·{' '}
        <a href="?headerTemplates=off">header templates off (ok)</a> ·{' '}
        <a href="?undefinedProp=omit">undefined prop omitted (ok)</a>
      </p>
      <div style={{ height: 400, width: 600 }}>
        <IgrGrid
          autoGenerate={false}
          data={data}
          height="100%"
          width="100%"
          allowFiltering
          filterMode="excelStyleFilter"
          {...conditionalTemplateProps}
          {...(withHeaderTemplates && {
            sortHeaderIconTemplate: SortIcon,
            excelStyleHeaderIconTemplate: FilterIcon,
          })}
        >
          <IgrColumn field="id" header="ID" sortable />
          <IgrColumn field="name" header="Name" sortable filterable />
          <IgrColumn field="qty" header="Qty" sortable filterable />
        </IgrGrid>
      </div>
    </div>
  );
}
