declare global {
  interface Window {
    Telegram?: { WebApp?: { initData?: string } };
  }
}

export const getInitData = (): string => {
  if (typeof window !== "undefined" && window.Telegram?.WebApp?.initData) {
    return window.Telegram.WebApp.initData;
  }
  // Outside Telegram (browser preview, PWA, judge desktop) — use dev bypass
  return "dummy_test_data";
};
