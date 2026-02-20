// Codex Note: services/zipService.js - Main logic for this module/task.
import JSZip from "jszip";

// Read ZIP contents into file list + JSZip instance
export const extractZipBlob = async (zipBlob) => {
  const zip = await JSZip.loadAsync(zipBlob);
  const files = Object.keys(zip.files).filter(name => !zip.files[name].dir);
  return { zip, files };
};

// Parse a single ZIP entry into JSON/image/text
export const extractFileContent = async (zip, fileName) => {
  if (fileName.endsWith(".json")) {
    const content = await zip.files[fileName].async("string");
    return { type: "json", data: JSON.parse(content) };
  } else if (fileName.match(/\.(png|jpg|jpeg)$/)) {
    const blob = await zip.files[fileName].async("blob");
    return { type: "image", url: URL.createObjectURL(blob) };
  } else {
    const content = await zip.files[fileName].async("string");
    return { type: "text", content };
  }
};

// Pull scale info from crop JSON if present
export const extractScaleInfo = async (zip) => {
  const files = Object.keys(zip.files).filter(name => !zip.files[name].dir);
  const cropJsonFile = files.find(f => f.toLowerCase().includes("crop") && f.endsWith(".json"));

  if (!cropJsonFile) return null;

  try {
    const content = await zip.files[cropJsonFile].async("string");
    const cropData = JSON.parse(content);
    const cropObjs = cropData.data?.objects || cropData.objects || [];
    const firstObj = cropObjs[0];

    if (firstObj?.original_size && firstObj?.crop_size) {
      return {
        originalWidth: firstObj.original_size.width,
        originalHeight: firstObj.original_size.height,
        cropWidth: firstObj.crop_size.width,
        cropHeight: firstObj.crop_size.height,
        cropXMin: firstObj.bbox?.xmin || 0,
        cropYMin: firstObj.bbox?.ymin || 0,
        cropXMax: firstObj.bbox?.xmax || firstObj.original_size.width,
        cropYMax: firstObj.bbox?.ymax || firstObj.original_size.height,
      };
    }
  } catch (e) {
    console.error("Error extracting scale info:", e);
  }
  return null;
};
