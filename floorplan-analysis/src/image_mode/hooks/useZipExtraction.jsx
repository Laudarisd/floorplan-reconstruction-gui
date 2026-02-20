// Codex Note: hooks/useZipExtraction.js - Main logic for this module/task.
import { extractZipBlob, extractScaleInfo } from '../services/zipService.jsx';

export const useZipExtraction = () => {
  // Extract file list + scale info from ZIP blob
  const extract = async (zipBlob) => {
    try {
      const { zip: zipObj, files: fileList } = await extractZipBlob(zipBlob);
      const scale = await extractScaleInfo(zipObj);
      return { files: fileList, zip: zipObj, scaleInfo: scale, zipBlob };
    } catch (error) {
      console.error('Error extracting ZIP:', error);
      throw error;
    }
  };

  return {
    extract
  };
};
