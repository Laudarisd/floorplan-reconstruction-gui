// ============================================================================
// viz_ui.js  (FIXED - SCROLLBARS & FULL DRAG)
// ----------------------------------------------------------------------------
// UI interaction module for viewer (zoom + drag) and UI toggles.
// Fixes:
//  1) Wheel zoom zooms TO MOUSE POSITION (dynamic)
//  2) Scrollbars are ALWAYS VISIBLE when content overflows
//  3) Full image drag support in zoom mode (no clipping)
//  4) Left-side zoom controls: Zoom In (+), Zoom Out (-), Fit to Screen
// ----------------------------------------------------------------------------

(() => {
  "use strict";

  // -----------------------------
  // DOM elements (same IDs)
  // -----------------------------
  const viewer = document.getElementById("viewer");
  const zoomContainer = document.getElementById("zoomContainer");
  const img = document.getElementById("mainImage");
  const canvas = document.getElementById("mainCanvas");

  if (!viewer) console.warn("⚠️ viz_ui.js: #viewer not found");
  if (!zoomContainer) console.warn("⚠️ viz_ui.js: #zoomContainer not found");

  // -----------------------------
  // CRITICAL: Ensure viewer has fixed dimensions and scrollbars
  // -----------------------------
  if (viewer) {
    // Force scrollbars to show when content overflows
    viewer.style.overflow = "scroll"; // Changed from "auto" to "scroll"
    viewer.style.overflowX = "scroll";
    viewer.style.overflowY = "scroll";
    
    // Don't override CSS dimensions - let CSS control the fixed size
    // viewer.style.width = "100%";  // REMOVED - conflicts with CSS fixed width
    // viewer.style.height = "100%"; // REMOVED - conflicts with CSS fixed height
    viewer.style.position = "relative";
    viewer.style.cursor = "grab";
    viewer.style.userSelect = "none";
    viewer.style.webkitUserSelect = "none";
    viewer.style.touchAction = "none";
    
    // Make scrollbars always visible (not just on hover)
    viewer.style.scrollbarColor = "#888 #f1f1f1"; // thumb track
    viewer.style.scrollbarWidth = "auto"; // Firefox
  }

  if (zoomContainer) {
    zoomContainer.style.position = "relative";
    zoomContainer.style.display = "inline-block";
    zoomContainer.style.transformOrigin = "top left";
    // Remove any transforms that might interfere
    zoomContainer.style.transform = "none";
  }

  // Ensure canvas overlays the image but doesn't block mouse events
  if (canvas && zoomContainer) {
    canvas.style.position = "absolute";
    canvas.style.left = "0";
    canvas.style.top = "0";
    canvas.style.pointerEvents = "none";
  }

  if (img) {
    img.style.display = "block";
    img.style.position = "relative";
  }

  // -----------------------------
  // Script-order safe global accessors
  // -----------------------------
  function getZoom() {
    return typeof window.zoom === "number" ? window.zoom : 1;
  }
  function setZoom(z) {
    window.zoom = z;
  }
  function getOriginalWidth() {
    return typeof window.originalWidth === "number" ? window.originalWidth : 0;
  }
  function getOriginalHeight() {
    return typeof window.originalHeight === "number" ? window.originalHeight : 0;
  }

  function getShowAnnotationText() {
    return typeof window.showAnnotationText === "boolean" ? window.showAnnotationText : true;
  }
  function setShowAnnotationText(v) {
    window.showAnnotationText = !!v;
  }
  function getShowKeyPoints() {
    return typeof window.showKeyPoints === "boolean" ? window.showKeyPoints : true;
  }
  function setShowKeyPoints(v) {
    window.showKeyPoints = !!v;
  }

  function safeUpdateView() {
    if (typeof window.updateView === "function") {
      window.updateView();
    } else {
      console.warn("⚠️ updateView() is not available yet. (Check script order)");
    }
  }

  // -----------------------------
  // Drag state (UI-only)
  // -----------------------------
  let isDragging = false;
  let startX = 0;
  let startY = 0;
  let initialScrollLeft = 0;
  let initialScrollTop = 0;

  // -----------------------------
  // Helpers
  // -----------------------------
  function computeMinZoom() {
    if (!viewer) return 1;
    const ow = getOriginalWidth();
    const oh = getOriginalHeight();
    if (!ow || !oh) return 1;

    // Fit-to-viewer min zoom
    const z = Math.min(viewer.clientWidth / ow, viewer.clientHeight / oh);
    return Math.max(0.01, z);
  }

  function clampZoom(z) {
    const minZ = computeMinZoom();
    const maxZ = 5;
    if (!isFinite(z)) return getZoom();
    return Math.max(minZ, Math.min(z, maxZ));
  }

  // Zoom to a specific point (mouse position)
  function zoomToPoint(nextZoom, clientX, clientY) {
    if (!viewer) return;
    const ow = getOriginalWidth();
    const oh = getOriginalHeight();
    if (!ow || !oh) return;

    const oldZoom = getZoom();
    const z = clampZoom(nextZoom);
    if (Math.abs(z - oldZoom) < 1e-9) return;

    // Mouse position relative to viewer
    const rect = viewer.getBoundingClientRect();
    const mouseX = clientX - rect.left;
    const mouseY = clientY - rect.top;

    // Current content offsets (in scaled space)
    const offsetX = mouseX + viewer.scrollLeft;
    const offsetY = mouseY + viewer.scrollTop;

    // Fraction in content space based on old zoom
    const fx = offsetX / (ow * oldZoom);
    const fy = offsetY / (oh * oldZoom);

    setZoom(z);
    safeUpdateView();

    // Scroll so that the same fraction remains under the cursor
    viewer.scrollLeft = fx * (ow * z) - mouseX;
    viewer.scrollTop = fy * (oh * z) - mouseY;
  }

  // Zoom to viewer center
  function zoomToCenter(nextZoom) {
    if (!viewer) return;
    const rect = viewer.getBoundingClientRect();
    const centerX = rect.left + viewer.clientWidth / 2;
    const centerY = rect.top + viewer.clientHeight / 2;
    zoomToPoint(nextZoom, centerX, centerY);
  }

  // ==========================================================================
  // INTERACTION FUNCTIONS: ZOOM & DRAG
  // ==========================================================================

  // Smooth zoom with scroll wheel - ZOOM TO MOUSE POSITION
  function handleZoom(e) {
    if (!viewer) return;

    const ow = getOriginalWidth();
    const oh = getOriginalHeight();
    if (!ow || !oh) return;

    e.preventDefault();

    const oldZoom = getZoom();
    const direction = e.deltaY > 0 ? -1 : 1;
    const step = direction > 0 ? 1.1 : 0.9;
    const nextZoom = oldZoom * step;

    // Zoom to mouse position (ENHANCED)
    zoomToPoint(nextZoom, e.clientX, e.clientY);
    console.log(`🔍 Zoom at mouse: ${oldZoom.toFixed(3)} → ${getZoom().toFixed(3)}`);
  }

  // Desktop dblclick zoom toggle (fit <-> 2x)
  function handleDoubleClick(e) {
    if (!viewer) return;

    const ow = getOriginalWidth();
    const oh = getOriginalHeight();
    if (!ow || !oh) return;

    e.preventDefault();
    e.stopPropagation();

    const minZ = computeMinZoom();
    const oldZoom = getZoom();

    const nextZoom = Math.abs(oldZoom - minZ) < 0.05 ? Math.min(2, 5) : minZ;

    // Zoom to mouse position on double-click
    zoomToPoint(nextZoom, e.clientX, e.clientY);
    console.log(`🔄 Double-click zoom: ${oldZoom.toFixed(3)} → ${getZoom().toFixed(3)}`);
  }

  function startDrag(e) {
    if (!viewer) return;
    if (e.button !== 0) return;

    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;
    initialScrollLeft = viewer.scrollLeft;
    initialScrollTop = viewer.scrollTop;

    viewer.classList.add("dragging");
    viewer.style.cursor = "grabbing";
    console.log(`🖱️ Drag start: scroll (${initialScrollLeft}, ${initialScrollTop})`);
  }

  function drag(e) {
    if (!viewer || !isDragging) return;

    if ((e.buttons & 1) === 0) {
      endDrag();
      return;
    }

    const deltaX = e.clientX - startX;
    const deltaY = e.clientY - startY;

    viewer.scrollLeft = initialScrollLeft - deltaX;
    viewer.scrollTop = initialScrollTop - deltaY;
  }

  function endDrag() {
    if (!viewer) return;
    if (!isDragging) return;
    
    isDragging = false;
    viewer.classList.remove("dragging");
    viewer.style.cursor = "grab";
    console.log(`🖱️ Drag end: scroll (${viewer.scrollLeft}, ${viewer.scrollTop})`);
  }

  // Expose public API
  window.handleZoom = handleZoom;
  window.startDrag = startDrag;
  window.drag = drag;
  window.endDrag = endDrag;

  // -----------------------------
  // Attach listeners
  // -----------------------------
  if (viewer) {
    viewer.addEventListener("wheel", handleZoom, { passive: false });
    viewer.addEventListener("mousedown", startDrag);
    viewer.addEventListener("mousemove", drag);
    viewer.addEventListener("mouseup", endDrag);
    viewer.addEventListener("mouseleave", endDrag);
    viewer.addEventListener("dblclick", handleDoubleClick);
  }

  // ==========================================================================
  // ZOOM CONTROLS - Left Side Panel
  // ==========================================================================

  function createZoomControls() {
    // Check if controls already exist
    if (document.getElementById("zoomControls")) return;

    const controls = document.createElement("div");
    controls.id = "zoomControls";
    controls.style.cssText = `
      position: absolute;
      left: 20px;
      top: 50%;
      transform: translateY(-50%);
      display: flex;
      flex-direction: column;
      gap: 10px;
      z-index: 100;
      background: rgba(255, 255, 255, 0.95);
      padding: 10px;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.15);
    `;

    // Zoom In Button
    const zoomInBtn = document.createElement("button");
    zoomInBtn.id = "zoomInBtn";
    zoomInBtn.innerHTML = "➕";
    zoomInBtn.title = "Zoom In";
    zoomInBtn.style.cssText = `
      width: 40px;
      height: 40px;
      font-size: 20px;
      border: 1px solid #ccc;
      border-radius: 4px;
      background: white;
      cursor: pointer;
      transition: all 0.2s;
    `;
    zoomInBtn.onmouseover = () => zoomInBtn.style.background = "#f0f0f0";
    zoomInBtn.onmouseout = () => zoomInBtn.style.background = "white";
    zoomInBtn.onclick = () => {
      const oldZoom = getZoom();
      const nextZoom = oldZoom * 1.2;
      zoomToCenter(nextZoom);
      console.log(`➕ Zoom In: ${oldZoom.toFixed(3)} → ${getZoom().toFixed(3)}`);
    };

    // Zoom Out Button
    const zoomOutBtn = document.createElement("button");
    zoomOutBtn.id = "zoomOutBtn";
    zoomOutBtn.innerHTML = "➖";
    zoomOutBtn.title = "Zoom Out";
    zoomOutBtn.style.cssText = zoomInBtn.style.cssText;
    zoomOutBtn.onmouseover = () => zoomOutBtn.style.background = "#f0f0f0";
    zoomOutBtn.onmouseout = () => zoomOutBtn.style.background = "white";
    zoomOutBtn.onclick = () => {
      const oldZoom = getZoom();
      const nextZoom = oldZoom * 0.8;
      zoomToCenter(nextZoom);
      console.log(`➖ Zoom Out: ${oldZoom.toFixed(3)} → ${getZoom().toFixed(3)}`);
    };

    // Fit to Screen Button
    const fitBtn = document.createElement("button");
    fitBtn.id = "fitToScreenBtn";
    fitBtn.innerHTML = "⊡";
    fitBtn.title = "Fit to Screen";
    fitBtn.style.cssText = zoomInBtn.style.cssText;
    fitBtn.onmouseover = () => fitBtn.style.background = "#f0f0f0";
    fitBtn.onmouseout = () => fitBtn.style.background = "white";
    fitBtn.onclick = () => {
      const oldZoom = getZoom();
      const minZ = computeMinZoom();
      zoomToCenter(minZ);
      console.log(`⊡ Fit to Screen: ${oldZoom.toFixed(3)} → ${getZoom().toFixed(3)}`);
    };

    controls.appendChild(zoomInBtn);
    controls.appendChild(zoomOutBtn);
    controls.appendChild(fitBtn);

    // Insert into page (relative to viewer's parent)
    if (viewer && viewer.parentElement) {
      // Ensure parent has position context
      const parent = viewer.parentElement;
      if (getComputedStyle(parent).position === "static") {
        parent.style.position = "relative";
      }
      parent.appendChild(controls);
    } else {
      document.body.appendChild(controls);
    }
  }

  // Create controls on load
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", createZoomControls);
  } else {
    createZoomControls();
  }

  // ==========================================================================
  // UI toggles (buttons)
  // ==========================================================================

  const toggleTextBtn = document.getElementById("toggleTextBtn");
  const toggleKeyPointsBtn = document.getElementById("toggleKeyPointsBtn");

  function refreshToggleButtonLabels() {
    if (toggleTextBtn) {
      const on = getShowAnnotationText();
      toggleTextBtn.textContent = on ? "Hide Annotation Text" : "Show Annotation Text";
    }
    if (toggleKeyPointsBtn) {
      const on = getShowKeyPoints();
      toggleKeyPointsBtn.textContent = on ? "Hide Key Points" : "Show Key Points";
    }
  }

  if (toggleTextBtn) {
    toggleTextBtn.addEventListener("click", () => {
      const next = !getShowAnnotationText();
      setShowAnnotationText(next);
      refreshToggleButtonLabels();
      safeUpdateView();
    });
  }

  if (toggleKeyPointsBtn) {
    toggleKeyPointsBtn.addEventListener("click", () => {
      const next = !getShowKeyPoints();
      setShowKeyPoints(next);
      refreshToggleButtonLabels();
      safeUpdateView();
    });
  }

  refreshToggleButtonLabels();

})();