import { useState } from 'react';
import JSZip from 'jszip';
import { uploadFile } from '../../services/api.jsx';

// Trigger browser download for returned ZIP.
const downloadZipFile = (blob, filename) => {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
};

// Derive a stable root folder name for ZIP naming.
const getRootFolderName = (files) => {
  if (!files || files.length === 0) return 'dwg-folder';
  const firstPath = files[0].webkitRelativePath || files[0].name || 'dwg-folder';
  return firstPath.split('/')[0] || 'dwg-folder';
};

export const useDwgZipUpload = () => {
  // Upload UI state.
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState({ message: '', type: 'info' });
  const [isUploading, setIsUploading] = useState(false);

  // Upload a ZIP file or zip a folder and POST to backend (DWG flow).
  const upload = async (input, metadata, serverConfig) => {
    if (!input || (Array.isArray(input) && input.length === 0)) {
      setStatus({ message: 'Please select a DWG ZIP file first.', type: 'error' });
      return null;
    }

    if (!serverConfig?.ip || !serverConfig?.port) {
      setStatus({ message: 'Please set the Server IP and Port first.', type: 'error' });
      return null;
    }

    setIsUploading(true);
    setProgress(5);
    setStatus({ message: 'Preparing ZIP...', type: 'info' });

    try {
      // Accept a ZIP file directly or build one from a folder input.
      const isZipFile =
        input instanceof File &&
        (input.type === 'application/zip' || /\.zip$/i.test(input.name || ''));

      let zipBlob = null;
      let rootName = 'dwg-folder';

      if (isZipFile) {
        // Use the provided ZIP file directly.
        zipBlob = input;
        rootName = input.name.replace(/\.zip$/i, '') || 'dwg-folder';
        setProgress(30);
      } else {
        const zip = new JSZip();
        const fileList = Array.from(input);
        rootName = getRootFolderName(fileList);

        // Preserve folder structure using webkitRelativePath.
        fileList.forEach((file) => {
          const path = file.webkitRelativePath || file.name;
          zip.file(path, file);
        });

        // Generate ZIP in-memory with progress mapping (0-60%).
        zipBlob = await zip.generateAsync(
          { type: 'blob', compression: 'DEFLATE' },
          (metadata) => {
            const pct = Math.max(5, Math.min(60, Math.round(metadata.percent * 0.6)));
            setProgress(pct);
          }
        );
      }

      setProgress(60);
      setStatus({ message: 'Uploading DWG ZIP...', type: 'info' });

      const formData = new FormData();
      formData.append('user_id', metadata.userId);
      formData.append('project_number', metadata.projectNumber);
      formData.append('date', new Date().toISOString().split('T')[0]);

      // Backend expects "images" as the file field name.
      const zipFile = zipBlob instanceof File
        ? zipBlob
        : new File([zipBlob], `${rootName}.zip`, { type: 'application/zip' });
      formData.append('images', zipFile);

      const blob = await uploadFile(formData, serverConfig.ip, serverConfig.port, (pct) => {
        const mapped = 60 + Math.round((pct / 80) * 30);
        setProgress(mapped);
      });

      setProgress(95);
      setStatus({ message: `ZIP received (${(blob.size / 1024).toFixed(1)} KB)`, type: 'success' });
      downloadZipFile(blob, `${metadata.userId || 'dwg'}.zip`);
      setProgress(100);

      return blob;
    } catch (err) {
      setStatus({ message: `Error: ${err.message}`, type: 'error' });
      setProgress(0);
      return null;
    } finally {
      setIsUploading(false);
    }
  };

  return {
    progress,
    status,
    isUploading,
    upload,
  };
};
