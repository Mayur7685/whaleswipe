"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence, useMotionValue, useTransform, type PanInfo } from "framer-motion";
import { X, Heart, Shield, ShieldAlert, ShieldOff, TrendingUp, TrendingDown } from "lucide-react";
import type { WhaleProfile } from "@/lib/api";
import { swipeWhale } from "@/lib/api";

interface Props { whales: WhaleProfile[]; onEmpty: () => void; onRug: (f: string[]) => void; }

const EMOJIS = ["🐳","🦈","🦅","🐂","🦁","🐉","🦊","🐺"];
const GRADIENTS = [
  ["#0d0221","#1a0533","#3b0764"],
  ["#020617","#0c1445","#1e3a5f"],
  ["#0a0a0a","#1a1a2e","#16213e"],
  ["#0f0c29","#302b63","#24243e"],
  ["#000428","#004e92","#000428"],
];

/** Build sparkline points from real net_worth_history or fall back to seeded fake */
function makeSparkline(whale: WhaleProfile, width = 120, height = 32): string {
  const history: {net_worth: number}[] = (() => {
    try { return JSON.parse(whale.net_worth_history || "[]"); } catch { return []; }
  })();

  // Use real data if we have at least 5 points
  const values = history.length >= 5
    ? history.map(h => h.net_worth).filter(v => v > 0)
    : (() => {
        // Seeded fake fallback
        const seed = whale.id * 137 + Math.floor(whale.win_rate * 100);
        const rand = (i: number) => Math.sin(seed * i * 9301 + 49297) * 0.5 + 0.5;
        const trend = whale.monthly_pnl_pct >= 0 ? 0.6 : 0.4;
        return Array.from({ length: 12 }, (_, i) => rand(i + 1) * 0.5 + trend * 0.5);
      })();

  if (values.length < 2) return "";
  const min = Math.min(...values), max = Math.max(...values);
  const norm = values.map(v => (v - min) / (max - min || 1));
  return norm.map((y, i) =>
    `${(i / (norm.length - 1)) * width},${height - y * height * 0.85 - height * 0.075}`
  ).join(" ");
}

function Badge({ score }: { score: number }) {
  const s = score < 30
    ? { bg: "rgba(5,223,114,0.15)", color: "#05df72", border: "rgba(5,223,114,0.35)", icon: <Shield size={9}/>, label: "SAFE" }
    : score < 60
    ? { bg: "rgba(252,187,0,0.15)", color: "#fcbb00", border: "rgba(252,187,0,0.35)", icon: <ShieldAlert size={9}/>, label: "RISKY" }
    : { bg: "rgba(255,101,104,0.15)", color: "#ff6568", border: "rgba(255,101,104,0.35)", icon: <ShieldOff size={9}/>, label: "🚨 HONEYPOT" };
  return (
    <span style={{ display:"inline-flex", alignItems:"center", gap:4, fontSize:10, fontWeight:700,
      padding:"3px 8px", borderRadius:99, background:s.bg, color:s.color, border:`1px solid ${s.border}` }}>
      {s.icon}{s.label}
    </span>
  );
}

