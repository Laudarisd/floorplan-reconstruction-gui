import {
  bboxFromPoints,
  createRoiTransform,
  normalizeObjectsForRender,
} from '../../image_mode/services/visualizationService.jsx';

// Extract first JSON object block from model text.
const findJsonBlock = (text) => {
  if (!text) return null;
  const match = text.match(/\{[\s\S]*\}/);
  return match ? match[0] : null;
};

// Convert detection JSON object into normalized box list.
const toDetectionList = (jsonValue) => {
  if (!jsonValue || typeof jsonValue !== 'object') return [];
  // Accept wrapped format: { detections: {...}, answer: "..." }.
  const source =
    jsonValue?.detections && typeof jsonValue.detections === 'object' ? jsonValue.detections : jsonValue;
  const out = [];

  Object.entries(source).forEach(([label, maybeBoxes]) => {
    if (!Array.isArray(maybeBoxes)) return;
    maybeBoxes.forEach((entry) => {
      const coords = Array.isArray(entry) ? entry : entry?.box_2d || entry?.box;
      if (!Array.isArray(coords) || coords.length !== 4) return;
      const [yMin, xMin, yMax, xMax] = coords.map((v) => Number(v));
      if (![yMin, xMin, yMax, xMax].every(Number.isFinite)) return;
      out.push({ label, box: [yMin, xMin, yMax, xMax], color: '#2B07E3' });
    });
  });

  return out;
};

// Normalize text for fuzzy matching (bed room == bedroom).
const normalizeText = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');

// Check if point is inside polygon via ray-casting.
const isPointInPolygon = (point, polygon) => {
  const [x, y] = point;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0];
    const yi = polygon[i][1];
    const xj = polygon[j][0];
    const yj = polygon[j][1];
    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / ((yj - yi) || 1e-8) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
};

// Read and parse all json files from ZIP and normalize to shared coordinate system.
const loadNormalizedZipObjects = async (zipData) => {
  const zip = zipData?.zip;
  const files = zipData?.files || [];
  if (!zip || files.length === 0) return { objects: [], width: 0, height: 0 };

  const roiTransform = createRoiTransform();
  const dimensionAreas = {};
  const jsonFiles = files.filter((name) => name.toLowerCase().endsWith('.json'));
  const sorted = [...jsonFiles].sort((a, b) => {
    const aCrop = a.toLowerCase().includes('crop') ? 0 : 1;
    const bCrop = b.toLowerCase().includes('crop') ? 0 : 1;
    if (aCrop !== bCrop) return aCrop - bCrop;
    return a.localeCompare(b);
  });

  const out = [];
  for (const fileName of sorted) {
    const raw = await zip.files[fileName].async('string');
    let json;
    try {
      json = JSON.parse(raw);
    } catch {
      continue;
    }

    const normalized = normalizeObjectsForRender(fileName, json, roiTransform, dimensionAreas);
    if (normalized?.newRoiTransform) {
      Object.assign(roiTransform, normalized.newRoiTransform);
    }
    if (normalized?.newDimensionAreas) {
      Object.assign(dimensionAreas, normalized.newDimensionAreas);
    }

    (normalized?.objects || []).forEach((obj) => out.push({ ...obj, _sourceFile: fileName }));
  }

  return {
    objects: out,
    width: roiTransform.origW || 0,
    height: roiTransform.origH || 0,
  };
};

// Build OCR detections from ZIP memory with optional text + room filtering.
const buildOcrDetectionsFromZip = async ({ promptText, zipData }) => {
  const normalizedPrompt = String(promptText || '').toLowerCase();
  const quoted = String(promptText || '').match(/"([^"]+)"/);
  const textFilter = quoted?.[1] || '';

  // Extract location after phrases like "in bedroom" / "inside bed room".
  const roomMatch = normalizedPrompt.match(/\b(?:in|inside)\s+(?:the\s+)?([a-z0-9_\-\s]+)$/i);
  const roomFilterRaw = roomMatch ? roomMatch[1].trim() : '';
  const roomFilter = normalizeText(roomFilterRaw);

  const { objects, width, height } = await loadNormalizedZipObjects(zipData);
  if (!objects.length || !width || !height) {
    return { detections: [], textFilter, roomFilterRaw };
  }

  let ocrObjects = objects.filter((obj) => obj?.kind === 'ocr_text');
  if (textFilter) {
    const needle = String(textFilter).toLowerCase();
    ocrObjects = ocrObjects.filter((obj) => String(obj?.label || '').toLowerCase().includes(needle));
  }

  if (roomFilter) {
    const roomPolygons = objects
      .filter((obj) => obj?.kind === 'polygon' && normalizeText(obj?._cls || '').includes(roomFilter))
      .map((obj) => obj?.polygonPts || [])
      .filter((pts) => Array.isArray(pts) && pts.length >= 3);

    if (roomPolygons.length > 0) {
      ocrObjects = ocrObjects.filter((obj) => {
        const bb = bboxFromPoints(obj?.polygonPts || []);
        if (!bb) return false;
        const center = [(bb.xmin + bb.xmax) / 2, (bb.ymin + bb.ymax) / 2];
        return roomPolygons.some((poly) => isPointInPolygon(center, poly));
      });
    } else {
      ocrObjects = [];
    }
  }

  const detections = ocrObjects
    .map((obj) => {
      const bb = bboxFromPoints(obj?.polygonPts || []);
      if (!bb) return null;
      return {
        label: obj?.label || obj?._cls || 'ocr',
        box: [(bb.ymin / height) * 1000, (bb.xmin / width) * 1000, (bb.ymax / height) * 1000, (bb.xmax / width) * 1000],
        color: '#2B07E3',
      };
    })
    .filter(Boolean);

  return { detections, textFilter, roomFilterRaw };
};

