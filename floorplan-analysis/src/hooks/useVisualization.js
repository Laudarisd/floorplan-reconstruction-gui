import { useState, useRef, useCallback } from 'react';
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
  const resetZoom = () => setZoom(minZoomRef.current);
  
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
