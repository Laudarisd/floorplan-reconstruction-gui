// Build Gemini endpoint URL from user key.
const buildGeminiUrl = (apiKey, modelName = 'gemini-2.5-flash-lite') => {
  const encodedKey = encodeURIComponent(apiKey.trim());
  return `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${encodedKey}`;
};

// Preferred stable models from current Gemini family.
const DEFAULT_MODEL_PRIORITY = ['gemini-2.5-flash-lite', 'gemini-2.5-flash', 'gemini-2.5-pro'];

// Build final model list using verified available models when provided.
const resolveCandidateModels = (requestedModel, availableModels = []) => {
  const availableSet = new Set((availableModels || []).map((name) => String(name || '').trim()).filter(Boolean));
  const preferred = [requestedModel, ...DEFAULT_MODEL_PRIORITY].filter(Boolean);

  // Use server-advertised model names when available.
  if (availableSet.size > 0) {
    return preferred.filter((name, idx, arr) => arr.indexOf(name) === idx && availableSet.has(name));
  }

  // Fallback to preferred static list when no catalog was supplied.
  return preferred.filter((name, idx, arr) => arr.indexOf(name) === idx);
};

// Flatten Gemini response into a single text block.
const extractGeminiText = (payload) => {
  const parts = payload?.candidates?.[0]?.content?.parts || [];
  return parts
    .map((part) => (typeof part?.text === 'string' ? part.text : ''))
    .join('\n')
    .trim();
};

// Call Gemini with mixed text and optional inline image parts.
export const sendGeminiChat = async ({
  apiKey,
  promptText,
  contextText,
  imageInlineData = null,
  modelName = 'gemini-2.5-flash-lite',
  availableModels = [],
}) => {
  if (!apiKey?.trim()) {
    throw new Error('Missing API key.');
  }

  const candidateModels = resolveCandidateModels(modelName, availableModels);
  if (candidateModels.length === 0) {
    throw new Error('No supported generateContent model is available for this API key.');
  }

  const systemInstruction =
    'You are ReconstructorAI. Use the provided floorplan context and image. ' +
    'If detection is requested, return strict JSON with normalized boxes [ymin,xmin,ymax,xmax] in 0-1000.';

  const parts = [
    {
      text: `${systemInstruction}\n\nContext:\n${contextText}\n\nUser request:\n${promptText}`,
    },
  ];

  // Add image input only when current floorplan image is available.
  if (imageInlineData?.mimeType && imageInlineData?.data) {
    parts.push({
      inline_data: {
        mime_type: imageInlineData.mimeType,
        data: imageInlineData.data,
      },
    });
  }

  let lastError = null;

  for (const candidateModel of candidateModels) {
    const url = buildGeminiUrl(apiKey, candidateModel);
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts }],
      }),
    });

    const payload = await response.json();
    if (response.ok) {
      const text = extractGeminiText(payload);
      if (!text) {
        throw new Error('LLM returned an empty response.');
      }
      return text;
    }

    const message = payload?.error?.message || `LLM request failed (${response.status})`;
    lastError = new Error(message);

    // Retry with next model for not found/rate-limit/quota style failures.
    const retryable =
      response.status === 404 ||
      response.status === 429 ||
      /quota|rate|limit|not found|unsupported|unavailable/i.test(message);
    if (!retryable) {
      throw lastError;
    }
  }

  throw lastError || new Error('All fallback models failed.');
};

// Parse common quota errors for cleaner UI feedback.
export const parseGeminiQuotaError = (message) => {
  const text = String(message || '');
  const isQuota = /quota exceeded|rate limit|too many requests|free_tier/i.test(text);
  if (!isQuota) return null;

  const secondsMatch = text.match(/retry in\s+([0-9.]+)s/i);
  const retrySeconds = secondsMatch ? Math.max(1, Math.round(Number(secondsMatch[1]))) : null;

  return {
    retrySeconds,
    userMessage: retrySeconds
      ? `Quota limit reached on current key. Please wait ~${retrySeconds}s and retry, or use another API key/project.`
      : 'Quota limit reached on current key. Use another API key/project or enable billing in Google AI Studio.',
  };
};

// Verify API key by checking Gemini model list endpoint.
export const verifyGeminiApiKey = async (apiKey) => {
  const key = String(apiKey || '').trim();
  if (!key) {
    return { ok: false, message: 'Please enter an API key first.' };
  }

  const encodedKey = encodeURIComponent(key);
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodedKey}`;

  try {
    const response = await fetch(url, { method: 'GET' });
    const payload = await response.json();
    if (!response.ok) {
      const msg = payload?.error?.message || `Verification failed (${response.status})`;
      return { ok: false, message: msg };
    }

    // Keep only models that support generateContent method.
    const modelNames = (payload?.models || [])
      .filter((model) => (model?.supportedGenerationMethods || []).includes('generateContent'))
      .map((model) => String(model?.name || '').replace(/^models\//, ''))
      .filter(Boolean);
    const modelCount = modelNames.length;
    return {
      ok: true,
      message: modelCount > 0 ? `Key verified (${modelCount} usable models visible).` : 'Key verified.',
      modelNames,
    };
  } catch (error) {
    return { ok: false, message: error?.message || 'Verification request failed.' };
  }
};
