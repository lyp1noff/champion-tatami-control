const channel = new BroadcastChannel("tatami");

export type TatamiMessage =
  | { type: "start"; timestamp: number; pausedElapsed: number }
  | { type: "pause"; pausedElapsed: number }
  | { type: "stop" }
  | { type: "sync"; full: any }; // optional for future

export const sendTatamiMessage = (msg: TatamiMessage) => {
  channel.postMessage(msg);
};

export const onTatamiMessage = (handler: (msg: TatamiMessage) => void) => {
  channel.onmessage = (e) => handler(e.data);
};

export const closeTatamiBus = () => channel.close();
