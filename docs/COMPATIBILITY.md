# Compatibility and learning contract

BI Practice Studio is an independent educational implementation. It is not Power BI, a Microsoft product, or a binary-compatible replacement. Version 0.1 implements a subset of the Desktop learning workflow and a local Service publishing exercise. No Microsoft application binary, proprietary source, icons or assets were copied.

| Area     | Available                                                                                                             | Boundary                                                                                                                                              |
| -------- | --------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Connect  | CSV, XLSX, multiple worksheets, synthetic Northstar data                                                              | 10 MB limit; no databases or cloud connectors. Excel formulas use cached values.                                                                      |
| Prepare  | Trim, uppercase, number conversion, exact-match filter, rename, remove column, remove duplicates                      | Ordered steps over immutable source rows. No M interpreter, merge, append, pivot, unpivot or query folding.                                           |
| Model    | One-to-many relationships, matching types, unique dimension keys, single-direction filter propagation                 | No many-to-many, inactive or bidirectional relationships or automatic blank dimension member. Orphan facts remain unless a dimension constrains them. |
| DAX      | Measures, arithmetic, comparisons, nested functions, iterators, relationship lookup, defined filter context           | A subset interpreter, not DAX/VertiPaq. See below.                                                                                                    |
| Report   | Column, bar, line, area, donut, table, card, slicer; field wells, titles, colors, wide layout, duplicate/order/delete | Grid rather than free-position canvas. No custom visuals, bookmarks, drill-through or advanced formatting.                                            |
| Interact | Report-wide exact-value filters, slicers, bar/column/donut selection                                                  | One value per column; filters apply across pages. No visual/page scopes or full cross-highlighting.                                                   |
| Persist  | Browser autosave, undo/redo, JSON import/export, transformed CSV export, active-page print/PDF                        | Not PBIX/PBIT. Browser storage has limited capacity; export backups.                                                                                  |
| Learn    | Nine practical lessons with project checks and a five-question final assessment                                       | Completion records past achievement; later edits can change a completed exercise.                                                                     |
| Service  | Immutable local report snapshots and read-only reports                                                                | No real uploads, accounts, permissions, RLS, sharing, gateways, schedules, Fabric or license administration.                                          |

## DAX subset

Functions: SUM, AVERAGE, MIN, MAX, COUNT, DISTINCTCOUNT, COUNTROWS, SUMX, AVERAGEX, DIVIDE, IF, ROUND, ABS, BLANK, ISBLANK, TRUE, FALSE, COALESCE, RELATED, FILTER, CALCULATE. Measure syntax: `[Name]`. Column syntax: `Table[Column]` or `'Table name'[Column]`.

CALCULATE accepts equality filters (`Customers[Region] = "North"`), ALL(Table), REMOVEFILTERS(Table) and column variants. Filters on the same column are replaced. Measure evaluation in iterators applies row-context transition. RELATED follows a direct many-to-one relationship. Unsupported syntax and functions, cycles and non-scalar results produce explicit errors.

Differences from full DAX:

- No VAR/RETURN, time intelligence, calculated columns or calculated tables.
- No full DAX coercion or BLANK comparison semantics. Comparisons are strict, arithmetic treats BLANK as zero, and text is not automatically converted to numbers.
- COUNT counts nonblank values in this subset; full DAX has additional type-specific behavior.
- JavaScript numbers and rounding differ from DAX fixed-decimal and some rounding cases.
- No expanded-table semantics, automatic blank dimension row, ALLSELECTED or general CALCULATE table/predicate arguments.
- Empty aggregates return BLANK; DIVIDE returns BLANK or the alternate result for a zero denominator.

## Official references and evidence

These official links are curriculum reference targets for continued verification, not a claim that the complete documentation corpus has been read or implemented:

- [Power BI documentation](https://learn.microsoft.com/en-us/power-bi/)
- [Desktop getting started](https://learn.microsoft.com/en-us/power-bi/fundamentals/desktop-getting-started)
- [Connect data](https://learn.microsoft.com/en-us/power-bi/connect-data/desktop-quickstart-connect-to-data)
- [Power Query overview](https://learn.microsoft.com/en-us/power-bi/transform-model/desktop-query-overview)
- [Relationships](https://learn.microsoft.com/en-us/power-bi/transform-model/desktop-relationships-understand)
- [DAX basics](https://learn.microsoft.com/en-us/power-bi/transform-model/desktop-quickstart-learn-dax-basics)
- [DAX reference](https://learn.microsoft.com/en-us/dax/)
- [M reference](https://learn.microsoft.com/en-us/powerquery-m/)
- [Visuals](https://learn.microsoft.com/en-us/power-bi/visuals/power-bi-visualization-types-for-reports-and-q-and-a)
- [Filters](https://learn.microsoft.com/en-us/power-bi/create-reports/power-bi-report-add-filter)
- [Publishing](https://learn.microsoft.com/en-us/power-bi/create-reports/desktop-upload-desktop-files)

During implementation, the environment denied learn.microsoft.com (HTTP CONNECT 403). Attempts to retrieve the corresponding MicrosoftDocs repositories/files returned 404. Official page contents could not be verified in this session. The domain was added to the editable environment configuration; saving a draft does not activate access.

The suggested [morluto/rea](https://github.com/morluto/rea) was inspected at commit `144843ccc26bd372d61b8c6a27b37a01a5b0fb61`. It offers MIT-licensed reverse-engineering tools, not a reusable Power BI engine. It was not installed, incorporated or used to claim observation of Power BI runtime behavior. Differential compatibility testing still needs a licensed Windows Power BI instance and a real Service tenant.

## Next compatibility milestones

1. Verify every lesson against current official pages and run equivalent fixtures in real Desktop.
2. Add query joins, append, pivot/unpivot and a typed M subset with reference fixtures.
3. Add DAX variables, calculated columns, date tables and time intelligence.
4. Add canvas positioning, separate filter scopes, interactions, bookmarks and drill-through.
5. Expand Service exercises against verified documentation; distinguish simulated local operations from real cloud operations.

Full Power BI parity is not established by this project.
