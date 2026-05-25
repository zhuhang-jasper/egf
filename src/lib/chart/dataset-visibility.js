/** Toggle polygon dataset visibility without mutating chart data. Returns true if anything changed. */
export function syncLevelDatasetsVisibility(chart, hidden) {
  if (!chart) {return false;}

  const visible = !hidden;
  let changed = false;

  for (let i = 0; i < chart.data.datasets.length; i++) {
    if (chart.isDatasetVisible(i) !== visible) {
      chart.setDatasetVisibility(i, visible);
      changed = true;
    }
  }

  return changed;
}
