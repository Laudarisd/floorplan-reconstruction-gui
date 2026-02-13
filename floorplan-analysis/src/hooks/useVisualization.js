// Codex Note: hooks/useVisualization.js - Main logic for this module/task.
import { useState, useRef, useEffect, useCallback } from 'react';
import {
  createRoiTransform,
  normalizeObjectsForRender,
  randomColor,
  drawAnnotations,
} from '../services/visualizationService';

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
  const classMapRef = useRef({});
  const classColorsRef = useRef({});
  const [hiddenDimensionIndices, setHiddenDimensionIndices] = useState(new Set());

  const canvasRef = useRef(null);
  const viewerRef = useRef(null);
  const minZoomRef = useRef(1); // Store the fit-to-screen zoom level
  const zoomRef = useRef(1);
  const targetZoomRef = useRef(1);
  const wheelZoomRafRef = useRef(null);
  const wheelAnchorRef = useRef({ x: 0, y: 0 });
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0, scrollLeft: 0, scrollTop: 0 });

  // Initialize image dimensions on load
  // Compute image size + fit-to-view zoom
  const handleImageLoad = useCallback((img) => {
    if (!uploadedImage) return;
    
    const image = new Image();
    image.onload = () => {
      setOriginalWidth(image.naturalWidth);
      setOriginalHeight(image.naturalHeight);
      
      // Wait a tick to ensure viewer DOM is ready with proper dimensions
      setTimeout(() => {
        if (viewerRef.current && viewerRef.current.clientWidth > 0) {
          const minZoom = Math.min(
            viewerRef.current.clientWidth / image.naturalWidth,
            viewerRef.current.clientHeight / image.naturalHeight
          );
          minZoomRef.current = minZoom; // Store the fit-to-screen zoom
          zoomRef.current = minZoom;
          targetZoomRef.current = minZoom;
          setZoom(minZoom); // Always start at fit-to-screen zoom
        }
      }, 100); // Increased delay to ensure DOM is fully ready
    };
    image.src = uploadedImage;
  }, [uploadedImage]);

  // Visualize JSON data with annotations
  // Normalize JSON data into renderable objects
  const visualizeJson = useCallback((fileName, selectedJson) => {
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

    const normalized = result.objects;
    currentObjsRef.current = normalized;

    // Build class map with colors - REUSE existing colors if available
    const newClassMap = {};
    const newClassColors = { ...classColorsRef.current }; // Copy existing colors
    
    for (const obj of normalized) {
      const cls = obj._cls || 'Unknown';
      if (!newClassMap[cls]) {
        newClassMap[cls] = [];
        // Only generate new color if this class doesn't have one yet
        if (!newClassColors[cls]) {
          newClassColors[cls] = randomColor();
        }
      }
      obj._color = newClassColors[cls]; // Use the consistent color
      newClassMap[cls].push(obj);
    }

    classMapRef.current = newClassMap;
    classColorsRef.current = newClassColors;

    return newClassMap;
  }, []);

  // Redraw canvas with current state
  // Draw current objects on canvas
  const redrawAnnotations = useCallback(() => {
    if (!canvasRef.current) return;

    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    drawAnnotations(
      ctx,
      canvasRef.current,
      classMapRef.current,
      hiddenDimensionIndices,
      zoom,
      showAnnotationText,
      showKeyPoints
    );
  }, [zoom, showAnnotationText, showKeyPoints, hiddenDimensionIndices]);

  // Update view when dimensions or zoom changes
  // Update zoomed sizes + redraw canvas
  const updateView = useCallback(() => {
    if (!originalWidth || !originalHeight || !canvasRef.current) return;

    const z = zoom;
    const displayWidth = originalWidth * z;
    const displayHeight = originalHeight * z;

    // Update canvas size
    canvasRef.current.width = displayWidth;
    canvasRef.current.height = displayHeight;
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
  }, [originalWidth, originalHeight, zoom, redrawAnnotations]);

  const zoomIn = () => setZoom(prev => Math.min(prev * 1.1, 5));
  const zoomOut = () => setZoom(prev => Math.max(prev * 0.9, minZoomRef.current));
  const resetZoom = () => {
    const fitZoom = minZoomRef.current;
    zoomRef.current = fitZoom;
    targetZoomRef.current = fitZoom;
    setZoom(fitZoom);
  };

  const applyZoomAtPoint = useCallback((fromZoom, toZoom, clientX, clientY) => {
    const viewer = viewerRef.current;
    if (!viewer || !originalWidth || !originalHeight) return;

    const rect = viewer.getBoundingClientRect();
    const mouseX = clientX - rect.left;
    const mouseY = clientY - rect.top;
    const contentX = viewer.scrollLeft + mouseX;
    const contentY = viewer.scrollTop + mouseY;

    const oldScaledW = originalWidth * fromZoom || 1;
    const oldScaledH = originalHeight * fromZoom || 1;
    const fx = contentX / oldScaledW;
    const fy = contentY / oldScaledH;

    zoomRef.current = toZoom;
    setZoom(toZoom);

    requestAnimationFrame(() => {
      viewer.scrollLeft = fx * (originalWidth * toZoom) - mouseX;
      viewer.scrollTop = fy * (originalHeight * toZoom) - mouseY;
    });
  }, [originalWidth, originalHeight]);

  const zoomToPoint = useCallback((nextZoom, clientX, clientY) => {
    if (!originalWidth || !originalHeight) return;

    const clampedZoom = Math.max(minZoomRef.current, Math.min(nextZoom, 5));
    const fromZoom = zoomRef.current;
    if (Math.abs(clampedZoom - fromZoom) < 1e-6) return;

    targetZoomRef.current = clampedZoom;
    applyZoomAtPoint(fromZoom, clampedZoom, clientX, clientY);
  }, [applyZoomAtPoint, originalWidth, originalHeight]);
  
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

  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

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

      if (Math.abs(diff) < 0.0008) {
        if (Math.abs(target - current) > 1e-8) {
          applyZoomAtPoint(current, target, wheelAnchorRef.current.x, wheelAnchorRef.current.y);
        }
        wheelZoomRafRef.current = null;
        return;
      }

      const nextZoom = current + diff * 0.16;
      applyZoomAtPoint(current, nextZoom, wheelAnchorRef.current.x, wheelAnchorRef.current.y);
      wheelZoomRafRef.current = requestAnimationFrame(animateWheelZoom);
    };

    const handleWheel = (e) => {
      e.preventDefault();

      const normalizedDelta = clamp(normalizeWheelDelta(e), -60, 60);
      // Lower sensitivity + normalized input makes zoom smoother and less jumpy.
      const wheelFactor = Math.exp(-normalizedDelta * 0.0009);
      const baseZoom = targetZoomRef.current || zoomRef.current;
      const nextZoom = Math.max(minZoomRef.current, Math.min(baseZoom * wheelFactor, 5));

      targetZoomRef.current = nextZoom;
      wheelAnchorRef.current = { x: e.clientX, y: e.clientY };

      if (!wheelZoomRafRef.current) {
        wheelZoomRafRef.current = requestAnimationFrame(animateWheelZoom);
      }
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
      viewer.removeEventListener('wheel', handleWheel);
      viewer.removeEventListener('dblclick', handleDoubleClick);
      viewer.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', stopDragging);
      viewer.removeEventListener('mouseleave', stopDragging);
    };
  }, [applyZoomAtPoint, zoomToPoint]);

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
    updateView,
    redrawAnnotations,
    canvasRef,
    viewerRef,
    classMapRef,
    hiddenDimensionIndices,
    toggleDimensionIndex,
    handleImageLoad,
    currentObjsRef,
    dimensionAreasRef,
  };
};
