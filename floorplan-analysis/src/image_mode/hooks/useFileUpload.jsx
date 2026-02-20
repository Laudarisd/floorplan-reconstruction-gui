// Codex Note: hooks/useFileUpload.js - Main logic for this module/task.
import { useState } from 'react';
import { uploadFile } from '../../services/api.jsx';

// Utility: trigger ZIP file download for user
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

export const useFileUpload = () => {
  // Upload state + preview data
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState({ message: '', type: 'info' });
  const [isUploading, setIsUploading] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);

  // Generate preview image for UI
  const handleImageSelect = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreviewImage(e.target.result);
    };
    reader.readAsDataURL(file);
  };

  // Upload image + metadata and return ZIP blob
  const upload = async (file, metadata, serverConfig) => {
    if (!file) {
      setStatus({ message: 'Please select an image first.', type: 'error' });
      return null;
    }

    setIsUploading(true);
    setProgress(10);
    setStatus({ message: 'Uploading...', type: 'info' });

    try {
      const formData = new FormData();
      formData.append('user_id', metadata.userId);
      formData.append('project_number', metadata.projectNumber);
      formData.append('floor_number', metadata.floorNumber);
      formData.append('date', new Date().toISOString().split('T')[0]);
      formData.append('images', file);

      const blob = await uploadFile(formData, serverConfig.ip, serverConfig.port, setProgress);
      setProgress(90);
      setStatus({ message: `ZIP received (${(blob.size / 1024).toFixed(1)} KB)`, type: 'success' });

      // Download ZIP file locally for user
      downloadZipFile(blob, `${metadata.userId}.zip`);

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
    previewImage,
    handleImageSelect,
    upload
  };
};
