import { Chart } from "chart.js";

// Chart.js defaults to Helvetica Neue / Arial for all in-canvas text (radar point labels, the
// L1–L5 ticks). Point it at the bundled Inter so the chart's own labels match the rest of the
// app and the exported PNGs — one typeface on every device, instead of a Helvetica island that
// varies by OS. Chart.defaults is a global singleton, so setting it once here (imported early
// from main.jsx) covers every chart instance regardless of where it's registered.
//
// Note: canvas text can't drive Inter's variable opsz axis (it resolves to the nearest static
// instance), so chart labels don't get optical sizing — fine for small label text.
Chart.defaults.font.family = '"Inter Variable", system-ui, sans-serif';
