import React, { useState } from 'react';
import { extractZipBlob } from '../../../image_mode/services/zipService.jsx';
import { useDwgZipUpload } from '../../hooks/useDwgZipUpload.jsx';
import '../../../image_mode/style/tasks/file-upload.css';

const DWG_UPLOAD_COPY = {
  title: 'Upload DWG ZIP',
  userIdLabel: 'User ID:',
  projectLabel: 'Project Number:',
  folderLabel: 'Select ZIP File:',
  userIdPlaceholder: 'e.g., DWG-Today',
  projectPlaceholder: 'e.g., PRJ-1',
  processLabel: 'Send to Server',
  processingLabel: 'Processing...',
  hint: 'ZIP must contain original_img (one image) and layers (multiple images).',
};

const DWG_UPLOAD_CLASSNAMES = {
  column: 'column',
  formGroup: 'form-group',
  btn: 'btn',
  statusMessage: 'status-message',
  imagePreview: 'image-preview',
  progressBar: 'progress-bar',
  progressFill: 'progress-fill',
};

const DwgFileUploadPanel = ({
  onDwgDataReady,
  onZipReceived,
  onInputZipReady,
  serverConfig,
  setLoading,
}) => {
  // DWG upload metadata fields.
  const [formData, setFormData] = useState({
    userId: 'DWG-Today',
    projectNumber: 'PRJ-1',
  });
  // ZIP file selected by the user.
  const [zipFile, setZipFile] = useState(null);
  const [folderLabel, setFolderLabel] = useState('');
  const {
    isUploading,
    progress: uploadProgress,
    status: uploadStatus,
    upload,
  } = useDwgZipUpload();

  // Track the selected ZIP file and display its name.
  const handleFolderChange = (e) => {
    const file = e.target.files?.[0] || null;
    setZipFile(file);
    setFolderLabel(file ? file.name : '');
  };

  // Validate inputs, then upload ZIP to server.
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (serverConfig?.ip === '127.0.0.1' || serverConfig?.ip === 'localhost') {
      alert(
        'Please set the correct server IP address in Settings.\n127.0.0.1 is only a placeholder example.'
      );
      return;
    }

    if (!zipFile) return;

    // Keep minimal metadata in DWG history.
    onDwgDataReady({
      folderName: zipFile.name,
      originalImage: null,
      layers: [],
      uploadedAt: new Date().toISOString(),
    });

    if (onInputZipReady) {
      try {
        const inputZip = await extractZipBlob(zipFile);
        onInputZipReady({ ...inputZip, zipBlob: zipFile });
      } catch (error) {
        console.error('Failed to parse input ZIP:', error);
      }
    }

    setLoading({
      dataContent: true,
      dataCheck: true,
      visualization: true,
    });

    const zipBlob = await upload(zipFile, formData, serverConfig);
    if (zipBlob && onZipReceived) {
      onZipReceived(zipBlob, zipFile.name);
    }
  };

  return (
    <div className={DWG_UPLOAD_CLASSNAMES.column}>
      <h3>{DWG_UPLOAD_COPY.title}</h3>
      <form onSubmit={handleSubmit}>
        <div className={DWG_UPLOAD_CLASSNAMES.formGroup}>
          <label>{DWG_UPLOAD_COPY.userIdLabel}</label>
          <input
            type="text"
            value={formData.userId}
            onChange={(e) => setFormData({ ...formData, userId: e.target.value })}
            required
            placeholder={DWG_UPLOAD_COPY.userIdPlaceholder}
          />
        </div>

        <div className={DWG_UPLOAD_CLASSNAMES.formGroup}>
          <label>{DWG_UPLOAD_COPY.projectLabel}</label>
          <input
            type="text"
            value={formData.projectNumber}
            onChange={(e) => setFormData({ ...formData, projectNumber: e.target.value })}
            required
            placeholder={DWG_UPLOAD_COPY.projectPlaceholder}
          />
        </div>

        <div className={DWG_UPLOAD_CLASSNAMES.formGroup}>
          <label>{DWG_UPLOAD_COPY.folderLabel}</label>
          <input type="file" accept=".zip,application/zip" onChange={handleFolderChange} required />
          <small>{DWG_UPLOAD_COPY.hint}</small>
          {folderLabel && <div className="image-filename">{folderLabel}</div>}
        </div>

        <button type="submit" className={DWG_UPLOAD_CLASSNAMES.btn} disabled={isUploading}>
          {isUploading ? DWG_UPLOAD_COPY.processingLabel : DWG_UPLOAD_COPY.processLabel}
        </button>

        {uploadProgress > 0 && uploadProgress < 100 && (
          <div className={DWG_UPLOAD_CLASSNAMES.progressBar}>
            <div
              className={DWG_UPLOAD_CLASSNAMES.progressFill}
              style={{ width: `${uploadProgress}%` }}
            ></div>
          </div>
        )}
      </form>

      {uploadStatus.message && (
        <div className={`${DWG_UPLOAD_CLASSNAMES.statusMessage} ${uploadStatus.type}`}>
          {uploadStatus.message}
        </div>
      )}
    </div>
  );
};

export default DwgFileUploadPanel;
