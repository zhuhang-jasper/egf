# Engineer Growth Framework

Single-page radar chart for the 7-pillar engineer growth framework.

## Stack

- [Vite](https://vite.dev/) + React (JavaScript)
- [Tailwind CSS](https://tailwindcss.com/) v4
- [shadcn/ui](https://ui.shadcn.com/) patterns (Radix primitives)
- [Zustand](https://zustand.docs.pmnd.rs/) for app state
- [Chart.js](https://www.chartjs.org/) radar chart

## Development

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

## URL flags

| Query      | Effect                                                             |
| ---------- | ------------------------------------------------------------------ |
| `?ai=1`    | Show AI inputs, AI chart layer, AI pillar labels, and AI average   |
| `?score=1` | Show footer score boxes (Pillar Avg, Strength index, Career level) |

Examples: `/?ai=1`, `/?ai=1&score=1`

## Build

```bash
npm run build
npm run preview
```

Output is in `dist/`.

## Legacy

The original single-file app is preserved at [`legacy/index.html`](legacy/index.html).
