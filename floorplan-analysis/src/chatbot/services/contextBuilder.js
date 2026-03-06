// Convert object URL image to inline base64 for multimodal LLM calls.
const objectUrlToInlineData = async (url) => {
  if (!url || typeof url !== 'string') return null;
  if (!url.startsWith('blob:') && !url.startsWith('data:')) return null;

  // Reuse data URL directly when available.
  if (url.startsWith('data:')) {
    const [meta, data] = url.split(',');
    const mimeMatch = meta.match(/^data:(.*?);base64$/);
    if (!mimeMatch || !data) return null;
    return { mimeType: mimeMatch[1] || 'image/png', data };
  }

  const response = await fetch(url);
  const blob = await response.blob();
  const arrayBuffer = await blob.arrayBuffer();
  const uint8 = new Uint8Array(arrayBuffer);
  let binary = '';
  for (let i = 0; i < uint8.byteLength; i += 1) {
    binary += String.fromCharCode(uint8[i]);
  }

  return {
    mimeType: blob.type || 'image/png',
    data: btoa(binary),
  };
};

// Keep context compact to avoid oversized prompt payloads.
const toCompactJson = (value, maxChars = 1200) => {
  const text = JSON.stringify(value, null, 2);
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars)}\n...truncated`;
};

// Parse object count from known result JSON shapes.
const getObjectCount = (jsonValue) => {
  if (!jsonValue || typeof jsonValue !== 'object') return 0;
  if (Array.isArray(jsonValue?.objects)) return jsonValue.objects.length;
  if (Array.isArray(jsonValue?.data?.objects)) return jsonValue.data.objects.length;
  return 0;
};

// Load a few json entries from ZIP for model context.
const loadZipJsonSummaries = async (zipData, maxFiles = 3, previewChars = 500) => {
  const zip = zipData?.zip;
  const files = zipData?.files || [];
  if (!zip || files.length === 0) return [];

  const jsonFiles = files.filter((name) => name.toLowerCase().endsWith('.json')).slice(0, maxFiles);
  const summaries = [];

  for (const fileName of jsonFiles) {
    const raw = await zip.files[fileName].async('string');
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = null;
    }

    summaries.push({
      fileName,
      objectCount: getObjectCount(parsed),
      preview: parsed ? toCompactJson(parsed, previewChars) : raw.slice(0, Math.max(200, previewChars)),
    });
  }

  return summaries;
};

// Build full chatbot context from in-memory app state.
export const buildChatContext = async ({
  selectedMode,
  selectedFile,
  zipData,
  uploadedImage,
  currentImageName,
  contextLevel = 'light',
}) => {
  const isLight = contextLevel !== 'full';
  const selectedPreviewChars = isLight ? 1600 : 4500;
  const zipFilesMax = isLight ? 3 : 6;
  const zipPreviewChars = isLight ? 500 : 1200;

  const selectedJson =
    selectedFile?.type === 'json'
      ? {
          fileName: selectedFile.fileName || 'selected.json',
          objectCount: getObjectCount(selectedFile.content),
          preview: toCompactJson(selectedFile.content, selectedPreviewChars),
        }
      : null;

  const zipSummaries = await loadZipJsonSummaries(zipData, zipFilesMax, zipPreviewChars);
  const imageInlineData = await objectUrlToInlineData(uploadedImage);

  const contextText = [
    `mode: ${selectedMode || 'image'}`,
    `active_image_name: ${currentImageName || 'unknown'}`,
    `selected_file: ${selectedFile?.fileName || 'none'}`,
    selectedJson
      ? `selected_json_object_count: ${selectedJson.objectCount}\nselected_json_preview:\n${selectedJson.preview}`
      : 'selected_json_object_count: 0',
    `zip_json_files_loaded: ${zipSummaries.length}`,
    ...zipSummaries.map(
      (item, idx) =>
        `zip_json_${idx + 1}: ${item.fileName} (objects=${item.objectCount})\nzip_json_preview_${idx + 1}:\n${item.preview}`
    ),
  ].join('\n\n');

  return {
    contextText,
    imageInlineData,
    zipSummaries,
    selectedJson,
  };
};
