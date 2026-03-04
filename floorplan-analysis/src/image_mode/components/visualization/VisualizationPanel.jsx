// Codex Note: components/visualization/VisualizationPanel.jsx - Main logic for this module/task.
import React, { useEffect, useCallback, useState } from 'react';
import { useVisualization } from '../../hooks/useVisualization.jsx';
import GifPlaceholder from '../shared/GifPlaceholder';
import { MAP_ANALYZE_TYPES, MAP_UPLOAD_ACCEPT } from '../../../map_cal/constants/mapTargets.js';
import { extractMapDataFile } from '../../../map_cal/services/fileExtractionService.jsx';
import '../../style/tasks/visualization.css';

const VIZ_COPY = {
  title: 'Visualization Panel',
  loadingCaption: 'Preparing visualization...',
  empty: 'Upload an image to see visualization',
  showText: 'Show Text',
  hideText: 'Hide Text',
  showPoints: 'Show Key Points',
  hidePoints: 'Hide Key Points',
  zoomIn: 'Zoom In',
  zoomOut: 'Zoom Out',
  reset: 'Reset Zoom',
  dimensionLabel: 'Dimension Areas:',
  featureTitle: 'Features',
  analyzePanelTitle: 'Analyze Results',
  analyzeTypeLabel: 'Data Type',
  analyzeFileLabel: 'Upload Data File',
  analyzeFileHint: 'Accepted: json, xml, toloformat',
  togglePredictionHide: 'Hide Prediction',
  togglePredictionShow: 'Show Prediction',
  toggleGtHide: 'Hide GT',
  toggleGtShow: 'Show GT',
};

const VIZ_CLASSNAMES = {
  section: 'visualization-section',
  controls: 'annotation-controls',
  viewer: 'viewer-panel',
  zoomContainer: 'zoom-container',
  content: 'gif-content',
};

const resolveGtVisualizationFileName = (selectedType) => {
  // Keep unified crop_dim option on crop parser path.
  if (selectedType === 'crop_dim') {
    return 'gt_crop.json';
  }
  return `${selectedType}.json`;
};

