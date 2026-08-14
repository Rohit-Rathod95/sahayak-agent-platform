import { useState, useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from "react";

const WS_URL = "wss://hpi2q1af23.execute-api.us-east-1.amazonaws.com/dev/";

const AGENT_META = {
  faq: { label: "Knowledge Specialist", cls: "agent-faq" },
  booking: { label: "Travel Ops Specialist", cls: "agent-booking" },
  escalation: { label: "Resolution Manager", cls: "agent-escalation" },
};

function detectAgent(data) {
  if (data.caseId) return "escalation";
  if (data.needsEscalation) return "escalation";
  if (/booking|flight|hotel|room|itinerary/i.test(data.response || "")) return "booking";
  return "faq";
}

function Bubble({ msg }) {
  if (msg.role === "user") {
    return (
      <div className="row row-user">
        <div className="bubble bubble-user">{msg.text}</div>
      </div>
    );
  }
  const meta = AGENT_META[msg.agent] || AGENT_META.faq;
  return (
    <div className="row row-bot">
      <div className="bot-stack">
        <span className={`agent-tag ${meta.cls}`}>{meta.label}</span>
        <div className="bubble bubble-bot">
          {msg.text}
          {msg.escalated && (
            <div className="escalated-flag">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 9v4M12 17h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
              </svg>
              Escalated to human support
              {msg.caseId ? <span className="case-id">{msg.caseId}</span> : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TypingIndicator({ label }) {
  return (
    <div className="row row-bot">
      <div className="bot-stack">
        <span className="agent-tag agent-thinking">{label}</span>
        <div className="bubble bubble-bot bubble-typing">
          <span className="dot" />
          <span className="dot" />
          <span className="dot" />
        </div>
      </div>
    </div>
  );
}

const SUGGESTIONS = [
  "What's the baggage allowance for economy?",
  "Find me a hotel in Goa",
  "My payment was deducted but no confirmation arrived",
];

const ChatWidget = forwardRef(function ChatWidget(props, ref) {
  const [isOpen, setIsOpen] = useState(false);
  const [hasOpened, setHasOpened] = useState(false);
  const [showBadge, setShowBadge] = useState(true);

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [status, setStatus] = useState("connecting");
  const [pending, setPending] = useState(false);
  const wsRef = useRef(null);
  const scrollRef = useRef(null);
  const reconnectTimer = useRef(null);
  const queuedMsgRef = useRef(null);

  const connect = useCallback((isCurrentRef) => {
    if (!isCurrentRef()) return null;

    setStatus("connecting");
    const ws = new WebSocket(WS_URL);

    if (isCurrentRef()) {
      wsRef.current = ws;
    }

    ws.onopen = () => {
      if (!isCurrentRef()) return;
      wsRef.current = ws;
      setStatus("connected");

      if (queuedMsgRef.current) {
        const queuedText = queuedMsgRef.current;
        queuedMsgRef.current = null;
        setMessages((prev) => [...prev, { role: "user", text: queuedText }]);
        ws.send(JSON.stringify({ action: "default", message: queuedText }));
        setPending(true);
      }
    };
    ws.onclose = () => {
      if (!isCurrentRef()) return;
      setStatus("disconnected");
      reconnectTimer.current = setTimeout(() => {
        if (isCurrentRef()) {
          connect(isCurrentRef);
        }
      }, 3000);
    };
    ws.onerror = () => {
      if (!isCurrentRef()) return;
      setStatus("disconnected");
    };

    ws.onmessage = (event) => {
      if (!isCurrentRef()) return;

      let data;
      try {
        data = JSON.parse(event.data);
      } catch {
        data = { response: String(event.data) };
      }
      setPending(false);
      setMessages((prev) => [
        ...prev,
        {
          role: "bot",
          text: data.response || "Sorry, something went wrong.",
          agent: detectAgent(data),
          escalated: Boolean(data.needsEscalation || data.caseId),
          caseId: data.caseId,
        },
      ]);
    };

    return ws;
  }, []);

  // Lazy connection: Only trigger connection once the user clicks to open for the first time
  useEffect(() => {
    if (!hasOpened) return;

    let isCurrent = true;
    const isCurrentRef = () => isCurrent;
    const ws = connect(isCurrentRef);

    return () => {
      isCurrent = false;
      clearTimeout(reconnectTimer.current);

      if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
        ws.close();
      }

      if (wsRef.current === ws) {
        wsRef.current = null;
      }
    };
  }, [connect, hasOpened]);

  useEffect(() => {
    if (isOpen) {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    }
  }, [messages, pending, isOpen]);

  const send = (text) => {
    const trimmed = text.trim();
    if (!trimmed || status !== "connected") return;
    setMessages((prev) => [...prev, { role: "user", text: trimmed }]);
    wsRef.current.send(JSON.stringify({ action: "default", message: trimmed }));
    setInput("");
    setPending(true);
  };

  useImperativeHandle(
    ref,
    () => ({
      openAndSend(text) {
        const trimmed = text?.trim();
        if (!hasOpened) {
          setHasOpened(true);
          setShowBadge(false);
        }
        setIsOpen(true);

        if (!trimmed) return;

        if (status === "connected" && wsRef.current?.readyState === WebSocket.OPEN) {
          setMessages((prev) => [...prev, { role: "user", text: trimmed }]);
          wsRef.current.send(JSON.stringify({ action: "default", message: trimmed }));
          setInput("");
          setPending(true);
        } else {
          queuedMsgRef.current = trimmed;
        }
      },
    }),
    [hasOpened, status]
  );

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  };

  const toggleWidget = () => {
    if (!hasOpened) {
      setHasOpened(true);
      setShowBadge(false);
    }
    setIsOpen(!isOpen);
  };

  const statusLabel = { connected: "Connected", connecting: "Connecting…", disconnected: "Reconnecting…" }[status];

  return (
    <div className="chat-widget-container">
      {/* Floating Action Button */}
      {!isOpen && (
        <button className="chat-trigger-btn" onClick={toggleWidget} aria-label="Open support chat">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          {showBadge && <span className="chat-badge">1</span>}
        </button>
      )}

      {/* Chat Popup Panel */}
      {isOpen && (
        <div className="chat-popup-panel">
          <header className="header">
            <div className="header-top">
              <div className="brand">
                <span className="brand-mark">सह</span>
                <div>
                  <h1>Sahayak</h1>
                  <p>Travel support</p>
                </div>
              </div>
              <div className="header-controls">
                <div className={`status status-${status}`}>
                  <span className="status-dot" />
                  {statusLabel}
                </div>
                <button className="close-btn" onClick={() => setIsOpen(false)} aria-label="Close chat">
                  &times;
                </button>
              </div>
            </div>
            <div className="route-line" aria-hidden="true">
              <span className="route-dot" />
              <span className="route-path" />
              <span className="route-plane">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M22 12 3 4l2.5 7L3 20l19-8Z" />
                </svg>
              </span>
              <span className="route-path" />
              <span className="route-dot" />
            </div>
          </header>

          <main className="thread" ref={scrollRef}>
            {messages.length === 0 && (
              <div className="empty">
                <p className="empty-title">Where can I help you today?</p>
                <div className="suggestions">
                  {SUGGESTIONS.map((s) => (
                    <button key={s} className="suggestion" onClick={() => send(s)}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((m, i) => (
              <Bubble key={i} msg={m} />
            ))}
            {pending && <TypingIndicator label="Routing your request" />}
          </main>

          <form
            className="composer"
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
          >
            <textarea
              rows={1}
              placeholder="Ask about bookings, policies, or anything else"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            <button type="submit" disabled={!input.trim() || status !== "connected"} aria-label="Send message">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 2 11 13M22 2 15 22l-4-9-9-4 20-7Z" />
              </svg>
            </button>
          </form>
        </div>
      )}
    </div>
  );
});

export default ChatWidget;
