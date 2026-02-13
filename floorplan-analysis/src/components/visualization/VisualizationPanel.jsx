import React, { useEffect, useCallback } from 'react';
import { useVisualization } from '../../hooks/useVisualization';
import GifPlaceholder from '../shared/GifPlaceholder';
import '../../style/tasks/visualization.css';

const VIZ_COPY = {
  loadingCaption: 'Preparing visualization...',
  empty: 'Upload an image to see visualization',
  showText: 'Show Annotation Text',
  hideText: 'Hide Annotation Text',
  showPoints: 'Show Key Points',
  hidePoints: 'Hide Key Points',
  zoomIn: 'Zoom In',
  zoomOut: 'Zoom Out',
  reset: 'Reset Zoom',
  dimensionLabel: 'Dimension Areas:',
};

const VIZ_CLASSNAMES = {
  section: 'visualization-section',
  controls: 'annotation-controls',
  viewer: 'viewer-panel',
  zoomContainer: 'zoom-container',
  content: 'gif-content',
};

const VisualizationPanel = ({
  zipData,
  selectedFile,
  uploadedImage,
  loading,
  setLoading,
}) => {
  const viz = useVisualization(uploadedImage);

  // Parse selected JSON and draw annotations on canvas
  useEffect(() => {
    if (!selectedFile || selectedFile.type !== 'json' || !uploadedImage) return;

    try {
      let jsonData;
      if (typeof selectedFile.content === 'string') {
        jsonData = JSON.parse(selectedFile.content);
      } else {
        jsonData = selectedFile.content;
      }

      viz.visualizeJson(selectedFile.fileName, jsonData);

      // Delay ensures DOM + canvas dimensions are ready
      setTimeout(() => {
        viz.updateView();
      }, 100);
    } catch (error) {
      console.error('Error visualizing JSON:', error);
      setLoading((prev) => ({ ...prev, visualization: false }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFile, uploadedImage]);

  // Redraw canvas when toggles change
  useEffect(() => {
    viz.redrawAnnotations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viz.showAnnotationText, viz.showKeyPoints, viz.hiddenDimensionIndices]);

  // Resize canvas when zoom or image size changes
  useEffect(() => {
    viz.updateView();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viz.zoom, viz.originalWidth, viz.originalHeight]);

  const handleClassToggle = useCallback(() => {
    viz.redrawAnnotations();
  }, [viz]);

  const handleDimensionToggle = useCallback((e, idx) => {
    viz.toggleDimensionIndex(parseInt(idx, 10));
  }, [viz]);

  const renderClassControls = () => {
    const classMap = viz.classMapRef.current;
    if (!classMap || Object.keys(classMap).length === 0) return null;

    const dimensionIndices = new Set();
    Object.values(classMap).forEach((objs) => {
      objs.forEach((o) => {
        if (o.kind === 'ocr_text' && o.cropIdx !== undefined) {
          dimensionIndices.add(o.cropIdx);
        }
      });
    });

    return (
      <div id="annotationControls" className={VIZ_CLASSNAMES.controls}>
        {Object.keys(classMap)
          .sort()
          .map((cls) => (
            <label key={`class-${cls}`}>
              <input
                type="checkbox"
                defaultChecked
                id={`class-toggle-${cls.replace(/\s/g, '-').replace(/:/g, '-')}`}
                onChange={handleClassToggle}
              />
              {` ${cls} (${classMap[cls].length})`}
            </label>
          ))}

        {dimensionIndices.size > 0 && (
          <div className="dimension-controls">
            <div className="dimension-title">{VIZ_COPY.dimensionLabel}</div>
            {Array.from(dimensionIndices)
              .sort((a, b) => a - b)
              .map((idx) => (
                <label key={`dimension-${idx}`}>
                  <input
                    type="checkbox"
                    defaultChecked
                    id={`dimension-toggle-${idx}`}
                    onChange={(e) => handleDimensionToggle(e, idx)}
                  />
                  {` Dimension [${idx}]`}
                </label>
              ))}
          </div>
        )}
      </div>
    );
  };

  const renderContent = () => {
    return (
      <div id="vizContent" className={VIZ_CLASSNAMES.content}>
        <div className="viz-workspace">
          <div className="viz-actions-sidebar">
            <button
              onClick={() => viz.setShowAnnotationText(!viz.showAnnotationText)}
              className="btn viz-action-btn"
              disabled={!uploadedImage}
            >
              {viz.showAnnotationText ? VIZ_COPY.hideText : VIZ_COPY.showText}
            </button>
            <button
              onClick={() => viz.setShowKeyPoints(!viz.showKeyPoints)}
              className="btn viz-action-btn"
              disabled={!uploadedImage}
            >
              {viz.showKeyPoints ? VIZ_COPY.hidePoints : VIZ_COPY.showPoints}
            </button>
            <button onClick={viz.zoomIn} className="btn viz-action-btn" disabled={!uploadedImage}>
              {VIZ_COPY.zoomIn}
            </button>
            <button onClick={viz.zoomOut} className="btn viz-action-btn" disabled={!uploadedImage}>
              {VIZ_COPY.zoomOut}
            </button>
            <button onClick={viz.resetZoom} className="btn viz-action-btn" disabled={!uploadedImage}>
              {VIZ_COPY.reset}
            </button>
            <span className="zoom-label">Zoom: {viz.getZoomPercentage()}%</span>
          </div>

          <div className="viz-main">
            {renderClassControls()}

            {!uploadedImage ? (
              <div className="viz-empty-state">{VIZ_COPY.empty}</div>
            ) : (
              <div id="viewer" ref={viz.viewerRef} className={VIZ_CLASSNAMES.viewer}>
                <div id="zoomContainer" className={VIZ_CLASSNAMES.zoomContainer}>
                  <img
                    id="mainImage"
                    src={uploadedImage}
                    alt="Floorplan"
                    className="main-image"
                    onLoad={() => viz.handleImageLoad()}
                  />
                  <canvas id="mainCanvas" ref={viz.canvasRef} className="main-canvas" />
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="viz-grid">
          {[1, 2, 3, 4, 5].map((idx) => (
            <div key={`viz${idx}`} id={`viz${idx}`} className="viz-item">
              <label id={`vizLabel${idx}`} className="viz-label">
                Image {idx}
              </label>
              <img id={`vizImg${idx}`} src="" alt={`Visualization ${idx}`} className="viz-img" />
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className={VIZ_CLASSNAMES.section} id="visualizationSection">
      {loading ? (
        <div id="vizGif" className="gif-placeholder">
          <GifPlaceholder gifSrc="/assets/Loader cat.gif" caption={VIZ_COPY.loadingCaption} />
        </div>
      ) : (
        renderContent()
      )}
    </div>
  );
};

export default VisualizationPanel;
