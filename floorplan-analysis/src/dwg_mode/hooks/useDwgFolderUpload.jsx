import { useState } from 'react';

const isImageFile = (file) => {
  return file?.type?.startsWith('image/') || /\.(png|jpg|jpeg|bmp|gif|webp)$/i.test(file?.name || '');
};

const fileToDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error(`Failed to read file: ${file?.name || 'unknown'}`));
    reader.readAsDataURL(file);
  });

const normalizePath = (path) => (path || '').replace(/\\/g, '/').toLowerCase();

export const useDwgFolderUpload = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [status, setStatus] = useState({ message: '', type: 'info' });

  // Parse folder selection into one original image + many layer images.
  const parseFolderFiles = async (files) => {
    if (!files || files.length === 0) {
      setStatus({ message: 'Please select a DWG folder first.', type: 'error' });
      return null;
    }

    setIsProcessing(true);
    setStatus({ message: 'Reading DWG folder...', type: 'info' });

    try {
      const fileList = Array.from(files).filter(isImageFile);
      const originalCandidates = fileList.filter((f) =>
        normalizePath(f.webkitRelativePath || f.name).includes('/original_img/')
      );
      const layerCandidates = fileList.filter((f) =>
        normalizePath(f.webkitRelativePath || f.name).includes('/layers/')
      );

      if (originalCandidates.length === 0) {
        setStatus({ message: 'No image found in folder/original_img.', type: 'error' });
        return null;
      }
      if (layerCandidates.length === 0) {
        setStatus({ message: 'No images found in folder/layers.', type: 'error' });
        return null;
      }

      const originalFile = originalCandidates[0];
      const originalDataUrl = await fileToDataUrl(originalFile);

      const layerItems = await Promise.all(
        layerCandidates
          .sort((a, b) => a.name.localeCompare(b.name))
          .map(async (file) => ({
            name: file.name,
            relativePath: file.webkitRelativePath || file.name,
            dataUrl: await fileToDataUrl(file),
          }))
      );

      const firstRelativePath = originalFile.webkitRelativePath || originalFile.name;
      const folderName = firstRelativePath.split('/')[0] || 'DWG Folder';

      const payload = {
        folderName,
        originalImage: {
          name: originalFile.name,
          relativePath: originalFile.webkitRelativePath || originalFile.name,
          dataUrl: originalDataUrl,
        },
        layers: layerItems,
        uploadedAt: new Date().toISOString(),
      };

      setStatus({
        message: `Loaded 1 original image and ${layerItems.length} layer image(s).`,
        type: 'success',
      });
      return payload;
    } catch (error) {
      setStatus({ message: `Error: ${error.message}`, type: 'error' });
      return null;
    } finally {
      setIsProcessing(false);
    }
  };

  return {
    isProcessing,
    status,
    parseFolderFiles,
  };
};
