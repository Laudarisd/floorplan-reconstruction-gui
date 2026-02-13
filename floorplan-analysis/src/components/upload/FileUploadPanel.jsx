// Codex Note: components/upload/FileUploadPanel.jsx - Main logic for this module/task.
import React, { useState } from 'react';
import { useFileUpload } from '../../hooks/useFileUpload';
import '../../style/tasks/file-upload.css';

const UPLOAD_COPY = {
  title: '?ì§ Upload Floorplan',
  userIdLabel: 'User ID:',
  projectLabel: 'Project Number:',
  floorLabel: 'Floor Number:',
  imageLabel: 'Select Image:',
  userIdPlaceholder: 'e.g., sd_test',
  projectPlaceholder: 'e.g., PRJ-1',
  floorPlaceholder: 'e.g., floor_1',
  sendLabel: '?? Send to Server',
};

const UPLOAD_CLASSNAMES = {
  column: 'column',
  formGroup: 'form-group',
  btn: 'btn',
  progressBar: 'progress-bar',
  progressFill: 'progress-fill',
  statusMessage: 'status-message',
  imagePreview: 'image-preview',
};

const FileUploadPanel = ({ serverConfig, onZipReceived, setLoading }) => {
  // Form defaults (used when user leaves fields unchanged)
  const [formData, setFormData] = useState({
    userId: 'username',
    projectNumber: '1',
    floorNumber: 'floor 1',
  });

  const [selectedFile, setSelectedFile] = useState(null);
  const { progress, status, isUploading, previewImage, handleImageSelect, upload } = useFileUpload();

  // Image selection + local preview
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
      handleImageSelect(file);
    }
  };

  // Upload payload to server and receive ZIP response
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (serverConfig.ip === '127.0.0.1' || serverConfig.ip === 'localhost') {
      alert(
        '?†Ô∏è Please set the correct server IP address in Settings.\n127.0.0.1 is only a placeholder example.'
      );
      return;
    }

    setLoading({
      dataContent: true,
      dataCheck: true,
      visualization: true,
    });

    const zipBlob = await upload(selectedFile, formData, serverConfig);

    if (zipBlob) {
      onZipReceived(zipBlob, previewImage, selectedFile?.name || 'Uploaded Image');
    }
  };

  return (
    <div className={UPLOAD_CLASSNAMES.column}>
      <h3>{UPLOAD_COPY.title}</h3>
      <form onSubmit={handleSubmit} id="uploadForm">
        <div className={UPLOAD_CLASSNAMES.formGroup}>
          <label>{UPLOAD_COPY.userIdLabel}</label>
          <input
            type="text"
            value={formData.userId}
            onChange={(e) => setFormData({ ...formData, userId: e.target.value })}
            required
            placeholder={UPLOAD_COPY.userIdPlaceholder}
          />
        </div>

        <div className={UPLOAD_CLASSNAMES.formGroup}>
          <label>{UPLOAD_COPY.projectLabel}</label>
          <input
            type="text"
            value={formData.projectNumber}
            onChange={(e) => setFormData({ ...formData, projectNumber: e.target.value })}
            required
            placeholder={UPLOAD_COPY.projectPlaceholder}
          />
        </div>

        <div className={UPLOAD_CLASSNAMES.formGroup}>
          <label>{UPLOAD_COPY.floorLabel}</label>
          <input
            type="text"
            value={formData.floorNumber}
            onChange={(e) => setFormData({ ...formData, floorNumber: e.target.value })}
            required
            placeholder={UPLOAD_COPY.floorPlaceholder}
          />
        </div>

        <div className={UPLOAD_CLASSNAMES.formGroup}>
          <label>{UPLOAD_COPY.imageLabel}</label>
          <input type="file" accept="image/*" onChange={handleFileChange} required />
          {previewImage && (
            <div className={UPLOAD_CLASSNAMES.imagePreview}>
              <img src={previewImage} alt="Preview" />
              <div className="image-filename">{selectedFile?.name}</div>
            </div>
          )}
        </div>

        <button type="submit" className={UPLOAD_CLASSNAMES.btn} id="submitBtn" disabled={isUploading}>
          <span id="submitText">{isUploading ? `Processing... ${progress}%` : UPLOAD_COPY.sendLabel}</span>
        </button>

        {progress > 0 && progress < 100 && (
          <div className={UPLOAD_CLASSNAMES.progressBar} id="progressBar">
            <div className={UPLOAD_CLASSNAMES.progressFill} id="progressFill" style={{ width: `${progress}%` }}></div>
          </div>
        )}
      </form>

      <div id="uploadStatus">
        {status.message && <div className={`${UPLOAD_CLASSNAMES.statusMessage} ${status.type}`}>{status.message}</div>}
      </div>
    </div>
  );
};

export default FileUploadPanel;
