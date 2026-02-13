// Codex Note: components/zip/ZipContentsPanel.jsx - Main logic for this module/task.
import React, { useEffect, useState } from 'react';
import GifPlaceholder from '../shared/GifPlaceholder';
import { useZipExtraction } from '../../hooks/useZipExtraction';
import '../../style/tasks/zip-contents.css';

const ZIP_COPY = {
  title: 'ZIP Contents',
  processingCaption: 'Processing your floorplan data...',
  scaleLabel: 'Scale Info:',
  empty: 'No files found in ZIP',
};

const ZIP_JSON_PRIORITY = {
  crop: 0,
  segment: 1,
  wall_oob: 2,
  normal_oob: 3,
  symbol_ocr: 4,
  dim_ocr: 5,
  space_ocr: 6,
};

const ZIP_CLASSNAMES = {
  column: 'column',
  gifContent: 'gif-content',
  fileList: 'file-list',
  fileItem: 'file-item',
  fileIcon: 'file-icon',
  scaleInfo: 'scale-info',
};

const isJsonFile = (fileName) => fileName.toLowerCase().endsWith('.json');
const isCropJsonFile = (fileName) =>
  isJsonFile(fileName) && fileName.toLowerCase().includes('crop');

const ZipContentsPanel = ({
  zipBlob,
  loading,
  setLoading,
  onFileSelected,
  setZipData,
  onZipDataReady,
}) => {
  const [files, setFiles] = useState([]);
  const [scaleInfo, setScaleInfo] = useState(null);
  const [zip, setZip] = useState(null);
  const { extract } = useZipExtraction();

  // Extract ZIP whenever a new blob arrives
  useEffect(() => {
    if (zipBlob) {
      extractZip();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zipBlob]);

  // Parse ZIP contents + scale info
  const extractZip = async () => {
    try {
      const result = await extract(zipBlob);
      setFiles(result.files);
      setScaleInfo(result.scaleInfo);
      setZip(result.zip);
      setZipData(result);
      if (onZipDataReady) {
        onZipDataReady(result);
      }

      const sortedFiles = sortFiles([...result.files]);
      const defaultJsonFile =
        sortedFiles.find((name) => isCropJsonFile(name)) ||
        sortedFiles.find((name) => isJsonFile(name));

      if (defaultJsonFile) {
        const defaultFileData = await readFileData(result.zip, defaultJsonFile);
        onFileSelected(defaultFileData);
        setLoading((prev) => ({ ...prev, dataCheck: false }));
      }

      setLoading((prev) => ({ ...prev, dataContent: false, visualization: false }));
    } catch (error) {
      console.error('Error extracting ZIP:', error);
    }
  };

  const readFileData = async (activeZip, fileName) => {
    const fileData = { fileName };

    if (fileName.endsWith('.json')) {
      const content = await activeZip.files[fileName].async('string');
      fileData.type = 'json';
      fileData.content = JSON.parse(content);
    } else if (fileName.match(/\.(png|jpg|jpeg)$/)) {
      const blob = await activeZip.files[fileName].async('blob');
      fileData.type = 'image';
      fileData.url = URL.createObjectURL(blob);
    } else {
      const content = await activeZip.files[fileName].async('string');
      fileData.type = 'text';
      fileData.content = content;
    }

    return fileData;
  };

  // Single-click file selection (JSON/image/text)
  const handleFileClick = async (fileName) => {
    if (!zip) return;

    try {
      const fileData = await readFileData(zip, fileName);
      onFileSelected(fileData);
      setLoading((prev) => ({ ...prev, dataCheck: false }));
    } catch (error) {
      console.error('Error reading file:', error);
    }
  };

  const getFileIcon = (fileName) => {
    if (fileName.endsWith('.json')) return '[JSON]';
    if (fileName.match(/\.(png|jpg|jpeg)$/)) return '[IMG]';
    return '[TXT]';
  };

  const sortFiles = (fileList) => {
    const getPriority = (fileName) => {
      const lower = fileName.toLowerCase();
      for (const [key, priority] of Object.entries(ZIP_JSON_PRIORITY)) {
        if (lower.includes(key)) return priority;
      }
      return 999;
    };

    return fileList.sort((a, b) => {
      const priorityA = getPriority(a);
      const priorityB = getPriority(b);

      if (priorityA !== priorityB) {
        return priorityA - priorityB;
      }
      return a.localeCompare(b);
    });
  };

  return (
    <div className={ZIP_CLASSNAMES.column}>
      <h3>{ZIP_COPY.title}</h3>
      {loading ? (
        <div id="dataContentGif" className="gif-placeholder">
          <GifPlaceholder gifSrc="/assets/man and robot working.gif" caption={ZIP_COPY.processingCaption} />
        </div>
      ) : (
        <div id="dataContentBody" className={ZIP_CLASSNAMES.gifContent}>
          {scaleInfo && (
            <div id="scaleInfo" className={ZIP_CLASSNAMES.scaleInfo}>
              <strong>{ZIP_COPY.scaleLabel}</strong>
              <br />
              Original: {scaleInfo.originalWidth} x {scaleInfo.originalHeight}px
              <br />
              Crop: {scaleInfo.cropWidth} x {scaleInfo.cropHeight}px
              <br />
              Offset: ({scaleInfo.cropXMin}, {scaleInfo.cropYMin})px
            </div>
          )}

          <div id="fileList" className={ZIP_CLASSNAMES.fileList}>
            {files.length === 0 ? (
              <p>{ZIP_COPY.empty}</p>
            ) : (
              <>
                <p className="file-count">
                  {files.length} file{files.length !== 1 ? 's' : ''} found
                </p>
                {sortFiles(files).map((fileName, index) => (
                  <div
                    key={`${fileName}-${index}`}
                    className={ZIP_CLASSNAMES.fileItem}
                    onClick={() => handleFileClick(fileName)}
                  >
                    <span className={ZIP_CLASSNAMES.fileIcon}>{getFileIcon(fileName)}</span>
                    <span className="file-name">{fileName}</span>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ZipContentsPanel;
