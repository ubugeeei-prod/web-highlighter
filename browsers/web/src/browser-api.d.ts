interface WebHighlighterStorageArea {
  get(keys?: string | string[] | Record<string, unknown>): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
}

interface WebHighlighterBrowserApi {
  runtime: {
    getURL(path: string): string;
    sendMessage(message: unknown): Promise<unknown>;
    onMessage: {
      addListener(
        listener: (
          message: unknown,
          sender: unknown,
          respond: (response: unknown) => void,
        ) => boolean,
      ): void;
    };
  };
  storage?: {
    sync?: WebHighlighterStorageArea;
    onChanged?: {
      addListener(listener: (changes: Record<string, { newValue?: unknown }>) => void): void;
    };
  };
  tabs?: {
    query(query: {
      active: boolean;
      currentWindow: boolean;
    }): Promise<Array<{ id?: number; url?: string }>>;
  };
  permissions?: {
    request(permissions: { origins: string[] }): Promise<boolean>;
  };
  scripting?: {
    executeScript(options: { target: { tabId: number }; files: string[] }): Promise<unknown>;
    insertCSS(options: { target: { tabId: number }; files: string[] }): Promise<unknown>;
  };
}

declare const chrome: WebHighlighterBrowserApi;
declare const browser: WebHighlighterBrowserApi | undefined;
