import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useVisualization } from '../../image_mode/hooks/useVisualization.jsx';
import GifPlaceholder from '../../image_mode/components/shared/GifPlaceholder';
import '../../image_mode/style/tasks/visualization.css';

const isImageFile = (name) => /\.(png|jpg|jpeg|bmp|gif|webp)$/i.test(name || '');
const normalizePath = (name) => (name || '').replace(/\\/g, '/').toLowerCase();

const VIZ_COPY = {
  loadingCaption: 'Preparing visualization...',
  empty: 'Upload a DWG ZIP to see visualization',
  showText: 'Show Text',
  hideText: 'Hide Text',
  showPoints: 'Show Key Points',
  hidePoints: 'Hide Key Points',
  zoomIn: 'Zoom In',
  zoomOut: 'Zoom Out',
  reset: 'Reset Zoom',
  dimensionLabel: 'Dimension Areas:',
};

const VIZ_CLASSNAMES = {
  controls: 'annotation-controls',
  viewer: 'viewer-panel',
  zoomContainer: 'zoom-container',
  content: 'gif-content',
};

const DwgVisualizationPanel = ({
  dwgUploadData,
  dwgZipData,
  dwgInputZipData,
  selectedFile,
  selectedLayer,
  loading,
  setLoading,
}) => {
  const [originalImageUrl, setOriginalImageUrl] = useState('');
  const [originalImageName, setOriginalImageName] = useState('');
  const [originalStatus, setOriginalStatus] = useState('Waiting for ZIP...');
  const viz = useVisualization(originalImageUrl);
  const [layerZoom, setLayerZoom] = useState(1);
  const layerViewerRef = useRef(null);
  const layerMinZoomRef = useRef(1);
  const layerZoomRef = useRef(1);
  const layerWheelAnchorRef = useRef(null);
  const layerWheelRafRef = useRef(null);
  const layerWheelEndTimerRef = useRef(null);
  const [debugInfo, setDebugInfo] = useState({
    totalFiles: 0,
    originalCandidates: [],
    layerCandidates: [],
    sampleFiles: [],
  });

  const zipFiles = useMemo(() => dwgInputZipData?.files || [], [dwgInputZipData]);

  // Extract the original image from ZIP contents.
  useEffect(() => {
    let revokeUrl = '';

    const loadOriginalImage = async () => {
      if (!dwgInputZipData?.zip || zipFiles.length === 0) {
        setOriginalImageUrl('');
        setOriginalImageName('');
        setOriginalStatus('No ZIP loaded.');
        setDebugInfo({
          totalFiles: 0,
          originalCandidates: [],
          layerCandidates: [],
          sampleFiles: [],
        });
        return;
      }

      const originalCandidates = zipFiles.filter((fileName) => {
        const lower = normalizePath(fileName);
        return /(^|\/)original_img\//i.test(lower) && isImageFile(lower);
      });

      const layerCandidates = zipFiles.filter((fileName) => {
        const lower = normalizePath(fileName);
        return /(^|\/)layer_img\//i.test(lower) && isImageFile(lower);
      });

      const fallbackCandidates = zipFiles.filter((fileName) => {
        const lower = normalizePath(fileName);
        return isImageFile(lower) && !/(^|\/)layer_img\//i.test(lower);
      });

      const originalFile = originalCandidates[0] || fallbackCandidates[0];

      setDebugInfo({
        totalFiles: zipFiles.length,
        originalCandidates,
        layerCandidates,
        sampleFiles: zipFiles.slice(0, 8),
      });

      if (!originalFile) {
        setOriginalImageUrl('');
        setOriginalImageName('');
        setOriginalStatus(
          `No original image found in ZIP. Found ${originalCandidates.length} in original_img.`
        );
        if (setLoading) {
          setLoading((prev) => ({ ...prev, visualization: false }));
        }
        return;
      }

      try {
        const entry = dwgInputZipData.zip.file(originalFile);
        if (!entry) {
          setOriginalImageUrl('');
          setOriginalImageName('');
          setOriginalStatus('Original image entry missing in ZIP.');
          if (setLoading) {
            setLoading((prev) => ({ ...prev, visualization: false }));
          }
          return;
        }

        const blob = await entry.async('blob');
        const url = URL.createObjectURL(blob);
        revokeUrl = url;
        setOriginalImageUrl(url);
        setOriginalImageName(originalFile);
        setOriginalStatus('');
      } catch (error) {
        console.error('Failed to read original image from ZIP:', error);
        setOriginalImageUrl('');
        setOriginalImageName('');
        setOriginalStatus('Failed to load original image.');
        if (setLoading) {
          setLoading((prev) => ({ ...prev, visualization: false }));
        }
      }
    };

    loadOriginalImage();

    return () => {
      if (revokeUrl) {
        URL.revokeObjectURL(revokeUrl);
      }
    };
  }, [dwgInputZipData, zipFiles]);

  useEffect(() => {
    if (originalImageUrl && setLoading) {
      setLoading((prev) => ({ ...prev, visualization: false }));
    }
  }, [originalImageUrl, setLoading]);

  useEffect(() => {
    const viewer = layerViewerRef.current;
    if (!viewer) return undefined;
    const clamp = (v, min, max) => Math.max(min, Math.min(v, max));

    const isDragging = { current: false };
    const dragStart = { x: 0, y: 0, scrollLeft: 0, scrollTop: 0 };

    const handleMouseDown = (e) => {
      if (e.button !== 0) return;
      isDragging.current = true;
      viewer.classList.add('is-dragging');
      dragStart.x = e.clientX;
      dragStart.y = e.clientY;
      dragStart.scrollLeft = viewer.scrollLeft;
      dragStart.scrollTop = viewer.scrollTop;
      e.preventDefault();
    };

    const handleMouseMove = (e) => {
      if (!isDragging.current) return;
      const dx = e.clientX - dragStart.x;
      const dy = e.clientY - dragStart.y;
      viewer.scrollLeft = dragStart.scrollLeft - dx;
      viewer.scrollTop = dragStart.scrollTop - dy;
    };

    const stopDragging = () => {
      isDragging.current = false;
      viewer.classList.remove('is-dragging');
    };

    viewer.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', stopDragging);
    viewer.addEventListener('mouseleave', stopDragging);

    const stopWheelAnimation = () => {
      if (layerWheelRafRef.current) {
        cancelAnimationFrame(layerWheelRafRef.current);
        layerWheelRafRef.current = null;
      }
    };

    const clearWheelEndTimer = () => {
      if (layerWheelEndTimerRef.current) {
        clearTimeout(layerWheelEndTimerRef.current);
        layerWheelEndTimerRef.current = null;
      }
    };

    const normalizeWheelDelta = (e) => {
      const LINE_HEIGHT_PX = 16;
      const PAGE_HEIGHT_PX = viewer.clientHeight || 800;
      if (e.deltaMode === 1) return e.deltaY * LINE_HEIGHT_PX;
      if (e.deltaMode === 2) return e.deltaY * PAGE_HEIGHT_PX;
      return e.deltaY;
    };

    const createLayerAnchor = (clientX, clientY, fromZoom) => {
      const rect = viewer.getBoundingClientRect();
      const mouseX = clientX - rect.left;
      const mouseY = clientY - rect.top;
      const contentX = viewer.scrollLeft + mouseX;
      const contentY = viewer.scrollTop + mouseY;

      const oldScaledW = viewer.scrollWidth || 1;
      const oldScaledH = viewer.scrollHeight || 1;
      const fx = contentX / oldScaledW;
      const fy = contentY / oldScaledH;

      return { mouseX, mouseY, fx, fy, fromZoom };
    };

    const applyLayerZoomWithAnchor = (toZoom, anchor) => {
      layerZoomRef.current = toZoom;
      setLayerZoom(toZoom);

      requestAnimationFrame(() => {
        const scaledW = viewer.scrollWidth || 1;
        const scaledH = viewer.scrollHeight || 1;
        viewer.scrollLeft = anchor.fx * scaledW - anchor.mouseX;
        viewer.scrollTop = anchor.fy * scaledH - anchor.mouseY;
      });
    };

    const animateWheelZoom = () => {
      const current = layerZoomRef.current;
      const target = layerWheelAnchorRef.current?.targetZoom ?? current;
      const diff = target - current;
      const anchor = layerWheelAnchorRef.current;
      if (!anchor) {
        layerWheelRafRef.current = null;
        return;
      }

      if (Math.abs(diff) < 0.0008) {
        if (Math.abs(target - current) > 1e-8) {
          applyLayerZoomWithAnchor(target, anchor);
        }
        layerWheelRafRef.current = null;
        return;
      }

      const nextZoom = current + diff * 0.1;
      applyLayerZoomWithAnchor(nextZoom, anchor);
      layerWheelRafRef.current = requestAnimationFrame(animateWheelZoom);
    };

    const handleWheel = (e) => {
      e.preventDefault();
      const normalizedDelta = clamp(normalizeWheelDelta(e), -50, 50);
      const wheelFactor = Math.exp(-normalizedDelta * 0.00075);
      const baseZoom = layerZoomRef.current || layerMinZoomRef.current || 1;
      const nextZoom = clamp(baseZoom * wheelFactor, layerMinZoomRef.current || 0.3, 5);

      if (!layerWheelAnchorRef.current) {
        layerWheelAnchorRef.current = createLayerAnchor(e.clientX, e.clientY, layerZoomRef.current);
      }
      layerWheelAnchorRef.current.targetZoom = nextZoom;

      if (!layerWheelRafRef.current) {
        layerWheelRafRef.current = requestAnimationFrame(animateWheelZoom);
      }

      clearWheelEndTimer();
      layerWheelEndTimerRef.current = setTimeout(() => {
        layerWheelAnchorRef.current = null;
        layerWheelEndTimerRef.current = null;
      }, 120);
    };

    viewer.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      stopWheelAnimation();
      clearWheelEndTimer();
      viewer.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', stopDragging);
      viewer.removeEventListener('mouseleave', stopDragging);
      viewer.removeEventListener('wheel', handleWheel);
    };
  }, [selectedLayer]);

  // Track basic DWG folder metadata.
  const layerCount = dwgUploadData?.layers?.length || 0;

  // Visualize selected JSON on top of the original image.
  useEffect(() => {
    if (!selectedFile || selectedFile.type !== 'json' || !originalImageUrl) return;

    try {
      let jsonData;
      if (typeof selectedFile.content === 'string') {
        jsonData = JSON.parse(selectedFile.content);
      } else {
        jsonData = selectedFile.content;
      }

      viz.visualizeJson(selectedFile.fileName, jsonData);

      setTimeout(() => {
        viz.updateView();
      }, 100);
    } catch (error) {
      console.error('Error visualizing DWG JSON:', error);
      if (setLoading) {
        setLoading((prev) => ({ ...prev, visualization: false }));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFile, originalImageUrl]);

  // Redraw canvas when toggles change.
  useEffect(() => {
    viz.redrawAnnotations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viz.showAnnotationText, viz.showKeyPoints, viz.hiddenDimensionIndices]);

  // Resize canvas when zoom or image size changes.
  useEffect(() => {
    viz.updateView();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viz.zoom, viz.originalWidth, viz.originalHeight]);

  const handleClassToggle = () => {
    viz.redrawAnnotations();
  };

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
            <label key={`dwg-class-${cls}`}>
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
                <label key={`dwg-dimension-${idx}`}>
                  <input
                    type="checkbox"
                    defaultChecked
                    id={`dimension-toggle-${idx}`}
                    onChange={() => viz.toggleDimensionIndex(idx)}
                  />
                  {` Dimension [${idx}]`}
                </label>
              ))}
          </div>
        )}
      </div>
    );
  };

  const renderOriginalPane = () => {
    return (
      <div id="dwgVizContent" className={`${VIZ_CLASSNAMES.content} dwg-pane-content`}>
        <div className="viz-main dwg-viz-main">
          {!loading && renderClassControls()}

              {loading ? (
                <div id="dwgVizGif" className="gif-placeholder viz-loading-state">
                  <GifPlaceholder gifSrc="/assets/Loader cat.gif" caption={VIZ_COPY.loadingCaption} />
                </div>
          ) : !originalImageUrl ? (
            <div className="viz-empty-state">
              <div>{originalStatus}</div>
              <div className="dwg-debug">
                <div>ZIP files: {debugInfo.totalFiles}</div>
                <div>original_img images: {debugInfo.originalCandidates.length}</div>
                <div>layer_img images: {debugInfo.layerCandidates.length}</div>
                {debugInfo.sampleFiles.length > 0 && (
                  <div className="dwg-debug-list">
                    {debugInfo.sampleFiles.map((name) => (
                      <div key={name}>{name}</div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div id="viewer" ref={viz.viewerRef} className={`${VIZ_CLASSNAMES.viewer} dwg-viewer-panel`}>
              <div id="zoomContainer" className={VIZ_CLASSNAMES.zoomContainer}>
                <img
                  id="mainImage"
                  src={originalImageUrl}
                  alt="DWG Original"
                  className="main-image"
                  onLoad={() => viz.handleImageLoad()}
                />
                <canvas id="mainCanvas" ref={viz.canvasRef} className="main-canvas" />
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="visualization-panel-wrap dwg-visualization-panel">
      <h3 className="viz-section-title">DWG Visualization Panel</h3>
      <div className="viz-shell dwg-viz-shell">
        <div className="visualization-section dwg-viz-section" id="dwgVisualizationSection">
          <div className="dwg-viz-grid">
            <div className="dwg-viz-pane">
              <div className="dwg-viz-title">Original Viz</div>
              <div className="dwg-viz-body">
                {renderOriginalPane()}
              </div>
              <div className="dwg-viz-controls dwg-viz-controls-bottom">
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
              </div>
            </div>
            <div className="dwg-viz-pane">
              <div className="dwg-viz-title">Layers Viz</div>
              <div className="dwg-viz-body">
                {loading ? (
                  <div className="gif-placeholder viz-loading-state">
                    <GifPlaceholder gifSrc="/assets/Loader cat.gif" caption={VIZ_COPY.loadingCaption} />
                  </div>
                ) : selectedLayer ? (
                  <div className="dwg-layer-viewer">
                    <div className="dwg-layer-zoom" ref={layerViewerRef}>
                      <img
                        className="dwg-original-image dwg-layer-image"
                        src={selectedLayer.url}
                        alt={selectedLayer.name}
                        style={{ transform: `scale(${layerZoom})` }}
                        onLoad={(e) => {
                          const viewer = layerViewerRef.current;
                          if (!viewer) return;
                          const img = e.currentTarget;
                          const fitZoom = Math.min(
                            viewer.clientWidth / img.naturalWidth,
                            viewer.clientHeight / img.naturalHeight
                          );
                          const baseZoom = fitZoom * 6;
                          layerMinZoomRef.current = baseZoom;
                          layerZoomRef.current = baseZoom;
                          setLayerZoom(baseZoom);
                        }}
                      />
                    </div>
                    <div className="dwg-image-label">{selectedLayer.name}</div>
                  </div>
                ) : (
                  <div className="viz-empty-state">
                    Layer preview coming next. Layers loaded: {layerCount}
                  </div>
                )}
              </div>
              <div className="dwg-viz-controls dwg-viz-controls-bottom">
                <button onClick={() => setLayerZoom((z) => Math.min(z * 1.1, 5))} className="btn viz-action-btn">
                  {VIZ_COPY.zoomIn}
                </button>
                <button onClick={() => setLayerZoom((z) => Math.max(z * 0.9, layerMinZoomRef.current || z))} className="btn viz-action-btn">
                  {VIZ_COPY.zoomOut}
                </button>
                <button onClick={() => setLayerZoom(layerMinZoomRef.current || 1)} className="btn viz-action-btn">
                  {VIZ_COPY.reset}
                </button>
                <span className="zoom-label">
                  Zoom: {Math.round((layerZoom / (layerMinZoomRef.current || 1)) * 100)}%
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DwgVisualizationPanel;
