import { ipcRenderer } from 'electron';

declare global {
  interface Window {
    ipcRenderer: {
      on: typeof ipcRenderer.on;
      off: typeof ipcRenderer.off;
      send: typeof ipcRenderer.send;
      invoke: typeof ipcRenderer.invoke;
      toggleDevMode: (isEnabled: boolean) => void;
    };
    bumpChatId?: string | null;
    _gemideskSwitcherEvaluatingMenu?: boolean;
  }
}
