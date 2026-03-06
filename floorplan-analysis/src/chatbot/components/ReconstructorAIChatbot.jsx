import React, { useEffect, useMemo, useRef, useState } from 'react';
import '../style/chatbot.css';
import { buildChatContext } from '../services/contextBuilder';
import { parseGeminiQuotaError, sendGeminiChat, verifyGeminiApiKey } from '../services/llmClient';
import { applyModelResponseTools, runLocalChatTool } from '../services/chatToolService';

const BOT_NAME = 'ReconstructorAI';

const ReconstructorAIChatbot = ({ onOpenChange, chatContext, visualizationTools }) => {
  // Toggle state for floating chat window.
  const [isOpen, setIsOpen] = useState(false);
  // User-provided API key input.
  const [apiKey, setApiKey] = useState('');
  // Last successfully submitted+verified key used for chat requests.
  const [submittedApiKey, setSubmittedApiKey] = useState('');
  // API key verification status text.
  const [apiKeyStatus, setApiKeyStatus] = useState('');
  // Usable model names tied to the submitted key.
  const [submittedModels, setSubmittedModels] = useState([]);
  // API key verification in-flight state.
  const [isVerifyingKey, setIsVerifyingKey] = useState(false);
  // Request status for send button/loading text.
  const [isSending, setIsSending] = useState(false);
  // Current text being typed.
  const [input, setInput] = useState('');
  // In-memory chat messages for the UI.
  const [messages, setMessages] = useState([
    {
      id: 1,
      role: 'bot',
      text: 'Hi! I am ReconstructorAI. Add your API key and ask me anything about your floorplan workflow.',
    },
  ]);
  // Scroll container ref for auto-scroll to newest chat.
  const messagesRef = useRef(null);

  useEffect(() => {
    // Notify parent so layout can avoid overlap with visualization.
    if (onOpenChange) {
      onOpenChange(isOpen);
    }
  }, [isOpen, onOpenChange]);

  useEffect(() => {
    // Always keep the latest chat message visible.
    if (!isOpen || !messagesRef.current) return;
    messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
  }, [messages, isOpen]);

  // Enable send button only when there is text.
  const canSend = useMemo(() => input.trim().length > 0, [input]);
  // User must submit/verify at least one key before LLM chat.
  const isApiKeyVerified = useMemo(() => Boolean(submittedApiKey.trim()), [submittedApiKey]);

  // Push a new chat message into local transcript.
  const pushMessage = (role, text) => {
    setMessages((prev) => [...prev, { id: Date.now() + Math.random(), role, text }]);
  };

  // Verify API key when user clicks submit button.
  const handleVerifyApiKey = async () => {
    if (!apiKey.trim()) {
      setApiKeyStatus('Please enter an API key first.');
      setSubmittedApiKey('');
      setSubmittedModels([]);
      return;
    }

    setIsVerifyingKey(true);
    setApiKeyStatus('Verifying key...');
    const result = await verifyGeminiApiKey(apiKey);
    if (result.ok) {
      const nextKey = apiKey.trim();
      setSubmittedApiKey(nextKey);
      setSubmittedModels(result.modelNames || []);
      setApiKeyStatus(`Submitted. ${result.message}`);
    } else {
      setSubmittedApiKey('');
      setSubmittedModels([]);
      setApiKeyStatus(`Verification failed: ${result.message}`);
    }
    setIsVerifyingKey(false);
  };

  const handleSend = async (event) => {
    event.preventDefault();
    const prompt = input.trim();
    if (!prompt) return;

    pushMessage('user', prompt);
    setInput('');

    // Fast local tools for direct commands like OCR overlay/clear.
    const localToolResponse = await runLocalChatTool({
      promptText: prompt,
      visualizationTools,
      chatContext,
    });
    if (localToolResponse) {
      pushMessage('bot', localToolResponse);
      return;
    }

    if (!apiKey.trim()) {
      pushMessage('bot', 'Please add your API key at the top first.');
      return;
    }

    if (!isApiKeyVerified) {
      pushMessage('bot', 'Please submit and verify the API key first.');
      return;
    }

    setIsSending(true);
    try {
      // Build multimodal context from current in-memory results.
      const contextPayload = await buildChatContext({
        ...(chatContext || {}),
        // Default to lighter context to fit free-tier token budgets.
        contextLevel: 'light',
      });
      const llmText = await sendGeminiChat({
        apiKey: submittedApiKey,
        promptText: prompt,
        contextText: contextPayload.contextText,
        imageInlineData: contextPayload.imageInlineData,
        modelName: 'gemini-2.5-flash-lite',
        availableModels: submittedModels,
      });

      // Apply draw tool automatically when model returns detection JSON.
      const toolResult = applyModelResponseTools(llmText, visualizationTools);
      const suffix = toolResult.applied
        ? `\n\n[${toolResult.detectionsCount} detection boxes drawn on visualization.]`
        : '';

      pushMessage('bot', `${llmText}${suffix}`);
    } catch (error) {
      const quota = parseGeminiQuotaError(error?.message);
      if (quota) {
        pushMessage(
          'bot',
          `${quota.userMessage}\nYou can still use local tools now: "draw ocr", "draw ocr \"text\"", "clear overlay".`
        );
      } else {
        pushMessage('bot', `Request failed: ${error.message}`);
      }
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="chatbot-root" aria-live="polite">
      {/* Floating AI icon button */}
      <button
        type="button"
        className="chatbot-fab"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        aria-controls="reconstructor-chat-window"
        aria-label={`${BOT_NAME} chat`}
      >
        <span className="chatbot-fab-icon" aria-hidden="true">
          AI
        </span>
      </button>

      {isOpen ? (
        <section id="reconstructor-chat-window" className="chatbot-window">
          {/* Chat header with bot name */}
          <header className="chatbot-header">
            <h4>{BOT_NAME}</h4>
            <button
              type="button"
              className="chatbot-close"
              onClick={() => setIsOpen(false)}
              aria-label="Close chat"
            >
              x
            </button>
          </header>

          {/* API key area requested for user-owned key */}
          <div className="chatbot-api-key">
            <label htmlFor="llm-api-key">API-KEY: Your LLM API KEY</label>
            <div className="chatbot-api-row">
              <input
                id="llm-api-key"
                type="password"
                value={apiKey}
                onChange={(event) => {
                  // Input edits do not change active key until Submit is clicked again.
                  setApiKey(event.target.value);
                  if (submittedApiKey && event.target.value.trim() !== submittedApiKey) {
                    setApiKeyStatus('New key typed. Click Submit to switch active key.');
                  }
                }}
                placeholder="Paste API key..."
                autoComplete="off"
              />
              <button
                type="button"
                className="chatbot-api-submit"
                onClick={handleVerifyApiKey}
                disabled={isVerifyingKey}
              >
                {isVerifyingKey ? 'Checking...' : 'Submit'}
              </button>
            </div>
            {apiKeyStatus ? (
              <p className={`chatbot-api-status ${isApiKeyVerified ? 'is-ok' : 'is-error'}`}>{apiKeyStatus}</p>
            ) : null}
            {isApiKeyVerified ? <p className="chatbot-api-status is-ok">Active key: submitted and verified.</p> : null}
          </div>

          {/* Chat history list */}
          <div ref={messagesRef} className="chatbot-messages">
            {messages.map((message) => (
              <p
                key={message.id}
                className={`chatbot-message ${message.role === 'user' ? 'is-user' : 'is-bot'}`}
              >
                {message.text}
              </p>
            ))}
          </div>

          {/* Message input row */}
          <form className="chatbot-input-wrap" onSubmit={handleSend}>
            <input
              type="text"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Type your message..."
            />
            <button type="submit" disabled={!canSend || isSending}>
              {isSending ? 'Thinking...' : 'Send'}
            </button>
          </form>
        </section>
      ) : null}
    </div>
  );
};

export default ReconstructorAIChatbot;
