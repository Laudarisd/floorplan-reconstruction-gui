import { useState } from 'react';
import { extractZipBlob, extractScaleInfo } from '../services/zipService';

export const useZipExtraction = () => {
  // ZIP extraction state cache
  const [files, setFiles] = useState([]);
  const [scaleInfo, setScaleInfo] = useState(null);
  const [zip, setZip] = useState(null);

  // Extract file list + scale info from ZIP blob
  const extract = async (zipBlob) => {
    try {
      const { zip: zipObj, files: fileList } = await extractZipBlob(zipBlob);
      setZip(zipObj);
      setFiles(fileList);

      const scale = await extractScaleInfo(zipObj);
      setScaleInfo(scale);

      return { files: fileList, zip: zipObj, scaleInfo: scale, zipBlob };
    } catch (error) {
      console.error('Error extracting ZIP:', error);
      throw error;
    }
  };

  return {
    files,
    scaleInfo,
    zip,
    extract
  };
};
