// BroadcastChannel for same-origin communication
let channel: BroadcastChannel | null = null;
let ws: WebSocket | null = null;
let messageHandlers: ((msg: any) => void)[] = [];

// Try to initialize BroadcastChannel
try {
  channel = new BroadcastChannel("tatami");
} catch (error) {
  console.warn("BroadcastChannel not supported, falling back to WebSocket");
}

export type TatamiMessage =
  | { type: "start"; timestamp: number; pausedElapsed: number }
  | { type: "pause"; pausedElapsed: number }
  | { type: "stop" }
  | { type: "score"; fighter: 1 | 2; score: number }
  | { type: "shido"; fighter: 1 | 2; shido: number }
  | { type: "sync"; state: any };

export const sendTatamiMessage = (msg: TatamiMessage) => {
  if (channel) {
    channel.postMessage(msg);
  } else if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }

  // Also notify local handlers
  messageHandlers.forEach((handler) => handler(msg));
};

export const onTatamiMessage = (handler: (msg: TatamiMessage) => void) => {
  messageHandlers.push(handler);

  if (channel) {
    channel.onmessage = (e) => handler(e.data);
  }

  return () => {
    messageHandlers = messageHandlers.filter((h) => h !== handler);
  };
};

export const initializeWebSocket = (url: string = "ws://localhost:3001") => {
  if (channel) return; // BroadcastChannel is preferred

  try {
    ws = new WebSocket(url);
    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      messageHandlers.forEach((handler) => handler(msg));
    };
    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
    };
    ws.onclose = () => {
      console.log("WebSocket connection closed");
    };
  } catch (error) {
    console.error("Failed to initialize WebSocket:", error);
  }
};

export const closeTatamiBus = () => {
  if (channel) {
    channel.close();
    channel = null;
  }
  if (ws) {
    ws.close();
    ws = null;
  }
  messageHandlers = [];
};
