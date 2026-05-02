// Telegram WebApp type declaration
declare global {
  interface Window {
    Telegram?: { WebApp?: { initData?: string } };
  }
}

export const getInitData = (): string => {
  if (typeof window !== "undefined" && window.Telegram?.WebApp?.initData) {
    return window.Telegram.WebApp.initData;
  }
  
  // For local desktop testing, we use a mock initData string that maps to the
  // logic in our backend auth.py's "dummy_test_data" fallback
  if (process.env.NODE_ENV === "development") {
    return "dummy_test_data";
  }
  
  return "";
};
