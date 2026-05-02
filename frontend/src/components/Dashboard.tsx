"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, RefreshCw, Activity } from "lucide-react";
import { getPortfolio, type Portfolio } from "@/lib/api";

export default function Dashboard() {
  const [data, setData] = useState<Portfolio | null>(null);
  const [loading, setLoading] = useState(true);
  const [spin, setSpin] = useState(false);

  const load = async (silent = false) => {
    if (!silent) setLoading(true); else setSpin(true);
    try { setData(await getPortfolio()); } catch {}
    finally { setLoading(false); setSpin(false); }
  };

  useEffect(() => { load(); const id = setInterval(()=>load(true), 30000); return ()=>clearInterval(id); }, []);

  if (loading) return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:160 }}>
      <motion.div animate={{ rotate:360 }} transition={{ duration:0.7, repeat:Infinity, ease:"linear" }}>
        <RefreshCw size={20} color="#818cf8" />
      </motion.div>
    </div>
  );

  const pnl = data?.total_unrealized_pnl ?? 0;
  const net = data?.net_worth ?? 1000;
  const bal = data?.paper_balance ?? 1000;
  const trades = data?.active_trades ?? [];
  const up = pnl >= 0;

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:12, paddingBottom:16 }}>

      {/* Hero card */}
      <div style={{
        borderRadius:20, padding:"16px 18px", position:"relative", overflow:"hidden",
        background:"linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)",
        border:"1px solid rgba(129,140,248,0.2)",
        boxShadow:"0 8px 32px rgba(99,102,241,0.2)",
      }}>
        <div style={{ position:"absolute", top:-24, right:-24, width:120, height:120, borderRadius:"50%",
          background:"rgba(129,140,248,0.15)", filter:"blur(24px)", pointerEvents:"none" }} />
        <div style={{ position:"relative" }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
            <span style={{ color:"#a4b3ff", fontSize:12 }}>Paper Portfolio</span>
            <button onClick={()=>load(true)} style={{ background:"none", border:"none", cursor:"pointer" }}>
              <motion.div animate={spin?{rotate:360}:{}} transition={{ duration:0.6, repeat:spin?Infinity:0, ease:"linear" }}>
                <RefreshCw size={13} color="rgba(164,179,255,0.5)" />
              </motion.div>
            </button>
          </div>
          <p style={{ color:"#fff", fontSize:32, fontWeight:700, letterSpacing:"-0.02em" }}>${net.toFixed(2)}</p>
          <div style={{ display:"flex", alignItems:"center", gap:5, marginTop:4, color:up?"#05df72":"#ff6568", fontSize:13, fontWeight:600 }}>
            {up ? <TrendingUp size={14}/> : <TrendingDown size={14}/>}
            {up?"+":""}{pnl.toFixed(2)} unrealized
          </div>
          <p style={{ color:"rgba(164,179,255,0.4)", fontSize:11, marginTop:10 }}>
            Cash: ${bal.toFixed(2)} · {trades.length} open position{trades.length!==1?"s":""}
          </p>
        </div>
      </div>

      {/* Trades label */}
      <p style={{ color:"rgba(255,255,255,0.25)", fontSize:10, fontWeight:700, textTransform:"uppercase", letterSpacing:2, paddingLeft:4 }}>
        Open Trades
      </p>

      {trades.length === 0 ? (
        <div style={{ borderRadius:16, padding:"28px 16px", textAlign:"center",
          background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.06)" }}>
          <p style={{ fontSize:32, marginBottom:8 }}>🌊</p>
          <p style={{ color:"rgba(255,255,255,0.25)", fontSize:13 }}>No trades yet — swipe right on a whale</p>
        </div>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          {trades.map((t, i) => {
            const flags: string[] = (() => { try { return JSON.parse(t.rug_flags||"[]"); } catch { return []; } })();
            const pct = ((t.current_price - t.entry_price) / t.entry_price) * 100;
            const pos = t.unrealized_pnl >= 0;
            return (
              <motion.div key={t.id} initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }} transition={{ delay:i*0.04 }}
                style={{ borderRadius:14, padding:"12px 14px", display:"flex", alignItems:"center", justifyContent:"space-between",
                  background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.07)" }}>
                <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                  <div style={{ width:34, height:34, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center",
                    background:pos?"rgba(5,223,114,0.12)":"rgba(255,101,104,0.12)" }}>
                    <Activity size={14} color={pos?"#05df72":"#ff6568"} />
                  </div>
                  <div>
                    <p style={{ color:"#fff", fontWeight:600, fontSize:14 }}>{t.token_symbol}</p>
                    <p style={{ color:"rgba(255,255,255,0.3)", fontSize:11 }}>${t.amount_usd.toFixed(0)} invested</p>
                    {flags[0] && <p style={{ color:"#fcbb00", fontSize:10, marginTop:2 }}>⚠️ {flags[0]}</p>}
                  </div>
                </div>
                <div style={{ textAlign:"right" }}>
                  <p style={{ color:pos?"#05df72":"#ff6568", fontWeight:700, fontSize:15 }}>
                    {pos?"+":""}{t.unrealized_pnl.toFixed(2)}
                  </p>
                  <p style={{ color:pos?"rgba(5,223,114,0.5)":"rgba(255,101,104,0.5)", fontSize:11 }}>
                    {pct>=0?"+":""}{pct.toFixed(1)}%
                  </p>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