const VisualizationPanel = ({
  zipData,
  selectedFile,
  uploadedImage,
  loading,
  setLoading,
}) => {
  // Main visualization hook (zoom/pan/canvas draw state).
  const viz = useVisualization(uploadedImage);
  // User-selected GT data type (must match uploaded file semantics).
  const [selectedAnalyzeType, setSelectedAnalyzeType] = useState(MAP_ANALYZE_TYPES[0]);
  // Uploaded analyze file (json/xml/toloformat family).
  const [analyzeFile, setAnalyzeFile] = useState(null);
  // Analyze status text shown under upload input.
  const [analyzeStatus, setAnalyzeStatus] = useState('');

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
  }, [viz.showAnnotationText, viz.showKeyPoints, viz.hiddenDimensionIndices, viz.showPredictionLayer, viz.showGtLayer]);

  // Resize canvas when zoom or image size changes
  useEffect(() => {
    viz.updateView();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viz.zoom, viz.originalWidth, viz.originalHeight]);

  useEffect(() => {
    // Skip analyze processing when no file is selected yet.
    if (!analyzeFile) return;

    // Stop stale async updates after input changes.
    let cancelled = false;

    // Route analyze uploads into the same annotation renderer.
    const renderAnalyzeUpload = async () => {
      try {
        // Extract structured content with map_cal parser.
        const extracted = await extractMapDataFile(analyzeFile);
        if (cancelled) return;

        // Keep only payloads that match current visualization schema.
        const isRenderableObject =
          extracted &&
          typeof extracted === 'object' &&
          (Array.isArray(extracted.objects) || Array.isArray(extracted?.data?.objects));

        if (!isRenderableObject) {
          setAnalyzeStatus(`Loaded ${selectedAnalyzeType}, but this format is not render-ready yet.`);
          return;
        }

        // Use selected GT type mapping so dim/crop both follow crop visualization path.
        viz.visualizeGtJson(resolveGtVisualizationFileName(selectedAnalyzeType), extracted);

        // Let DOM settle once before canvas refresh.
        setTimeout(() => {
          if (!cancelled) viz.updateView();
        }, 100);

        // Show success feedback in analyze panel.
        setAnalyzeStatus(`Loaded ${selectedAnalyzeType}: ${analyzeFile.name}`);
      } catch (error) {
        // Keep upload errors scoped to analyze panel.
        if (!cancelled) setAnalyzeStatus(`Analyze upload failed: ${error.message}`);
      }
    };

    renderAnalyzeUpload();

    // Cleanup guard for rapid reselects/unmount.
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analyzeFile, selectedAnalyzeType]);

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
      // Main center content block (annotation controls + viewer + placeholder previews).
      <div id="vizContent" className={VIZ_CLASSNAMES.content}>
        {/* Primary visualization area (controls + large image/canvas viewer). */}
        <div className="viz-main">
          {!loading && renderClassControls()}

          {loading ? (
            // Loading state panel for visualization preparation.
            <div id="vizGif" className="gif-placeholder viz-loading-state">
              <GifPlaceholder gifSrc="/assets/Loader cat.gif" caption={VIZ_COPY.loadingCaption} />
            </div>
          ) : !uploadedImage ? (
            // Empty state when no base floorplan image is loaded.
            <div className="viz-empty-state">{VIZ_COPY.empty}</div>
          ) : (
            // Scrollable/drag-able viewer container for image + annotation canvas.
            <div id="viewer" ref={viz.viewerRef} className={VIZ_CLASSNAMES.viewer}>
              {/* Zoomed content wrapper that resizes with current zoom factor. */}
              <div id="zoomContainer" className={VIZ_CLASSNAMES.zoomContainer}>
                {/* Base floorplan raster image. */}
                <img
                  id="mainImage"
                  src={uploadedImage}
                  alt="Floorplan"
                  className="main-image"
                  onLoad={(e) => viz.handleImageLoad(e.currentTarget)}
                />
                {/* Overlay annotation canvas drawn from normalized objects. */}
                <canvas id="mainCanvas" ref={viz.canvasRef} className="main-canvas" />
              </div>
            </div>
          )}
        </div>

        {/* Reserved mini-preview grid area (currently static placeholders). */}
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

  const renderActionSidebar = () => {
    return (
      // Left column containing feature controls + analyze upload panel.
      <div className="viz-controls-column">
        {/* Feature controls panel (toggle text/keypoints + zoom actions). */}
        <section className="viz-side-block">
          <h4 className="viz-side-panel-title">{VIZ_COPY.featureTitle}</h4>
          <aside className="viz-actions-sidebar">
            <button
              onClick={() => viz.setShowAnnotationText(!viz.showAnnotationText)}
              className="btn viz-action-btn"
            >
              {viz.showAnnotationText ? VIZ_COPY.hideText : VIZ_COPY.showText}
            </button>
            <button
              onClick={() => viz.setShowKeyPoints(!viz.showKeyPoints)}
              className="btn viz-action-btn"
            >
              {viz.showKeyPoints ? VIZ_COPY.hidePoints : VIZ_COPY.showPoints}
            </button>
            <button onClick={viz.zoomIn} className="btn viz-action-btn">
              {VIZ_COPY.zoomIn}
            </button>
            <button onClick={viz.zoomOut} className="btn viz-action-btn">
              {VIZ_COPY.zoomOut}
            </button>
            <button onClick={viz.resetZoom} className="btn viz-action-btn">
              {VIZ_COPY.reset}
            </button>
            <span className="zoom-label">Zoom: {viz.getZoomPercentage()}%</span>
          </aside>
        </section>

        {/* Analyze results panel (type selector + file input + parser status). */}
        <section className="viz-side-block">
          <h4 className="viz-side-panel-title">{VIZ_COPY.analyzePanelTitle}</h4>
          <section className="viz-analyze-panel">
            <div className="viz-analyze-form">
              {/* Row 1: user must choose matching GT data type before upload. */}
              <div className="viz-analyze-row">
                <label htmlFor="analyzeTypeSelect">{VIZ_COPY.analyzeTypeLabel}</label>
                <select
                  id="analyzeTypeSelect"
                  value={selectedAnalyzeType}
                  onChange={(e) => setSelectedAnalyzeType(e.target.value)}
                >
                  {MAP_ANALYZE_TYPES.map((typeName) => (
                    <option key={typeName} value={typeName}>
                      {typeName}
                    </option>
                  ))}
                </select>
              </div>

              {/* Row 2: corresponding GT/prediction data file upload. */}
              <div className="viz-analyze-row">
                <label htmlFor="analyzeDataUpload">{VIZ_COPY.analyzeFileLabel}</label>
                <input
                  id="analyzeDataUpload"
                  type="file"
                  accept={MAP_UPLOAD_ACCEPT}
                  onChange={(e) => {
                    // Reset panel status each time a new file is chosen.
                    setAnalyzeStatus('');
                    setAnalyzeFile(e.target.files?.[0] || null);
                  }}
                />
                {analyzeFile && <div className="viz-analyze-file-meta">{analyzeFile.name}</div>}
                {analyzeStatus && <div className="viz-analyze-file-meta">{analyzeStatus}</div>}
                <div className="viz-analyze-file-hint">{VIZ_COPY.analyzeFileHint}</div>
              </div>

              {/* Row 3: layer visibility toggles for prediction and GT overlays. */}
              <div className="viz-analyze-row">
                <button
                  type="button"
                  className="btn viz-action-btn viz-analyze-action-btn"
                  onClick={() => viz.setShowPredictionLayer((prev) => !prev)}
                >
                  {viz.showPredictionLayer ? VIZ_COPY.togglePredictionHide : VIZ_COPY.togglePredictionShow}
                </button>
                <button
                  type="button"
                  className="btn viz-action-btn viz-analyze-action-btn"
                  onClick={() => viz.setShowGtLayer((prev) => !prev)}
                >
                  {viz.showGtLayer ? VIZ_COPY.toggleGtHide : VIZ_COPY.toggleGtShow}
                </button>
              </div>
            </div>
          </section>
        </section>
      </div>
    );
  };

  return (
    // Outer wrapper for image-mode visualization row left+center area.
    <div className="visualization-panel-wrap">
      <div className="viz-shell">
        {renderActionSidebar()}
        {/* Center visualization card with title and image/canvas rendering. */}
        <section className="viz-main-block">
          <h3 className="viz-section-title">{VIZ_COPY.title}</h3>
          <div className={VIZ_CLASSNAMES.section} id="visualizationSection">{renderContent()}</div>
        </section>
      </div>
    </div>
  );
};

export default VisualizationPanel;
