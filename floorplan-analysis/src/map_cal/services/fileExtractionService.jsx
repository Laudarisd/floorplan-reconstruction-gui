// Codex Note: map_cal/services/fileExtractionService.jsx - Placeholder extractors for map calculation uploads.

const parseJson = async (file) => {
  // JSON extraction: parse file text to JS object.
  const text = await file.text();
  return JSON.parse(text);
};

const parseXml = async (file) => {
  // XML extraction: parse file text to XMLDocument.
  const text = await file.text();
  const parser = new DOMParser();
  return parser.parseFromString(text, 'application/xml');
};

const parseTextLike = async (file) => {
  // Plain text extraction for custom map formats (tolo/tol/tolformat/txt).
  return file.text();
};

export const extractMapDataFile = async (file) => {
  // Validate required upload file before parsing.
  if (!file) {
    throw new Error('No file provided for map calculation extraction.');
  }

  // Normalize extension checks using lowercase file name.
  const name = file.name?.toLowerCase() || '';

  // Route by extension to parser function.
  if (name.endsWith('.json')) return parseJson(file);
  if (name.endsWith('.xml')) return parseXml(file);
  if (
    name.endsWith('.txt') ||
    name.endsWith('.tolo') ||
    name.endsWith('.tol') ||
    name.endsWith('.tolformat')
  ) {
    return parseTextLike(file);
  }

  // Hard-fail unsupported types so UI can show clear status message.
  throw new Error(`Unsupported file type: ${file.name}`);
};
