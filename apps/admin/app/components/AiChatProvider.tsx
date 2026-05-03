'use client';
import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import AiChatWidget, { type ApiErrorContext } from './AiChatWidget';

// ── context ───────────────────────────────────────────────────────────────────
interface AiChatContextValue {
  openChat: (ctx?: ApiErrorContext) => void;
  closeChat: () => void;
}

const AiChatContext = createContext<AiChatContextValue>({
  openChat: () => {},
  closeChat: () => {},
});

export function useAiChat() {
  return useContext(AiChatContext);
}

// ── provider ─────────────────────────────────────────────────────────────────
export default function AiChatProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [errorContext, setErrorContext] = useState<ApiErrorContext | null>(null);

  const openChat = useCallback((ctx?: ApiErrorContext) => {
    setErrorContext(ctx ?? null);
    setOpen(true);
  }, []);

  const closeChat = useCallback(() => {
    setOpen(false);
  }, []);

  return (
    <AiChatContext.Provider value={{ openChat, closeChat }}>
      {children}
      <AiChatWidget open={open} onClose={closeChat} errorContext={errorContext} />
      {/* Floating AI button — always visible when chat is closed */}
      {!open && <AiFloatingButton onClick={() => openChat()} />}
    </AiChatContext.Provider>
  );
}

// ── floating trigger button ───────────────────────────────────────────────────
function AiFloatingButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      className="ai-float-btn"
      onClick={onClick}
      title="Open AI Assistant"
      aria-label="Open AI Assistant"
      id="ai-float-trigger"
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path
          d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
          stroke="white"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className="ai-float-label">AI</span>
    </button>
  );
}
