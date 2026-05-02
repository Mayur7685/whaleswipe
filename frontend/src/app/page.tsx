"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Layers, BarChart2 } from "lucide-react";
import { login, getWhaleFeed, type WhaleProfile } from "@/lib/api";
import dynamic from "next/dynamic";

const SwipeCard = dynamic(() => import("@/components/SwipeCard"), { ssr: false });
const Dashboard = dynamic(() => import("@/components/Dashboard"), { ssr: false });
const RugAlert = dynamic(() => import("@/components/RugAlert"), { ssr: false });

type Tab = "swipe" | "portfolio";

export default function Home() {
  const [tab, setTab] = useState<Tab>("swipe");
  const [whales, setWhales] = useState<WhaleProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [rugFlags, setRugFlags] = useState<string[] | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const loginRes = await login();
        setWhales(await getWhaleFeed());
        const userId = loginRes?.user_id;
        if (userId) {
          const es = new EventSource(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/events?user_id=${userId}`);
          es.onmessage = (e) => {
            try {
              const ev = JSON.parse(e.data);
              if (ev.type === "rug_rejection") setRugFlags(ev.flags);
            } catch {}
          };
          return () => es.close();
        }
      } catch (e) { console.error(e); setError(true); }
      finally { setLoading(false); }
    })();
  }, []);

  const handleRug = useCallback((flags: string[]) => setRugFlags(flags), []);
  const handleEmpty = useCallback(async () => {
    try { setWhales(await getWhaleFeed()); } catch {}
  }, []);

  return (
    // Outer: full screen, dark bg, centers the phone-width column
    <div style={{ minHeight: "100dvh", background: "#0a0a12", display: "flex", justifyContent: "center" }}>
      {/* Inner: phone-width column, full height */}
      <div style={{
        width: "100%", maxWidth: 430, display: "flex", flexDirection: "column",
        height: "100dvh", position: "relative",
      }}>

        {/* ── Header ── */}
        <div style={{ padding: "12px 16px 8px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 18, fontWeight: 800, color: "#fff", letterSpacing: "-0.02em" }}>
              Whale<span style={{ color: "#818cf8" }}>Swipe</span>
            </span>
            <span style={{ fontSize: 14 }}>🐳</span>
          </div>
          <div style={{
            padding: "4px 10px", borderRadius: 99, fontSize: 11, fontWeight: 600,
            background: "rgba(129,140,248,0.12)", color: "#818cf8", border: "1px solid rgba(129,140,248,0.25)"
          }}>
            $1,000 paper
          </div>
        </div>

        {/* ── Tab bar ── */}
        <div style={{
          margin: "0 12px 10px", borderRadius: 12, overflow: "hidden", flexShrink: 0,
          background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)",
          display: "flex",
        }}>
          {(["swipe", "portfolio"] as Tab[]).map((t) => {
            const active = tab === t;
            return (
              <button key={t} onClick={() => setTab(t)} style={{
                flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
                gap: 6, padding: "9px 0", fontSize: 12, fontWeight: 600, border: "none", cursor: "pointer",
                background: active ? "rgba(129,140,248,0.2)" : "transparent",
                color: active ? "#fff" : "rgba(255,255,255,0.35)",
                transition: "all 0.15s",
              }}>
                {t === "swipe"
                  ? <Layers size={13} color={active ? "#818cf8" : "rgba(255,255,255,0.35)"} />
                  : <BarChart2 size={13} color={active ? "#818cf8" : "rgba(255,255,255,0.35)"} />}
                {t === "swipe" ? "Discover" : "Portfolio"}
              </button>
            );
          })}
        </div>

        {/* ── Content — fills remaining height ── */}
        <div style={{ flex: 1, minHeight: 0, padding: "0 12px 12px", overflow: "hidden", display: "flex", flexDirection: "column" }}>
          {loading ? (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12 }}>
              <motion.div style={{ fontSize: 48 }}
                animate={{ y: [0, -10, 0] }} transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}>
                🐳
              </motion.div>
              <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 14 }}>Finding whales…</p>
            </div>
          ) : error ? (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, padding: "0 24px", textAlign: "center" }}>
              <span style={{ fontSize: 40 }}>⚠️</span>
              <p style={{ color: "rgba(255,255,255,0.7)", fontSize: 15, fontWeight: 600 }}>Backend offline</p>
              <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 13 }}>Start the backend server and refresh</p>
              <button onClick={() => window.location.reload()} style={{
                marginTop: 8, padding: "10px 24px", borderRadius: 99, border: "none", cursor: "pointer",
                background: "rgba(129,140,248,0.2)", color: "#818cf8", fontSize: 13, fontWeight: 600,
              }}>Retry</button>
            </div>
          ) : (
            <AnimatePresence mode="wait">
              {tab === "swipe" ? (
                <motion.div key="swipe" style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
                  <SwipeCard whales={whales} onEmpty={handleEmpty} onRug={handleRug} />
                </motion.div>
              ) : (
                <motion.div key="portfolio" style={{ flex: 1, overflowY: "auto" }}
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
                  <Dashboard />
                </motion.div>
              )}
            </AnimatePresence>
          )}
        </div>

        {rugFlags && <RugAlert flags={rugFlags} onDismiss={() => setRugFlags(null)} />}
      </div>
    </div>
  );
}
