// Codex Note: hooks/useVisualization.js - Main logic for this module/task.
import { useState, useRef, useEffect, useCallback } from 'react';
import {
  createRoiTransform,
  normalizeObjectsForRender,
  randomColor,
  drawAnnotations,
  bboxFromPoints,
} from '../services/visualizationService.jsx';

const MAX_RENDER_PIXELS = 3_000_000;
const MAX_RENDER_SIDE = 4096;
const MIN_ANNOTATION_RENDER_SCALE = 0.7;
const GT_FIXED_PALETTE = [
  'hsl(135,70%,42%)',
  'hsl(155,70%,40%)',
  'hsl(175,70%,40%)',
  'hsl(95,70%,42%)',
  'hsl(120,65%,45%)',
  'hsl(145,65%,44%)',
  'hsl(165,65%,42%)',
  'hsl(185,65%,42%)',
];

export const useVisualization = (uploadedImage) => {
  // Canvas visualization state + helpers
  const [zoom, setZoom] = useState(1);
  const [showAnnotationText, setShowAnnotationText] = useState(true);
  const [showKeyPoints, setShowKeyPoints] = useState(true);
  const [originalWidth, setOriginalWidth] = useState(0);
  const [originalHeight, setOriginalHeight] = useState(0);

  // State for visualization data
  const roiTransformRef = useRef(createRoiTransform());
  const dimensionAreasRef = useRef({});
  const currentObjsRef = useRef([]);
  const predictionObjsRef = useRef([]);
  const gtObjsRef = useRef([]);
  const classMapRef = useRef({});
  const predictionClassMapRef = useRef({});
  const gtClassMapRef = useRef({});
  const classColorsRef = useRef({});
  const aiDetectionsRef = useRef([]);
  const [hiddenDimensionIndices, setHiddenDimensionIndices] = useState(new Set());
  const [showPredictionLayer, setShowPredictionLayer] = useState(true);
  const [showGtLayer, setShowGtLayer] = useState(true);

  const canvasRef = useRef(null);
  const viewerRef = useRef(null);
  const minZoomRef = useRef(1); // Store the fit-to-screen zoom level
  const zoomRef = useRef(1);
  const targetZoomRef = useRef(1);
  const wheelZoomRafRef = useRef(null);
  const wheelAnchorRef = useRef(null);
  const wheelEndTimerRef = useRef(null);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0, scrollLeft: 0, scrollTop: 0 });

  // Dynamic quality scaler to keep heavy-image redraw cost bounded.
  const getRenderScaleForZoom = useCallback((zoomLevel) => {
    if (!originalWidth || !originalHeight || !zoomLevel) return 1;
    const scaledWidth = originalWidth * zoomLevel;
    const scaledHeight = originalHeight * zoomLevel;

    const pixelScale = Math.sqrt(MAX_RENDER_PIXELS / (scaledWidth * scaledHeight));
    const sideScale = Math.min(MAX_RENDER_SIDE / scaledWidth, MAX_RENDER_SIDE / scaledHeight);

    return Math.min(1, pixelScale, sideScale);
  }, [originalWidth, originalHeight]);

  // Keep annotation overlay readable by clamping to a minimum render scale.
  const getAnnotationRenderScaleForZoom = useCallback((zoomLevel) => {
    return Math.max(MIN_ANNOTATION_RENDER_SCALE, getRenderScaleForZoom(zoomLevel));
  }, [getRenderScaleForZoom]);

  // Initialize image dimensions on load
  // Compute image size + fit-to-view zoom
  // Base image load handler for natural size + fit-to-view initialization.
  const handleImageLoad = useCallback((imgEl) => {
    if (!uploadedImage) return;

    const finalizeImageLoad = (naturalWidth, naturalHeight) => {
      setOriginalWidth(naturalWidth);
      setOriginalHeight(naturalHeight);

      // Wait a tick to ensure viewer DOM is ready with proper dimensions
      setTimeout(() => {
        if (viewerRef.current && viewerRef.current.clientWidth > 0) {
          const minZoom = Math.min(
            viewerRef.current.clientWidth / naturalWidth,
            viewerRef.current.clientHeight / naturalHeight
          );
          minZoomRef.current = minZoom; // Store the fit-to-screen zoom
          zoomRef.current = minZoom;
          targetZoomRef.current = minZoom;
          setZoom(minZoom); // Always start at fit-to-screen zoom
        }
      }, 100); // Increased delay to ensure DOM is fully ready
    };

    if (imgEl?.naturalWidth && imgEl?.naturalHeight) {
      finalizeImageLoad(imgEl.naturalWidth, imgEl.naturalHeight);
      return;
    }

    const image = new Image();
    image.onload = () => {
      finalizeImageLoad(image.naturalWidth, image.naturalHeight);
    };
    image.src = uploadedImage;
  }, [uploadedImage]);

  // Visualize JSON data with annotations
  // Normalize JSON data into renderable objects
  // Build class-to-objects map and keep color assignments stable.
  const buildClassMap = useCallback((normalized, options = {}) => {
    const { fixedLayerColors = null } = options;
    const newClassMap = {};
    const newClassColors = { ...classColorsRef.current };

    for (const obj of normalized) {
      const cls = obj._cls || 'Unknown';
      if (!newClassMap[cls]) {
        newClassMap[cls] = [];
        if (fixedLayerColors && fixedLayerColors[cls]) {
          newClassColors[cls] = fixedLayerColors[cls];
        } else if (!newClassColors[cls]) {
          newClassColors[cls] = randomColor();
        }
      }
      obj._color = newClassColors[cls];
      newClassMap[cls].push(obj);
    }

    classColorsRef.current = newClassColors;
    return newClassMap;
  }, []);

  // Shared normalizer used by both prediction and GT layers.
  const normalizeToLayerObjects = useCallback((fileName, selectedJson) => {
    if (!selectedJson) return;

    const result = normalizeObjectsForRender(
      fileName,
      selectedJson,
      roiTransformRef.current,
      dimensionAreasRef.current
    );

    // Update ROI transform if returned
    if (result.newRoiTransform) {
      roiTransformRef.current = result.newRoiTransform;
      setOriginalWidth(result.newRoiTransform.origW);
      setOriginalHeight(result.newRoiTransform.origH);
    }

    // Update dimension areas if returned
    if (result.newDimensionAreas) {
      dimensionAreasRef.current = result.newDimensionAreas;
    }

    return result.objects;
  }, []);

  // Convert prediction JSON payload into renderer-friendly object map.
  const visualizeJson = useCallback((fileName, selectedJson) => {
    const normalized = normalizeToLayerObjects(fileName, selectedJson);
    if (!normalized) return;

    predictionObjsRef.current = normalized;
    currentObjsRef.current = normalized;

    const newClassMap = buildClassMap(normalized);
    predictionClassMapRef.current = newClassMap;
    classMapRef.current = newClassMap;

    return newClassMap;
  }, [buildClassMap, normalizeToLayerObjects]);

  // Convert GT JSON payload into renderer-friendly object map.
  const visualizeGtJson = useCallback((fileName, selectedJson) => {
    const normalized = normalizeToLayerObjects(fileName, selectedJson);
    if (!normalized) return;

    // Deterministic GT palette keeps GT layer visually separate from prediction layer.
    const gtClasses = Array.from(new Set(normalized.map((obj) => obj._cls || 'Unknown'))).sort();
    const gtClassColors = {};
    gtClasses.forEach((cls, idx) => {
      gtClassColors[cls] = GT_FIXED_PALETTE[idx % GT_FIXED_PALETTE.length];
    });

    gtObjsRef.current = normalized;
    const newClassMap = buildClassMap(normalized, { fixedLayerColors: gtClassColors });
    gtClassMapRef.current = newClassMap;
    return newClassMap;
  }, [buildClassMap, normalizeToLayerObjects]);

  // Redraw canvas with current state
  // Draw current objects on canvas
  // Draw annotation layer onto canvas with current toggles and zoom.
  const redrawAnnotations = useCallback(() => {
    if (!canvasRef.current) return;

    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    const renderScale = getAnnotationRenderScaleForZoom(zoom);
    let shouldClear = true;

    if (showPredictionLayer) {
      drawAnnotations(
        ctx,
        canvasRef.current,
        predictionClassMapRef.current,
        hiddenDimensionIndices,
        zoom * renderScale,
        showAnnotationText,
        showKeyPoints,
        true,
        shouldClear
      );
      shouldClear = false;
    }

    if (showGtLayer) {
      drawAnnotations(
        ctx,
        canvasRef.current,
        gtClassMapRef.current,
        hiddenDimensionIndices,
        zoom * renderScale,
        showAnnotationText,
        showKeyPoints,
        false,
        shouldClear
      );
      shouldClear = false;
    }

    if (shouldClear) {
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }

    // Draw chatbot-driven detections after prediction/GT layers.
    const detections = aiDetectionsRef.current;
    if (detections.length > 0) {
      const canvasWidth = canvasRef.current.width;
      const canvasHeight = canvasRef.current.height;

      detections.forEach((item) => {
        const box = item?.box;
        if (!Array.isArray(box) || box.length !== 4) return;

        const [yMin, xMin, yMax, xMax] = box.map((value) => Number(value));
        if (![yMin, xMin, yMax, xMax].every(Number.isFinite)) return;

        const left = (xMin / 1000) * canvasWidth;
        const top = (yMin / 1000) * canvasHeight;
        const width = ((xMax - xMin) / 1000) * canvasWidth;
        const height = ((yMax - yMin) / 1000) * canvasHeight;

        // Keep AI detections visually distinct with a stronger blue stroke.
        ctx.strokeStyle = item.color || '#2B07E3';
        ctx.lineWidth = 3;
        ctx.setLineDash([]);
        ctx.strokeRect(left, top, width, height);

        const label = (item.label || '').trim();
        if (showAnnotationText && label) {
          ctx.fillStyle = 'rgba(43, 7, 227, 0.9)';
          const fontSize = Math.max(11, Math.min(15, Math.round(12 * zoom)));
          ctx.font = `600 ${fontSize}px sans-serif`;
          ctx.fillText(label, left + 4, Math.max(14, top - 6));
        }
      });
    }
  }, [
    zoom,
    showAnnotationText,
    showKeyPoints,
    hiddenDimensionIndices,
    showPredictionLayer,
    showGtLayer,
    getAnnotationRenderScaleForZoom,
  ]);

  // Update view when dimensions or zoom changes
  // Update zoomed sizes + redraw canvas
  // Sync image/canvas dimensions with current zoom then redraw.
  const updateView = useCallback(() => {
    if (!originalWidth || !originalHeight || !canvasRef.current) return;

    const z = zoom;
    const renderScale = getAnnotationRenderScaleForZoom(z);
    const displayWidth = originalWidth * z;
    const displayHeight = originalHeight * z;
    const renderWidth = displayWidth * renderScale;
    const renderHeight = displayHeight * renderScale;

    // Update canvas size
    canvasRef.current.width = renderWidth;
    canvasRef.current.height = renderHeight;
    canvasRef.current.style.width = `${displayWidth}px`;
    canvasRef.current.style.height = `${displayHeight}px`;

    // Update zoom container
    const zoomContainer = document.getElementById('zoomContainer');
    if (zoomContainer) {
      zoomContainer.style.width = `${displayWidth}px`;
      zoomContainer.style.height = `${displayHeight}px`;
    }

    // Update image size
    const img = document.getElementById('mainImage');
    if (img) {
      img.style.width = `${displayWidth}px`;
      img.style.height = `${displayHeight}px`;
    }

    redrawAnnotations();
  }, [originalWidth, originalHeight, zoom, redrawAnnotations, getAnnotationRenderScaleForZoom]);

  const zoomIn = () => setZoom(prev => Math.min(prev * 1.1, 5));
  const zoomOut = () => setZoom(prev => Math.max(prev * 0.9, minZoomRef.current));
  const resetZoom = () => {
    const fitZoom = minZoomRef.current;
    zoomRef.current = fitZoom;
    targetZoomRef.current = fitZoom;
    setZoom(fitZoom);
  };

  // Build zoom anchor so pointer stays on same content spot while zooming.
  const createZoomAnchor = useCallback((clientX, clientY, fromZoom) => {
    const viewer = viewerRef.current;
    if (!viewer || !originalWidth || !originalHeight) return null;

    const rect = viewer.getBoundingClientRect();
    const mouseX = clientX - rect.left;
    const mouseY = clientY - rect.top;
    const contentX = viewer.scrollLeft + mouseX;
    const contentY = viewer.scrollTop + mouseY;

    const oldScaledW = originalWidth * fromZoom || 1;
    const oldScaledH = originalHeight * fromZoom || 1;
    const fx = contentX / oldScaledW;
    const fy = contentY / oldScaledH;

    return { mouseX, mouseY, fx, fy };
  }, [originalWidth, originalHeight, getRenderScaleForZoom]);

  // Apply zoom and scroll offsets using anchor lock.
  const applyZoomWithAnchor = useCallback((toZoom, anchor) => {
    const viewer = viewerRef.current;
    if (!viewer || !originalWidth || !originalHeight || !anchor) return;

    zoomRef.current = toZoom;
    setZoom(toZoom);

    requestAnimationFrame(() => {
      viewer.scrollLeft = anchor.fx * (originalWidth * toZoom) - anchor.mouseX;
      viewer.scrollTop = anchor.fy * (originalHeight * toZoom) - anchor.mouseY;
    });
  }, [originalWidth, originalHeight]);

  // Public zoom helper for mouse wheel/double-click zoom-to-cursor.
  const zoomToPoint = useCallback((nextZoom, clientX, clientY) => {
    if (!originalWidth || !originalHeight) return;

    const clampedZoom = Math.max(minZoomRef.current, Math.min(nextZoom, 5));
    const fromZoom = zoomRef.current;
    if (Math.abs(clampedZoom - fromZoom) < 1e-6) return;
    const anchor = createZoomAnchor(clientX, clientY, fromZoom);
    if (!anchor) return;

    targetZoomRef.current = clampedZoom;
    applyZoomWithAnchor(clampedZoom, anchor);
  }, [applyZoomWithAnchor, createZoomAnchor, originalWidth, originalHeight]);
  
  const getZoomPercentage = () => {
    if (minZoomRef.current === 0) return 100;
    return Math.round((zoom / minZoomRef.current) * 100);
  };

  const toggleDimensionIndex = (idx) => {
    setHiddenDimensionIndices(prev => {
      const newSet = new Set(prev);
      if (newSet.has(idx)) {
        newSet.delete(idx);
      } else {
        newSet.add(idx);
      }
      return newSet;
    });
  };

  // Replace AI detection overlays using normalized [ymin,xmin,ymax,xmax] boxes.
  const setAiDetections = useCallback((detections = []) => {
    aiDetectionsRef.current = Array.isArray(detections) ? detections : [];
    redrawAnnotations();
  }, [redrawAnnotations]);

  // Remove all AI overlays from canvas.
  const clearAiDetections = useCallback(() => {
    aiDetectionsRef.current = [];
    redrawAnnotations();
  }, [redrawAnnotations]);

  // Collect OCR boxes from loaded result objects and show them as AI overlays.
  const showOcrDetections = useCallback((query = '') => {
    const searchTerm = String(query || '').toLowerCase().trim();
    const allObjs = [
      ...(predictionObjsRef.current || []),
      ...(gtObjsRef.current || []),
    ];

    const ocrObjs = allObjs.filter((obj) => {
      if (obj?.kind !== 'ocr_text') return false;
      if (!searchTerm) return true;
      return String(obj?.label || '').toLowerCase().includes(searchTerm);
    });

    if (!originalWidth || !originalHeight) {
      return { count: 0, applied: false };
    }

    const overlays = ocrObjs
      .map((obj) => {
        const bbox = bboxFromPoints(obj?.polygonPts || []);
        if (!bbox) return null;
        const yMin = (bbox.ymin / originalHeight) * 1000;
        const xMin = (bbox.xmin / originalWidth) * 1000;
        const yMax = (bbox.ymax / originalHeight) * 1000;
        const xMax = (bbox.xmax / originalWidth) * 1000;
        return {
          label: obj?.label || obj?._cls || 'ocr',
          box: [yMin, xMin, yMax, xMax],
          color: '#2B07E3',
        };
      })
      .filter(Boolean);

    aiDetectionsRef.current = overlays;
    redrawAnnotations();

    return { count: overlays.length, applied: true };
  }, [originalWidth, originalHeight, redrawAnnotations]);

  // Keep mutable zoom ref aligned with React state.
  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  // Register pointer/wheel listeners for pan and smooth wheel zoom.
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return undefined;
    const clamp = (v, min, max) => Math.max(min, Math.min(v, max));

    const stopWheelAnimation = () => {
      if (wheelZoomRafRef.current) {
        cancelAnimationFrame(wheelZoomRafRef.current);
        wheelZoomRafRef.current = null;
      }
    };

    const clearWheelEndTimer = () => {
      if (wheelEndTimerRef.current) {
        clearTimeout(wheelEndTimerRef.current);
        wheelEndTimerRef.current = null;
      }
    };

    const normalizeWheelDelta = (e) => {
      // Normalize mouse-wheel/trackpad values across devices and browsers.
      const LINE_HEIGHT_PX = 16;
      const PAGE_HEIGHT_PX = viewer.clientHeight || 800;
      if (e.deltaMode === 1) return e.deltaY * LINE_HEIGHT_PX;
      if (e.deltaMode === 2) return e.deltaY * PAGE_HEIGHT_PX;
      return e.deltaY;
    };

    const animateWheelZoom = () => {
      const current = zoomRef.current;
      const target = targetZoomRef.current;
      const diff = target - current;
      const anchor = wheelAnchorRef.current;
      if (!anchor) {
        wheelZoomRafRef.current = null;
        return;
      }

      if (Math.abs(diff) < 0.0008) {
        if (Math.abs(target - current) > 1e-8) {
          applyZoomWithAnchor(target, anchor);
        }
        wheelZoomRafRef.current = null;
        return;
      }

      const nextZoom = current + diff * 0.1;
      applyZoomWithAnchor(nextZoom, anchor);
      wheelZoomRafRef.current = requestAnimationFrame(animateWheelZoom);
    };

    const handleWheel = (e) => {
      e.preventDefault();

      const normalizedDelta = clamp(normalizeWheelDelta(e), -50, 50);
      // Lower sensitivity + normalized input makes zoom smoother and less jumpy.
      const wheelFactor = Math.exp(-normalizedDelta * 0.00075);
      const baseZoom = targetZoomRef.current || zoomRef.current;
      const nextZoom = Math.max(minZoomRef.current, Math.min(baseZoom * wheelFactor, 5));
      const isAnimating = !!wheelZoomRafRef.current;

      targetZoomRef.current = nextZoom;
      // Keep one fixed anchor during a wheel gesture to prevent shaking.
      if (!isAnimating || !wheelAnchorRef.current) {
        const anchor = createZoomAnchor(e.clientX, e.clientY, zoomRef.current);
        if (!anchor) return;
        wheelAnchorRef.current = anchor;
      }

      if (!wheelZoomRafRef.current) {
        wheelZoomRafRef.current = requestAnimationFrame(animateWheelZoom);
      }

      clearWheelEndTimer();
      wheelEndTimerRef.current = setTimeout(() => {
        wheelAnchorRef.current = null;
        wheelEndTimerRef.current = null;
      }, 120);
    };

    const handleDoubleClick = (e) => {
      e.preventDefault();
      zoomToPoint(zoom * 1.35, e.clientX, e.clientY);
    };

    const handleMouseDown = (e) => {
      if (e.button !== 0) return;
      isDraggingRef.current = true;
      viewer.classList.add('is-dragging');
      dragStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        scrollLeft: viewer.scrollLeft,
        scrollTop: viewer.scrollTop,
      };
      e.preventDefault();
    };

    const handleMouseMove = (e) => {
      if (!isDraggingRef.current) return;
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;
      viewer.scrollLeft = dragStartRef.current.scrollLeft - dx;
      viewer.scrollTop = dragStartRef.current.scrollTop - dy;
    };

    const stopDragging = () => {
      isDraggingRef.current = false;
      viewer.classList.remove('is-dragging');
    };

    viewer.addEventListener('wheel', handleWheel, { passive: false });
    viewer.addEventListener('dblclick', handleDoubleClick);
    viewer.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', stopDragging);
    viewer.addEventListener('mouseleave', stopDragging);

    return () => {
      stopWheelAnimation();
      clearWheelEndTimer();
      viewer.removeEventListener('wheel', handleWheel);
      viewer.removeEventListener('dblclick', handleDoubleClick);
      viewer.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', stopDragging);
      viewer.removeEventListener('mouseleave', stopDragging);
    };
  }, [applyZoomWithAnchor, createZoomAnchor, zoomToPoint]);

  return {
    zoom,
    showAnnotationText,
    showKeyPoints,
    originalWidth,
    originalHeight,
    setZoom,
    setShowAnnotationText,
    setShowKeyPoints,
    zoomIn,
    zoomOut,
    resetZoom,
    zoomToPoint,
    getZoomPercentage,
    visualizeJson,
    visualizeGtJson,
    updateView,
    redrawAnnotations,
    canvasRef,
    viewerRef,
    classMapRef,
    hiddenDimensionIndices,
    toggleDimensionIndex,
    showPredictionLayer,
    setShowPredictionLayer,
    showGtLayer,
    setShowGtLayer,
    handleImageLoad,
    currentObjsRef,
    dimensionAreasRef,
    setAiDetections,
    clearAiDetections,
    showOcrDetections,
  };
};
