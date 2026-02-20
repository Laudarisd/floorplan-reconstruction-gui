// Codex Note: App.jsx - Main logic for this module/task.
import React, { useEffect, useRef, useState } from 'react';
import './App.css';
import './style/base.css';
import Header from './components/layout/Header';
import Footer from './components/layout/Footer';
import ServerConnectionPanel from './components/server/ServerConnectionPanel';
import FileUploadPanel from './image_mode/components/upload/FileUploadPanel';
import ZipContentsPanel from './image_mode/components/zip/ZipContentsPanel';
import JsonPreviewPanel from './image_mode/components/json/JsonPreviewPanel';
import VisualizationPanel from './image_mode/components/visualization/VisualizationPanel';
import HistoryPanel from './image_mode/components/history/HistoryPanel';
import DwgVisualizationPanel from './dwg_mode/components/DwgVisualizationPanel';
import DwgFileUploadPanel from './dwg_mode/components/upload/DwgFileUploadPanel';

function App() {
  const isImageFile = (name) => /\.(png|jpg|jpeg|bmp|gif|webp)$/i.test(name || '');

  // App-level UI state (server config, current selection, and history).
  const [serverConfig, setServerConfig] = useState({
    ip: '',
    port: '',
  });
  const [selectedMode, setSelectedMode] = useState('image');
  // Image-mode ZIP + selection state.
  const [zipBlob, setZipBlob] = useState(null);
  const [zipData, setZipData] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadedImage, setUploadedImage] = useState(null);
  const [currentImageName, setCurrentImageName] = useState('');
  // DWG-mode ZIP + selection state (kept separate from image mode).
  const [dwgZipBlob, setDwgZipBlob] = useState(null);
  const [dwgZipData, setDwgZipData] = useState(null);
  const [dwgInputZipData, setDwgInputZipData] = useState(null);
  const [dwgSelectedFile, setDwgSelectedFile] = useState(null);
  const [dwgLayerImages, setDwgLayerImages] = useState([]);
  const [selectedDwgLayer, setSelectedDwgLayer] = useState(null);
  const dwgLayerUrlsRef = useRef([]);
  const [historyEntries, setHistoryEntries] = useState([]);
  const [activeHistoryId, setActiveHistoryId] = useState(null);
  const isRestoringRef = useRef(false);
  const [loading, setLoading] = useState({
    dataContent: true,
    dataCheck: true,
    visualization: true,
  });
  // Independent loading flags for DWG flow.
  const [dwgLoading, setDwgLoading] = useState({
    dataContent: true,
    dataCheck: true,
    visualization: true,
  });
  const [dwgUploadData, setDwgUploadData] = useState(null);
  const [dwgHistoryEntries, setDwgHistoryEntries] = useState([]);
  const [activeDwgHistoryId, setActiveDwgHistoryId] = useState(null);

  // Handle image-mode upload completion (ZIP blob + preview image).
  const handleZipReceived = async (blob, imageDataUrl, imageName = '') => {
    setZipBlob(blob);
    setUploadedImage(imageDataUrl);
    setCurrentImageName(imageName || 'Uploaded Image');
  };

  // Push a new history entry (keeps all items in memory)
  const handleHistoryUpdate = (payload) => {
    setHistoryEntries((prev) => {
      const filtered = prev.filter((entry) => entry.id !== payload.id);
      return [payload, ...filtered];
    });
    setActiveHistoryId(payload.id);
  };

  // Persist image-mode ZIP data into history when extraction finishes.
  const handleZipDataReady = (zipPayload) => {
    if (isRestoringRef.current) {
      isRestoringRef.current = false;
      return;
    }
    if (!uploadedImage) return;
    const id = `${currentImageName || 'image'}-${Date.now()}`;
    handleHistoryUpdate({
      id,
      imageName: currentImageName || 'Uploaded Image',
      uploadedImage,
      zipBlob: zipPayload?.zipBlob || zipBlob,
      zipData: zipPayload,
      selectedFile: null,
    });
  };

  // Single-click JSON selection (forces redraw via nonce).
  const handleFileSelected = (fileData) => {
    const nextFile = { ...fileData, _nonce: Date.now() };
    setSelectedFile(nextFile);
    setLoading((prev) => ({ ...prev, dataCheck: false, visualization: false }));
    setHistoryEntries((prev) =>
      prev.map((entry) =>
        entry.id === activeHistoryId ? { ...entry, selectedFile: nextFile } : entry
      )
    );
  };

  // DWG: store returned ZIP and drive preview panels.
  const handleDwgZipReceived = (blob, zipName = '') => {
    setDwgZipBlob(blob);
    setDwgZipData(null);
    setDwgSelectedFile(null);
    setCurrentImageName(zipName || 'DWG ZIP');
  };

  // DWG: keep extracted ZIP state for file list + scale info.
  const handleDwgZipDataReady = (zipPayload) => {
    setDwgZipData(zipPayload);
  };

  // DWG: keep extracted input ZIP state for original/layer images.
  const handleDwgInputZipReady = (zipPayload) => {
    setDwgInputZipData(zipPayload);
  };

  // DWG: handle ZIP entry selection in Data Check panel.
  const handleDwgFileSelected = (fileData) => {
    const nextFile = { ...fileData, _nonce: Date.now() };
    setDwgSelectedFile(nextFile);
    setDwgLoading((prev) => ({ ...prev, dataCheck: false, visualization: false }));
  };

  useEffect(() => {
    let isCancelled = false;

    const loadLayerImages = async () => {
      if (!dwgInputZipData?.zip || !dwgInputZipData?.files?.length) {
        dwgLayerUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
        dwgLayerUrlsRef.current = [];
        setDwgLayerImages([]);
        setSelectedDwgLayer(null);
        return;
      }

      const layerFiles = dwgInputZipData.files.filter((fileName) => {
        const lower = fileName.replace(/\\/g, '/').toLowerCase();
        return isImageFile(lower) && /(^|\/)layer_img\//i.test(lower);
      });

      const fallbackLayerFiles =
        layerFiles.length > 0
          ? layerFiles
          : dwgInputZipData.files.filter((fileName) => {
              const lower = fileName.replace(/\\/g, '/').toLowerCase();
              return isImageFile(lower) && !/(^|\/)original_img\//i.test(lower);
            });

      const items = await Promise.all(
        fallbackLayerFiles.map(async (fileName) => {
          const blob = await dwgInputZipData.zip.files[fileName].async('blob');
          const url = URL.createObjectURL(blob);
          return { name: fileName, url };
        })
      );

      if (isCancelled) {
        items.forEach((item) => URL.revokeObjectURL(item.url));
        return;
      }

      dwgLayerUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      dwgLayerUrlsRef.current = items.map((item) => item.url);

      setDwgLayerImages(items);
      setSelectedDwgLayer(items[0] || null);
    };

    loadLayerImages();

    return () => {
      isCancelled = true;
    };
  }, [dwgInputZipData]);

  // Restore a previous image-mode history entry (image + zip + selection).
  const handleHistorySelect = (entry) => {
    isRestoringRef.current = true;
    setZipBlob(entry.zipBlob);
    setZipData(entry.zipData);
    setUploadedImage(entry.uploadedImage);
    setSelectedFile(entry.selectedFile || null);
    setCurrentImageName(entry.imageName || 'Uploaded Image');
    setActiveHistoryId(entry.id);
    setLoading({
      dataContent: false,
      dataCheck: false,
      visualization: false,
    });
  };

  // Persist DWG folder payload in memory (and history) for later processing.
  const handleDwgDataReady = (payload) => {
    if (!payload) return;

    setDwgUploadData(payload);
    const nextId = `${payload.folderName || 'dwg-folder'}-${Date.now()}`;
    const entry = {
      id: nextId,
      imageName: payload.folderName || 'DWG Folder',
      dwgData: payload,
    };

    setDwgHistoryEntries((prev) => {
      const filtered = prev.filter((item) => item.id !== nextId);
      return [entry, ...filtered];
    });
    setActiveDwgHistoryId(nextId);
  };

  // Restore a previously loaded DWG folder payload from in-memory history.
  const handleDwgHistorySelect = (entry) => {
    if (!entry?.dwgData) return;
    setDwgUploadData(entry.dwgData);
    setActiveDwgHistoryId(entry.id);
  };

  return (
    <div className="App">
      <ServerConnectionPanel
        serverConfig={serverConfig}
        setServerConfig={setServerConfig}
        selectedMode={selectedMode}
        setSelectedMode={setSelectedMode}
      />
      <Header />

      <div className="container">
        <div className="three-columns">
          {selectedMode === 'dwg' ? (
            <DwgFileUploadPanel
              onDwgDataReady={handleDwgDataReady}
              onZipReceived={handleDwgZipReceived}
              onInputZipReady={handleDwgInputZipReady}
              serverConfig={serverConfig}
              setLoading={setDwgLoading}
            />
          ) : (
            <FileUploadPanel
              serverConfig={serverConfig}
              onZipReceived={handleZipReceived}
              setLoading={setLoading}
            />
          )}
          <ZipContentsPanel
            zipBlob={selectedMode === 'dwg' ? dwgZipBlob : zipBlob}
            loading={selectedMode === 'dwg' ? dwgLoading.dataContent : loading.dataContent}
            setLoading={selectedMode === 'dwg' ? setDwgLoading : setLoading}
            onFileSelected={selectedMode === 'dwg' ? handleDwgFileSelected : handleFileSelected}
            setZipData={selectedMode === 'dwg' ? setDwgZipData : setZipData}
            onZipDataReady={selectedMode === 'dwg' ? handleDwgZipDataReady : handleZipDataReady}
            mode={selectedMode}
          />
          <JsonPreviewPanel
            selectedFile={selectedMode === 'dwg' ? dwgSelectedFile : selectedFile}
            loading={selectedMode === 'dwg' ? dwgLoading.dataCheck : loading.dataCheck}
            mode={selectedMode}
          />
        </div>

        <div className={`visualization-row ${selectedMode === 'dwg' ? 'dwg-visualization-row' : ''}`.trim()}>
          {selectedMode === 'dwg' ? (
            <DwgVisualizationPanel
              dwgUploadData={dwgUploadData}
              dwgZipData={dwgZipData}
              dwgInputZipData={dwgInputZipData}
              selectedFile={dwgSelectedFile}
              selectedLayer={selectedDwgLayer}
              loading={dwgLoading.visualization}
              setLoading={setDwgLoading}
            />
          ) : (
            <VisualizationPanel
              zipData={zipData}
              selectedFile={selectedFile}
              uploadedImage={uploadedImage}
              loading={loading.visualization}
              setLoading={setLoading}
            />
          )}
          {selectedMode === 'dwg' ? (
            <div className="dwg-side-panel">
              <aside className="dwg-layer-list">
                <h4 className="dwg-layer-title">Layers List</h4>
                {dwgLayerImages.length === 0 ? (
                  <p className="dwg-layer-empty">No layers found.</p>
                ) : (
                  <ol className="dwg-layer-items">
                    {dwgLayerImages.map((item) => (
                      <li key={item.name}>
                        <button
                          type="button"
                          className={`dwg-layer-item ${
                            selectedDwgLayer?.name === item.name ? 'is-active' : ''
                          }`}
                          onClick={() => setSelectedDwgLayer(item)}
                        >
                          <img src={item.url} alt={item.name} className="dwg-layer-thumb" />
                          <span className="dwg-layer-name">{item.name}</span>
                        </button>
                      </li>
                    ))}
                  </ol>
                )}
              </aside>
              <HistoryPanel
                entries={dwgHistoryEntries}
                activeId={activeDwgHistoryId}
                onSelect={handleDwgHistorySelect}
              />
            </div>
          ) : (
            <HistoryPanel
              entries={historyEntries}
              activeId={activeHistoryId}
              onSelect={handleHistorySelect}
            />
          )}
        </div>
      </div>

      <Footer />
    </div>
  );
}

export default App;
