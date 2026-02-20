// Codex Note: services/api.js - Main logic for this module/task.
// Server API service for image upload and data fetching
// Upload image form data to backend
export const uploadFile = async (formData, serverIp, serverPort, onProgress) => {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const url = `http://${serverIp}:${serverPort}/receive_data`;

    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable) {
        const percent = Math.round((e.loaded / e.total) * 80);
        onProgress(percent);
      }
    });

    xhr.addEventListener("load", () => {
      if (xhr.status === 200) {
        resolve(xhr.response);
      } else {
        reject(new Error(`Server error: ${xhr.status}`));
      }
    });

    xhr.addEventListener("error", () => reject(new Error("Network error")));
    xhr.addEventListener("timeout", () => reject(new Error("Request timed out")));

    xhr.timeout = 120000;
    xhr.open("POST", url, true);
    xhr.responseType = "blob";
    xhr.send(formData);
  });
};

// Simple GET ping for server reachability
export const testConnection = async (serverIp, serverPort) => {
  const baseUrl = `http://${serverIp}:${serverPort}`;
  const healthUrl = `${baseUrl}/health`;
  const openApiUrl = `${baseUrl}/openapi.json`;
  const docsUrl = `${baseUrl}/docs`;

  try {
    const healthRes = await fetch(healthUrl, { method: "GET" });
    if (healthRes.ok) {
      return { ok: true, message: "Connection successful (health endpoint)." };
    }

    if (healthRes.status === 404) {
      const openApiRes = await fetch(openApiUrl, { method: "GET" });
      if (openApiRes.ok) {
        return { ok: true, message: "Connection successful (openapi endpoint)." };
      }

      const docsRes = await fetch(docsUrl, { method: "GET" });
      if (docsRes.ok) {
        return { ok: true, message: "Connection successful (docs endpoint)." };
      }

      return {
        ok: true,
        message: "Server reachable, but /health, /openapi.json, and /docs are not available.",
      };
    }

    return { ok: false, message: `Server responded with status ${healthRes.status}.` };
  } catch (err) {
    console.error("Connection test failed:", err);
    return { ok: false, message: `Cannot connect to ${baseUrl}` };
  }
};
