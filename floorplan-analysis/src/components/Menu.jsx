// Legacy file kept for reference (new Vite entry uses src/main.jsx)
import React, { useState } from 'react';
import { testConnection } from '../services/api';

const Menu = ({ serverConfig, setServerConfig }) => {
  const [showModal, setShowModal] = useState(false);
  const [tempConfig, setTempConfig] = useState(serverConfig);
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('');

  const handleTestConnection = async () => {
    if (!tempConfig.ip || !tempConfig.port) {
      setConnectionStatus('⚠️ Please enter both IP and port first.');
      return;
    }
    
    setTestingConnection(true);
    setConnectionStatus('Testing connection...');
    
    const isConnected = await testConnection(tempConfig.ip, tempConfig.port);
    
    if (isConnected) {
      setConnectionStatus('✅ Connection successful!');
    } else {
      setConnectionStatus(`❌ Cannot connect to http://${tempConfig.ip}:${tempConfig.port}`);
    }
    
    setTestingConnection(false);
  };

  const handleSave = () => {
    if (!tempConfig.ip || !tempConfig.port) {
      alert('⚠️ Please enter both IP and port before saving.');
      return;
    }
    
    if (tempConfig.ip === '127.0.0.1' || tempConfig.ip === 'localhost') {
      const confirm = window.confirm('⚠️ Warning: You are using localhost (127.0.0.1).\nThis will only work if you have a server running on your local machine.\n\nDo you want to continue?');
      if (!confirm) return;
    }
    
    setServerConfig(tempConfig);
    setShowModal(false);
    alert(`✅ Server URL set to: http://${tempConfig.ip}:${tempConfig.port}/receive_data`);
  };

  return (
    <>
      <div className="menu-bar">
        <span className="menu-title">IMAGE MODE</span>
        <span style={{ marginLeft: '20px', fontSize: '13px', color: '#666' }}>
          Server: {serverConfig.ip}:{serverConfig.port}
        </span>
        <button onClick={() => setShowModal(true)} className="menu-btn">
          ⚙️ Settings
        </button>
      </div>

      {showModal && (
        <div className="modal" style={{ display: 'flex' }}>
          <div className="modal-content">
            <span className="close" onClick={() => setShowModal(false)}>
              &times;
            </span>
            <h2>Server Settings</h2>
            
            <label htmlFor="serverIp">Server IP:</label>
            <input
              type="text"
              id="serverIp"
              value={tempConfig.ip}
              onChange={(e) => setTempConfig({ ...tempConfig, ip: e.target.value })}
            />
            
            <label htmlFor="serverPort">Port:</label>
            <input
              type="text"
              id="serverPort"
              value={tempConfig.port}
              onChange={(e) => setTempConfig({ ...tempConfig, port: e.target.value })}
            />
            
            <div style={{ marginTop: '15px', marginBottom: '10px' }}>
              <button 
                onClick={handleTestConnection} 
                className="btn" 
                disabled={testingConnection}
                style={{ marginRight: '10px' }}
              >
                {testingConnection ? '⏳ Testing...' : '🔗 Test Connection'}
              </button>
              <button onClick={handleSave} className="btn">
                💾 Save
              </button>
            </div>
            
            {connectionStatus && (
              <div style={{ 
                marginTop: '10px', 
                padding: '10px', 
                backgroundColor: connectionStatus.includes('✅') ? '#d4edda' : '#f8d7da',
                border: `1px solid ${connectionStatus.includes('✅') ? '#c3e6cb' : '#f5c6cb'}`,
                borderRadius: '4px',
                fontSize: '14px'
              }}>
                {connectionStatus}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default Menu;

