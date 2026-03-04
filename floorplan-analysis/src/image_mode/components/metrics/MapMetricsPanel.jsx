// Codex Note: components/metrics/MapMetricsPanel.jsx - Metrics panel for map calculation view.
import React, { useMemo, useState } from 'react';
import '../../style/tasks/map-metrics.css';

const METRIC_COPY = {
  title: 'Map Metrics',
  general: 'General Metric',
  custom: 'Our Metric',
  headers: ['GT', 'TP', 'FP', 'FN'],
};

const ZERO_ROW = {
  gt: 0,
  tp: 0,
  fp: 0,
  fn: 0,
};

const safeNumber = (value) => Number(value || 0);

const computeRecall = ({ tp, fn }) => {
  const denom = safeNumber(tp) + safeNumber(fn);
  if (denom === 0) return 0;
  return safeNumber(tp) / denom;
};

const computePrecision = ({ tp, fp }) => {
  const denom = safeNumber(tp) + safeNumber(fp);
  if (denom === 0) return 0;
  return safeNumber(tp) / denom;
};

const computeMap = ({ precision, recall }) => {
  return (safeNumber(precision) + safeNumber(recall)) / 2;
};

const formatMetric = (value) => value.toFixed(4);

const MapMetricsPanel = ({ showTitle = true }) => {
  // Keep metric mode local for quick toggle UX.
  const [metricMode, setMetricMode] = useState('general');

  // Default placeholders are zeros until backend calculations are wired.
  const row = ZERO_ROW;

  // Compute metric values from current table row.
  const metrics = useMemo(() => {
    const recall = computeRecall(row);
    const precision = computePrecision(row);
    const mAP = computeMap({ precision, recall });
    return { recall, precision, mAP };
  }, [row]);

  return (
    <aside className="map-metrics-panel">
      {showTitle && (
        <div className="map-metrics-header">
          <h4 className="map-metrics-title">{METRIC_COPY.title}</h4>
        </div>
      )}

      <div className="map-metrics-toggle-row">
        <button
          type="button"
          className={`map-metrics-toggle ${metricMode === 'general' ? 'is-active' : ''}`}
          onClick={() => setMetricMode('general')}
        >
          {METRIC_COPY.general}
        </button>
        <button
          type="button"
          className={`map-metrics-toggle ${metricMode === 'our' ? 'is-active' : ''}`}
          onClick={() => setMetricMode('our')}
        >
          {METRIC_COPY.custom}
        </button>
      </div>

      {metricMode === 'general' ? (
        <div className="map-metrics-content">
          <table className="map-metrics-table">
            <thead>
              <tr>
                {METRIC_COPY.headers.map((header) => (
                  <th key={header}>{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>{row.gt}</td>
                <td>{row.tp}</td>
                <td>{row.fp}</td>
                <td>{row.fn}</td>
              </tr>
            </tbody>
          </table>

          <div className="map-metrics-formulas">
            <div>Recall = TP / (TP + FN) = {formatMetric(metrics.recall)}</div>
            <div>Precision = TP / (TP + FP) = {formatMetric(metrics.precision)}</div>
            <div>mAP = (Precision + Recall) / 2 = {formatMetric(metrics.mAP)}</div>
          </div>
        </div>
      ) : (
        <div className="map-metrics-content">
          <div className="map-metrics-formulas">
            <div>Our metric view is reserved for your custom formula set.</div>
            <div>We can plug your project-specific score definitions here next.</div>
          </div>
        </div>
      )}
    </aside>
  );
};

export default MapMetricsPanel;