function Card({ whale, onSwipe, isTop }: { whale: WhaleProfile; onSwipe:(d:"left"|"right",w:WhaleProfile)=>void; isTop:boolean }) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-220,220], [-16,16]);
  const likeOp = useTransform(x, [30,110], [0,1]);
  const nopeOp = useTransform(x, [-110,-30], [1,0]);
  const tokens: {symbol:string}[] = (() => { try { return JSON.parse(whale.top_tokens); } catch { return []; } })();
  const cols = whale.is_honeypot ? ["#1a0000","#450a0a","#7f1d1d"] : GRADIENTS[whale.id % GRADIENTS.length];
  const accent = whale.is_honeypot ? "#ff6568" : "#818cf8";
  const avatarUrl = whale.is_honeypot
    ? `https://api.dicebear.com/9.x/bottts/svg?seed=honeypot&backgroundColor=7f1d1d`
    : `https://api.dicebear.com/9.x/bottts/svg?seed=${whale.id}&backgroundColor=${cols[1].replace('#','')}`;
  const sparkPts = makeSparkline(whale);
  const sparkColor = whale.monthly_pnl_pct >= 0 ? "#05df72" : "#ff6568";

  return (
    <motion.div
      style={{ x, rotate, position:"absolute", inset:0, touchAction:"none", cursor: isTop ? "grab" : "default" }}
      drag={isTop ? "x" : false}
      dragConstraints={{ left:0, right:0 }}
      dragElastic={0.85}
      onDragEnd={(_,info:PanInfo) => {
        if (info.offset.x > 90) onSwipe("right", whale);
        else if (info.offset.x < -90) onSwipe("left", whale);
      }}
    >
      <div style={{
        width:"100%", height:"100%", borderRadius:20, overflow:"hidden", position:"relative",
        background:`linear-gradient(160deg, ${cols[0]} 0%, ${cols[1]} 50%, ${cols[2]} 100%)`,
        boxShadow:`0 20px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.06)`,
      }}>
        {/* Glow */}
        <div style={{ position:"absolute", top:0, left:0, right:0, height:"60%", pointerEvents:"none",
          background:`radial-gradient(ellipse 70% 50% at 50% 15%, ${accent}25 0%, transparent 70%)` }} />

        {/* LIKE */}
        <motion.div style={{ opacity:likeOp, position:"absolute", top:28, left:16, zIndex:30, pointerEvents:"none" }}>
          <div style={{ border:"3px solid #05df72", borderRadius:8, padding:"4px 12px", transform:"rotate(-12deg)" }}>
            <span style={{ color:"#05df72", fontSize:22, fontWeight:900, letterSpacing:3 }}>LIKE</span>
          </div>
        </motion.div>

        {/* NOPE */}
        <motion.div style={{ opacity:nopeOp, position:"absolute", top:28, right:16, zIndex:30, pointerEvents:"none" }}>
          <div style={{ border:"3px solid #ff6568", borderRadius:8, padding:"4px 12px", transform:"rotate(12deg)" }}>
            <span style={{ color:"#ff6568", fontSize:22, fontWeight:900, letterSpacing:3 }}>NOPE</span>
          </div>
        </motion.div>

        {/* Avatar — DiceBear — centered in upper 40% */}
        <div style={{ position:"absolute", top:0, left:0, right:0, bottom:"60%", display:"flex", alignItems:"center", justifyContent:"center" }}>
          <div style={{
            width:88, height:88, borderRadius:"50%", overflow:"hidden",
            background: whale.is_honeypot ? "linear-gradient(135deg,#ef4444,#f97316)" : `hsl(${(whale.id*53)%360},50%,25%)`,
            boxShadow:`0 0 48px ${accent}66, 0 8px 32px rgba(0,0,0,0.6)`,
          }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={avatarUrl} alt={whale.display_name} width={88} height={88} draggable={false}
              style={{ width:"100%", height:"100%", objectFit:"cover" }} />
          </div>
        </div>

        {/* Bottom overlay — covers bottom 60% */}
        <div style={{ position:"absolute", bottom:0, left:0, right:0, zIndex:20, top:"40%" }}>
          <div style={{ height:32, background:"linear-gradient(to bottom, transparent, rgba(0,0,0,0.93))", pointerEvents:"none" }} />
          <div style={{ background:"rgba(0,0,0,0.93)", padding:"0 12px 12px" }}>
            {/* Name + badge row */}
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:6 }}>
              <h2 style={{ color:"#fff", fontSize:17, fontWeight:700, letterSpacing:"-0.02em" }}>{whale.display_name}</h2>
              <Badge score={whale.risk_score} />
            </div>
            <div style={{ display:"flex", gap:6, marginBottom:5 }}>
              {[
                { label:"Win Rate", value:`${(whale.win_rate*100).toFixed(0)}%`, color:"#05df72" },
                { label:"30d PnL", value:`${whale.monthly_pnl_pct>=0?"+":""}${whale.monthly_pnl_pct.toFixed(0)}%`, color: whale.monthly_pnl_pct>=0?"#05df72":"#ff6568" },
                ...(tokens[0] ? [{ label:"Top Token", value:tokens[0].symbol, color:"#a4b3ff" }] : []),
              ].map((s,i) => (
                <div key={i} style={{ flex:1, borderRadius:10, padding:"8px 6px", textAlign:"center",
                  background:"rgba(255,255,255,0.07)", border:"1px solid rgba(255,255,255,0.1)" }}>
                  <p style={{ color:"rgba(255,255,255,0.4)", fontSize:9, textTransform:"uppercase", letterSpacing:1, marginBottom:3 }}>{s.label}</p>
                  <p style={{ color:s.color, fontSize:15, fontWeight:700 }}>{s.value}</p>
                </div>
              ))}
            </div>

            {/* Sparkline — 30d PnL trend */}
            <div style={{ marginBottom:5, borderRadius:8, overflow:"hidden", background:"rgba(255,255,255,0.05)", padding:"4px 6px" }}>
              <p style={{ color:"rgba(255,255,255,0.3)", fontSize:8, textTransform:"uppercase", letterSpacing:1, marginBottom:2 }}>30d trend</p>
              <svg width="100%" height="28" viewBox={`0 0 120 32`} preserveAspectRatio="none">
                <defs>
                  <linearGradient id={`sg${whale.id}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={sparkColor} stopOpacity="0.3"/>
                    <stop offset="100%" stopColor={sparkColor} stopOpacity="0"/>
                  </linearGradient>
                </defs>
                <polygon
                  points={`0,32 ${sparkPts} 120,32`}
                  fill={`url(#sg${whale.id})`}
                />
                <polyline points={sparkPts} fill="none" stroke={sparkColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>

            {/* Bio — always visible */}
            <div>
              <span style={{ color:"rgba(255,255,255,0.35)", fontSize:9, textTransform:"uppercase", letterSpacing:1 }}>About</span>
              <p style={{ color:"rgba(255,255,255,0.65)", fontSize:12, lineHeight:1.5, fontStyle:"italic", marginTop:3 }}>
                &ldquo;{whale.ai_bio}&rdquo;
              </p>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export default function SwipeCard({ whales, onEmpty, onRug }: Props) {
  const [stack, setStack] = useState<WhaleProfile[]>([...whales].reverse());
  const [exitDir, setExitDir] = useState<"left"|"right">("right");
  const [exiting, setExiting] = useState<number|null>(null);

  const handleSwipe = useCallback(async (dir:"left"|"right", whale:WhaleProfile) => {
    setExitDir(dir); setExiting(whale.id);
    try {
      await swipeWhale(whale.id, dir==="right"?"LIKE":"PASS");
      if (whale.is_honeypot && dir==="right") onRug(["Honeypot detected: sell transactions fail","This whale only trades rugs"]);
    } catch(e) { console.error(e); }
    setTimeout(() => {
      setStack(prev => { const n=prev.filter(w=>w.id!==whale.id); if(!n.length) onEmpty(); return n; });
      setExiting(null);
    }, 320);
  }, [onEmpty, onRug]);

  const top = stack[stack.length-1];

  return (
    <div style={{ flex:1, minHeight:0, display:"flex", flexDirection:"column" }}>
      {/* Card area */}
      <div style={{ flex:1, minHeight:0, position:"relative" }}>
        {/* Stack peek */}
        {stack.length > 1 && (
          <div style={{ position:"absolute", inset:0, borderRadius:20, transform:"scale(0.96) translateY(6px)",
            background:"linear-gradient(135deg,#0f0f1a,#1a1a2e)", border:"1px solid rgba(255,255,255,0.05)" }} />
        )}

        <AnimatePresence>
          {stack.map((whale,i) => {
            const isTop = i===stack.length-1;
            if (i < stack.length-2) return null;
            return (
              <motion.div key={whale.id} style={{ position:"absolute", inset:0, zIndex:isTop?10:5 }}
                animate={exiting===whale.id ? { x:exitDir==="right"?480:-480, rotate:exitDir==="right"?18:-18, opacity:0 } : {}}
                transition={{ duration:0.3, ease:[0.32,0,0.67,0] }}>
                <Card whale={whale} onSwipe={handleSwipe} isTop={isTop} />
              </motion.div>
            );
          })}
        </AnimatePresence>

        {stack.length===0 && (
          <div style={{ position:"absolute", inset:0, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:10 }}>
            <span style={{ fontSize:48 }}>🌊</span>
            <p style={{ color:"rgba(255,255,255,0.4)", fontSize:16, fontWeight:600 }}>No more whales</p>
            <p style={{ color:"rgba(255,255,255,0.2)", fontSize:13 }}>Check back tomorrow</p>
          </div>
        )}
      </div>

      {/* Buttons */}
      {top && (
        <div style={{ flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center", gap:24, paddingTop:14, paddingBottom:4 }}>
          <motion.button whileTap={{ scale:0.82 }} onClick={()=>handleSwipe("left",top)} style={{
            width:58, height:58, borderRadius:"50%", border:"2px solid rgba(255,101,104,0.45)",
            background:"rgba(255,101,104,0.1)", display:"flex", alignItems:"center", justifyContent:"center",
            cursor:"pointer", boxShadow:"0 4px 20px rgba(255,101,104,0.2)" }}>
            <X size={26} color="#ff6568" strokeWidth={2.5} />
          </motion.button>
          <motion.button whileTap={{ scale:0.82 }} onClick={()=>handleSwipe("right",top)} style={{
            width:58, height:58, borderRadius:"50%", border:"2px solid rgba(5,223,114,0.45)",
            background:"rgba(5,223,114,0.1)", display:"flex", alignItems:"center", justifyContent:"center",
            cursor:"pointer", boxShadow:"0 4px 20px rgba(5,223,114,0.2)" }}>
            <Heart size={26} color="#05df72" strokeWidth={2.5} />
          </motion.button>
        </div>
      )}
    </div>
  );
}