// Parse LLM response and apply draw overlays when detection JSON is present.
export const applyModelResponseTools = (responseText, visualizationTools) => {
  const jsonBlock = findJsonBlock(responseText);
  if (!jsonBlock) {
    return {
      applied: false,
      detectionsCount: 0,
      responseText,
    };
  }

  try {
    const parsed = JSON.parse(jsonBlock);
    const detections = toDetectionList(parsed);
    if (detections.length > 0 && visualizationTools?.setAiDetections) {
      visualizationTools.setAiDetections(detections);
      return {
        applied: true,
        detectionsCount: detections.length,
        responseText,
      };
    }
    return {
      applied: false,
      detectionsCount: 0,
      responseText,
    };
  } catch {
    return {
      applied: false,
      detectionsCount: 0,
      responseText,
    };
  }
};

// Run local chat commands without calling LLM when intent is explicit.
export const runLocalChatTool = async ({ promptText, visualizationTools, chatContext }) => {
  const prompt = String(promptText || '').trim().toLowerCase();
  if (!prompt) return null;

  // Clear command removes all chatbot overlays.
  if (/^clear\b/.test(prompt) || /clear (draw|box|overlay|ocr)/.test(prompt)) {
    if (visualizationTools?.clearAiDetections) {
      visualizationTools.clearAiDetections();
      return 'Cleared AI drawings from visualization.';
    }
    return 'Visualization tools are not ready yet.';
  }

  // OCR command shows OCR regions, optionally filtered by quoted text.
  if (prompt.includes('ocr')) {
    if (!visualizationTools?.setAiDetections) {
      return 'OCR drawing is not available right now.';
    }

    // Prefer ZIP memory reasoning so OCR/room filters work across all result files.
    const zipData = chatContext?.zipData || null;
    if (zipData?.zip) {
      const zipResult = await buildOcrDetectionsFromZip({ promptText, zipData });
      visualizationTools.setAiDetections(zipResult.detections);
      if (zipResult.detections.length === 0) {
        if (zipResult.roomFilterRaw) {
          return `Highlighted 0 OCR regions in "${zipResult.roomFilterRaw}" from ZIP results.`;
        }
        if (zipResult.textFilter) {
          return `Highlighted 0 OCR regions matching "${zipResult.textFilter}" from ZIP results.`;
        }
        return 'Highlighted 0 OCR regions from ZIP results.';
      }

      if (zipResult.roomFilterRaw) {
        return `Highlighted ${zipResult.detections.length} OCR regions in "${zipResult.roomFilterRaw}".`;
      }
      if (zipResult.textFilter) {
        return `Highlighted ${zipResult.detections.length} OCR regions matching "${zipResult.textFilter}".`;
      }
      return `Highlighted ${zipResult.detections.length} OCR regions from ZIP results.`;
    }

    // Fallback to current visualization layer data if ZIP memory is unavailable.
    const quoted = promptText.match(/"([^"]+)"/);
    const query = quoted?.[1] || '';
    if (!visualizationTools?.showOcrDetections) return 'OCR drawing fallback is not available right now.';
    const result = visualizationTools.showOcrDetections(query);
    if (!result?.applied) return 'No OCR overlays were applied yet.';
    return query
      ? `Highlighted ${result.count} OCR regions matching "${query}".`
      : `Highlighted ${result.count} OCR regions from current results.`;
  }

  return null;
};
