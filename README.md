# BI Practice Studio

A browser-based practice environment for Power BI concepts, built with React, TypeScript and Vite. The interface and guided course use English Power BI terminology. Imported data stays in the browser; no backend is needed.

Includes nine guided lessons with checks against the actual project, a final assessment, CSV/XLSX import, seven query transformations, one-to-many modeling, a DAX subset, eight visuals, filters, report pages and simulated Service publishing.

**This is an independent learning simulator, not a full Power BI clone.** See [the compatibility matrix](docs/COMPATIBILITY.md) for supported behavior, semantic differences, official references and remaining work. PBIX/PBIT, full DAX/M, DirectQuery and real cloud sharing are not supported.

## Develop

Use Node.js 24:

```sh
npm ci
npm run dev
```

Start with **Get data → Northstar sample data**, open **View lesson**, follow the instructions, then **Check my work**. The synthetic sample includes 240 sales, six products and twelve customers. Product names intentionally include whitespace for the cleaning lesson.

```sh
npm test
npm run build
npm run test:e2e
npm run preview
```

Local browser tests use `/usr/bin/chromium`; CI installs Playwright's pinned Chromium. Adjust `playwright.config.ts` if your browser is elsewhere. ExcelJS loads only when an XLSX is imported.

## GitHub Pages

[The workflow](.github/workflows/pages.yml) tests, builds and deploys changes pushed to main, and supports manual dispatch.

1. In repository **Settings → Pages → Build and deployment**, choose **GitHub Actions**.
2. Push the project to main, or run **Deploy practice studio to GitHub Pages** from Actions.
3. Use the deployment URL emitted by the deploy job after it succeeds.

Vite uses relative assets, supporting a repository subpath such as `/powerbi-web/`. Navigation stays inside one document; no history fallback is required. Saving this workflow is not evidence of a successful deployment.

## Projects and data

- Autosave uses localStorage; the header reports storage errors.
- **File → Export project** creates a versioned `.bipractice.json` containing data and progress.
- **File → Open project** validates a file before replacement. Undo restores the previous project in the current session.
- **File → New project** offers backup export before replacement.
- **Data view → Export CSV** exports transformed rows. **Print / PDF** prints the active report page.
- **Publish** creates an immutable local snapshot; it does not contact Microsoft or share data.

No external runtime fonts or CDN assets are needed. Documentation links open only when clicked. Storage is per browser, origin and device; export backups to keep or move your work.

## Structure

- `src/core/model.ts`: transformations, relationships and filters.
- `src/core/dax.ts`: parser and interpreter, without eval.
- `src/core/project.ts`: import/export and validation.
- `src/core/course.ts`: lessons, checks and assessment.
- `src/components`: data grid and chart rendering.
- `src/App.tsx`: Desktop-style and local Service workflows.
- `tests`: engine tests and browser scenarios.

No Microsoft binaries or proprietary code were copied. REA was reviewed but is not a dependency. The compatibility document records documentation access restrictions encountered during implementation.
