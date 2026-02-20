import React from 'react';
import '../../image_mode/style/tasks/visualization.css';

const DwgVisualizationPanel = ({ dwgUploadData }) => {
  // Temporary DWG visualization placeholder.
  const layerCount = dwgUploadData?.layers?.length || 0;
  const originalName = dwgUploadData?.originalImage?.name || 'N/A';

  return (
    <div className="visualization-panel-wrap">
      <h3 className="viz-section-title">DWG Visualization Panel</h3>
      <div className="viz-shell">
        <div className="visualization-section" id="dwgVisualizationSection">
          <div className="viz-empty-state">
            DWG visualization mode selected. Loaded original: {originalName} | Layers: {layerCount}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DwgVisualizationPanel;
