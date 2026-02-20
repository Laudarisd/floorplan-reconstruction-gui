import React from 'react';
import '../../image_mode/style/tasks/visualization.css';

const DwgVisualizationPanel = () => {
  // Temporary DWG visualization placeholder.
  return (
    <div className="visualization-panel-wrap">
      <h3 className="viz-section-title">DWG Visualization Panel</h3>
      <div className="viz-shell">
        <div className="visualization-section" id="dwgVisualizationSection">
          <div className="viz-empty-state">DWG visualization mode selected. Panel implementation is next.</div>
        </div>
      </div>
    </div>
  );
};

export default DwgVisualizationPanel;
