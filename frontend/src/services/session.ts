/** Guest device token. localStorage so a returning guest skips identification. */
const KEY = 'nexus.guest.token';

export const guestToken = {
  get(): string | null {
    try {
      return localStorage.getItem(KEY);
    } catch {
      return null;
    }
  },
  set(token: string) {
    try {
      localStorage.setItem(KEY, token);
    } catch {
      /* private mode – session-only */
    }
  },
  clear() {
    try {
      localStorage.removeItem(KEY);
      sessionStorage.removeItem('nexus.chat');
    } catch {
      /* ignore */
    }
  },
};
