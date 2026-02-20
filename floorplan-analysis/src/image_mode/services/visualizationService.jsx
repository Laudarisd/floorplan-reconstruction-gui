// Codex Note: services/visualizationService.js - Main logic for this module/task.
/**
 * Visualization Service - Core canvas rendering and annotation logic
 * Ported from app/src/image_mode/viz_render.js
 */

// Utility functions for color generation
export const randomColor = () => {
  return `hsl(${Math.random() * 360},70%,50%)`;
};

export const hslToRgba = (hslColor, alpha) => {
  const hue = parseInt(hslColor.match(/\d+/)[0], 10);
  const sat = 70;
  const light = 50;

  const c = (1 - Math.abs((2 * light) / 100 - 1)) * (sat / 100);
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = light / 100 - c / 2;

  let r, g, b;
  if (hue >= 0 && hue < 60) [r, g, b] = [c, x, 0];
  else if (hue >= 60 && hue < 120) [r, g, b] = [x, c, 0];
  else if (hue >= 120 && hue < 180) [r, g, b] = [0, c, x];
  else if (hue >= 180 && hue < 240) [r, g, b] = [0, x, c];
  else if (hue >= 240 && hue < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];

  r = Math.round((r + m) * 255);
  g = Math.round((g + m) * 255);
  b = Math.round((b + m) * 255);

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

// Geometry helpers
export const isPointArrayPolygon = (p) => {
  return Array.isArray(p) && Array.isArray(p[0]) && p[0].length >= 2;
};

export const dictPolygonToPoints = (polyDict) => {
  if (!polyDict || typeof polyDict !== 'object') return [];
  const keys = Object.keys(polyDict).sort();
  return keys
    .map((k) => polyDict[k])
    .filter((v) => Array.isArray(v) && v.length >= 2)
    .map((v) => [Number(v[0]), Number(v[1])]);
};

export const anyPolygonToPoints = (poly) => {
  if (!poly) return [];
  if (isPointArrayPolygon(poly)) return poly.map((p) => [Number(p[0]), Number(p[1])]);
  if (typeof poly === 'object') return dictPolygonToPoints(poly);
  return [];
};

export const bboxFromPoints = (pts) => {
  if (!pts || pts.length === 0) return null;
  let xmin = Infinity, ymin = Infinity, xmax = -Infinity, ymax = -Infinity;
  for (const [x, y] of pts) {
    if (x < xmin) xmin = x;
    if (y < ymin) ymin = y;
    if (x > xmax) xmax = x;
    if (y > ymax) ymax = y;
  }
  return { xmin, ymin, xmax, ymax };
};

export const scalePointsForZoom = (pts, z) => {
  return pts.map(([x, y]) => [x * z, y * z]);
};

// File type detection
const _fnameLower = (name) => (name || '').toLowerCase();

export const isCropJsonFile = (name) => _fnameLower(name).includes('crop');
export const isDimOcrJsonFile = (name) => _fnameLower(name).includes('dim_ocr');
export const isSymbolOcrJsonFile = (name) => _fnameLower(name).includes('symbol_ocr');
export const isSpaceOcrJsonFile = (name) => _fnameLower(name).includes('space_ocr');

const parseConfidenceScore = (obj) => {
  if (!obj || typeof obj !== 'object') return null;
  const candidate = obj.confidence_score ?? obj.confidence ?? obj.score;
  if (candidate === undefined || candidate === null || candidate === '') return null;
  const parsed = Number(candidate);
  return Number.isFinite(parsed) ? parsed : null;
};

const pickSpaceClass = (obj) => {
  if (!obj || typeof obj !== 'object') return 'space_ocr';

  const candidates = [
    obj.segmentation_class,
    obj.class_name,
    obj.space_class,
    obj.room_class,
    obj.category,
    obj.type,
  ];

  for (const value of candidates) {
    if (value === undefined || value === null) continue;
    const cls = String(value).trim();
    if (cls) return cls;
  }

  return 'space_ocr';
};

// ROI transform management
export const createRoiTransform = () => ({
  extracted: false,
  origW: 0,
  origH: 0,
  cropW: 0,
  cropH: 0,
  roiXmin: 0,
  roiYmin: 0,
  roiXmax: 0,
  roiYmax: 0,
  scaleX: 1,
  scaleY: 1,
  offsetX: 0,
  offsetY: 0,
});

export const extractDimensionAreasFromCropJson = (cropJson) => {
  const objs = cropJson?.objects || [];
  const dimensionAreas = {};

  for (const o of objs) {
    if (o.class_name === 'dimension_area' && o.idx !== undefined) {
      dimensionAreas[o.idx] = {
        bbox_width: o.bbox_width || 0,
        bbox_height: o.bbox_height || 0,
        original_polygon: o.original_polygon || o.bbox_polygon,
      };
    }
  }
  return dimensionAreas;
};

export const ingestRoiTransformFromCropJson = (cropJson) => {
  const objs = cropJson?.objects || [];
  if (!Array.isArray(objs) || objs.length === 0) return null;

  const bg = objs.find((o) => o?.class_name === 'background');
  if (!bg) return null;

  const origW = Number(bg.original_size?.width || 0);
  const origH = Number(bg.original_size?.height || 0);
  const cropW = Number(bg.crop_size?.width || 0);
  const cropH = Number(bg.crop_size?.height || 0);

  if (!origW || !origH || !cropW || !cropH) return null;

  const roiPoly = bg.original_polygon || bg.bbox_polygon;
  if (!roiPoly) return null;

  const roiPts = anyPolygonToPoints(roiPoly);
  const roiBB = bboxFromPoints(roiPts);

  if (!roiBB) return null;

  const roiW = roiBB.xmax - roiBB.xmin;
  const roiH = roiBB.ymax - roiBB.ymin;

  if (roiW <= 0 || roiH <= 0) return null;

  return {
    extracted: true,
    origW,
    origH,
    cropW,
    cropH,
    roiXmin: roiBB.xmin,
    roiYmin: roiBB.ymin,
    roiXmax: roiBB.xmax,
    roiYmax: roiBB.ymax,
    scaleX: roiW / cropW,
    scaleY: roiH / cropH,
    offsetX: roiBB.xmin,
    offsetY: roiBB.ymin,
  };
};

export const cropDimToOriginalPts = (pts, cropIdx, dimensionAreas, roiTransform) => {
  const dim = dimensionAreas[cropIdx];
  if (!dim || !dim.bbox_width || !dim.bbox_height) return pts;

  const roiPts = anyPolygonToPoints(dim.original_polygon);
  const roiBB = bboxFromPoints(roiPts);

  if (!roiBB) return pts;

  const roiW = roiBB.xmax - roiBB.xmin;
  const roiH = roiBB.ymax - roiBB.ymin;
  const scaleX = roiW / dim.bbox_width;
  const scaleY = roiH / dim.bbox_height;
  const offsetX = roiBB.xmin;
  const offsetY = roiBB.ymin;

  return pts.map(([x, y]) => [x * scaleX + offsetX, y * scaleY + offsetY]);
};

export const cropToOriginalPts = (pts, roiTransform) => {
  if (!roiTransform.extracted) return pts;

  const sx = roiTransform.scaleX;
  const sy = roiTransform.scaleY;
  const ox = roiTransform.offsetX;
  const oy = roiTransform.offsetY;

  return pts.map(([x, y]) => [x * sx + ox, y * sy + oy]);
};

// Normalize objects for rendering
export const normalizeObjectsForRender = (fileName, json, roiTransform, dimensionAreas) => {
  const objs = json?.objects || json?.data?.objects || [];
  const out = [];

  if (isCropJsonFile(fileName)) {
    const newRoiTransform = ingestRoiTransformFromCropJson(json);
    const newDimensionAreas = extractDimensionAreasFromCropJson(json);
    
    for (const o of objs) {
      const cls = o.class_name || 'unknown_crop';
      const pts = anyPolygonToPoints(o.original_polygon || o.bbox_polygon);
      const bboxPts = o.bbox_polygon ? anyPolygonToPoints(o.bbox_polygon) : null;

      out.push({
        _cls: cls,
        kind: 'polygon',
        polygonPts: pts,
        bboxPts: bboxPts,
        label: cls,
        meta: o,
      });
    }
    
    return { objects: out, newRoiTransform, newDimensionAreas };
  }

  if (isDimOcrJsonFile(fileName)) {
    for (const o of objs) {
      const cropIdx = o.crop_idx;
      const pts = anyPolygonToPoints(o.polygon);
      const convertedPts = cropDimToOriginalPts(pts, cropIdx, dimensionAreas, roiTransform);

      const dimArea = dimensionAreas[cropIdx];
      let dimensionAreaPts = null;
      if (dimArea && dimArea.original_polygon) {
        dimensionAreaPts = anyPolygonToPoints(dimArea.original_polygon);
      }

      out.push({
        _cls: 'dim_ocr',
        kind: 'ocr_text',
        polygonPts: convertedPts,
        label: o.text || '',
        confidenceScore: parseConfidenceScore(o),
        cropIdx: cropIdx,
        dimensionAreaPts: dimensionAreaPts,
        meta: o,
      });
    }
    return { objects: out, newRoiTransform: null, newDimensionAreas: null };
  }

  if (!roiTransform.extracted) {
    console.error(`ROI transform not extracted! Load crop*.json first (${fileName})`);
    return { objects: [], newRoiTransform: null, newDimensionAreas: null };
  }

  for (const o of objs) {
    let cls = o.class_name || 'unknown';

    if (isSpaceOcrJsonFile(fileName)) {
      cls = pickSpaceClass(o);
    }

    if (isSymbolOcrJsonFile(fileName)) {
      cls = 'symbol_ocr';
    }

    const symPts = anyPolygonToPoints(o.symbol_polygon);
    const sizePts = anyPolygonToPoints(o.size_polygon);
    const detailPts = anyPolygonToPoints(o.detail_polygon);

    const mainPts = symPts.length
      ? symPts
      : anyPolygonToPoints(o.polygon || o.bbox_polygon || o.original_polygon);

    const convertedMainPts = cropToOriginalPts(mainPts, roiTransform);
    const convertedSizePts = cropToOriginalPts(sizePts, roiTransform);
    const convertedDetailPts = cropToOriginalPts(detailPts, roiTransform);

    let label = cls;
    if (isSpaceOcrJsonFile(fileName) && o.text) {
      label = o.text;
    } else if (isSymbolOcrJsonFile(fileName)) {
      label = `${o.size || ''} ${o.detail || ''}`.trim() || 'symbol_ocr';
    } else if (o.text) {
      label = o.text;
    }

    const kind = isSymbolOcrJsonFile(fileName)
      ? 'symbol_ocr'
      : o.text
      ? 'ocr_text'
      : 'polygon';

    const norm = {
      _cls: cls,
      kind,
      polygonPts: convertedMainPts,
      label,
      confidenceScore:
        parseConfidenceScore(o),
      meta: o,
    };

    if (kind === 'symbol_ocr') {
      norm.sizePts = convertedSizePts;
      norm.detailPts = convertedDetailPts;
    }

    out.push(norm);
  }

  return { objects: out, newRoiTransform: null, newDimensionAreas: null };
};

// Canvas drawing helpers
export const drawPolyOutline = (ctx, pts, color, width) => {
  if (!pts || pts.length === 0) return;
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  pts.slice(1).forEach((p) => ctx.lineTo(p[0], p[1]));
  ctx.closePath();
  ctx.stroke();
};

export const drawAnnotations = (
  ctx,
  canvas,
  classMap,
  hiddenDimensionIndices,
  zoom,
  showAnnotationText,
  showKeyPoints
) => {
  if (!canvas) return 0;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const z = zoom;
  const BORDER_WIDTH = 3 * z;
  const LABEL_HEIGHT = 28 * z;
  const LABEL_PADDING = 10 * z;
  const FONT_SIZE = 16 * z;

  let drawnCount = 0;
  const placedLabels = [];

  const rectsOverlap = (r1, r2) => {
    return !(r1.right < r2.left ||
      r1.left > r2.right ||
      r1.bottom < r2.top ||
      r1.top > r2.bottom);
  };

  const findLabelPosition = (bb, labelWidth, labelHeight) => {
    const positions = [
      { x: bb.xmin, y: bb.ymin - labelHeight - 3 * z, name: 'above' },
      { x: bb.xmax - labelWidth, y: bb.ymin - labelHeight - 3 * z, name: 'above-right' },
      { x: bb.xmin, y: bb.ymax + 3 * z, name: 'below' },
      { x: bb.xmax - labelWidth, y: bb.ymax + 3 * z, name: 'below-right' },
      { x: bb.xmin + labelWidth / 2, y: bb.ymin - labelHeight - 3 * z, name: 'above-center' },
      { x: bb.xmin + labelWidth / 2, y: bb.ymax + 3 * z, name: 'below-center' },
    ];

    for (const pos of positions) {
      const testRect = {
        left: pos.x,
        top: pos.y,
        right: pos.x + labelWidth,
        bottom: pos.y + labelHeight,
      };

      const hasOverlap = placedLabels.some((placed) => rectsOverlap(testRect, placed));

      if (!hasOverlap) {
        placedLabels.push(testRect);
        return pos;
      }
    }

    const defaultPos = {
      x: positions[0].x,
      y: positions[0].y - 10 * z,
      name: 'above-stacked',
    };
    placedLabels.push({
      left: defaultPos.x,
      top: defaultPos.y,
      right: defaultPos.x + labelWidth,
      bottom: defaultPos.y + labelHeight,
    });
    return defaultPos;
  };

  Object.keys(classMap).forEach((cls) => {
    const toggleId = `class-toggle-${cls.replace(/\s/g, '-').replace(/:/g, '-')}`;
    const toggle = document.getElementById(toggleId);
    if (!toggle || !toggle.checked) return;

    for (const o of classMap[cls]) {
      if (o.kind === 'ocr_text' && hiddenDimensionIndices.has(o.cropIdx)) {
        continue;
      }

      const color = o._color;
      const rgba = hslToRgba(color, 0.25);
      const pts = scalePointsForZoom(o.polygonPts || [], z);

      if (pts.length) {
        ctx.fillStyle = rgba;
        ctx.beginPath();
        ctx.moveTo(pts[0][0], pts[0][1]);
        pts.slice(1).forEach((p) => ctx.lineTo(p[0], p[1]));
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = color;
        ctx.lineWidth = BORDER_WIDTH;
        ctx.stroke();

        if (showKeyPoints) {
          for (const p of pts) {
            ctx.beginPath();
            ctx.arc(p[0], p[1], 5 * z, 0, 2 * Math.PI);
            ctx.fillStyle = 'red';
            ctx.fill();
          }
        }

        drawnCount++;
      }

      if (showAnnotationText && o.label) {
        const bb = bboxFromPoints(pts);
        if (bb) {
          ctx.font = `bold ${FONT_SIZE}px Arial`;

          let displayLabel = o.label;
          const isDimOcr = o.kind === 'ocr_text' && o.cropIdx !== undefined;
          const hasConfidence = Number.isFinite(o.confidenceScore);
          const confidenceSuffix = hasConfidence ? ` (${o.confidenceScore.toFixed(2)})` : '';

          if (isDimOcr) {
            const dimText = String(o.label || '').trim();
            displayLabel = `${dimText}${confidenceSuffix}`;
          } else {
            displayLabel = `${displayLabel}${confidenceSuffix}`;
          }

          const tw = ctx.measureText(displayLabel).width;
          const labelWidth = tw + LABEL_PADDING * 2;

          let labelX, labelY;

          if (isDimOcr) {
            const pos = findLabelPosition(bb, labelWidth, LABEL_HEIGHT);
            labelX = pos.x;
            labelY = pos.y;
          } else {
            labelX = bb.xmin;
            labelY = bb.ymin - LABEL_HEIGHT - 3 * z;
          }

          ctx.fillStyle = color;
          ctx.fillRect(labelX, labelY, labelWidth, LABEL_HEIGHT);

          ctx.fillStyle = 'white';
          ctx.textBaseline = 'middle';
          ctx.fillText(displayLabel, labelX + LABEL_PADDING, labelY + LABEL_HEIGHT / 2);
        }
      }

      if (o.kind === 'symbol_ocr') {
        const sizePts = scalePointsForZoom(o.sizePts || [], z);
        const detailPts = scalePointsForZoom(o.detailPts || [], z);
        drawPolyOutline(ctx, sizePts, '#00BFFF', 2 * z);
        drawPolyOutline(ctx, detailPts, '#FF4500', 2 * z);
      }

      if (o.kind === 'ocr_text' && o.dimensionAreaPts) {
        const dimAreaPtsScaled = scalePointsForZoom(o.dimensionAreaPts, z);
        drawPolyOutline(ctx, dimAreaPtsScaled, '#FF6B6B', 2 * z);
      }
    }
  });

  return drawnCount;
};
