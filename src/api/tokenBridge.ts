let authToken: string | null = null;
let onUnauthorized: (() => Promise<void> | void) | null = null;

export const tokenBridge = {
  get() {
    return authToken;
  },
  set(token: string | null) {
    authToken = token;
  },
  setUnauthorizedHandler(handler: (() => Promise<void> | void) | null) {
    onUnauthorized = handler;
  },
  async notifyUnauthorized() {
    await onUnauthorized?.();
  },
};
