import axios from "axios";
import { getInitData } from "./telegram";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const apiClient = axios.create({ baseURL: API_URL });

// Attach the Telegram initData to every outgoing request
apiClient.interceptors.request.use((config) => {
  const initData = getInitData();
  if (initData) {
    config.headers["X-Telegram-Init-Data"] = initData;
  }
  return config;
});

// ── Types ──────────────────────────────────────────────────────────────────

export interface WhaleProfile {
  id: number;
  display_name: string;
  win_rate: number;
  monthly_pnl_pct: number;
  ai_bio: string;
  top_tokens: string;
  risk_score: number;
  is_honeypot: boolean;
  net_worth_history: string; // JSON: [{net_worth: number}]
}

export interface PaperTrade {
  id: number;
  token_symbol: string;
  entry_price: number;
  current_price: number;
  amount_usd: number;
  unrealized_pnl: number;
  status: string;
  rug_flags: string; // JSON string: []
}

export interface Portfolio {
  paper_balance: number;
  total_unrealized_pnl: number;
  net_worth: number;
  active_trades: PaperTrade[];
}

// ── API Calls ──────────────────────────────────────────────────────────────

export const login = async () => {
  const res = await apiClient.post("/auth/login");
  return res.data;
};

export const getWhaleFeed = async (): Promise<WhaleProfile[]> => {
  const res = await apiClient.get("/whales/feed");
  return res.data;
};

export const swipeWhale = async (whaleId: number, action: "LIKE" | "PASS") => {
  const res = await apiClient.post(`/whales/${whaleId}/swipe?action=${action}`);
  return res.data;
};

export const getPortfolio = async (): Promise<Portfolio> => {
  const res = await apiClient.get("/portfolio/");
  return res.data;
};

export default apiClient;
