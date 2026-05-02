"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence, useMotionValue, useTransform, type PanInfo } from "framer-motion";
import { X, Heart, Shield, ShieldAlert, ShieldOff, TrendingUp, TrendingDown, ChevronUp } from "lucide-react";
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
  const [open, setOpen] = useState(false);

  const tokens: {symbol:string}[] = (() => { try { return JSON.parse(whale.top_tokens); } catch { return []; } })();
  const cols = whale.is_honeypot ? ["#1a0000","#450a0a","#7f1d1d"] : GRADIENTS[whale.id % GRADIENTS.length];
  const accent = whale.is_honeypot ? "#ff6568" : "#818cf8";
  const emoji = whale.is_honeypot ? "🍯" : EMOJIS[whale.id % EMOJIS.length];

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

        {/* Avatar */}
        <div style={{ display:"flex", flexDirection:"column", alignItems:"center", paddingTop:36 }}>
          <div style={{
            width:96, height:96, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", fontSize:44,
            background: whale.is_honeypot ? "linear-gradient(135deg,#ef4444,#f97316)" : `hsl(${(whale.id*53)%360},50%,30%)`,
            boxShadow:`0 0 48px ${accent}55, 0 8px 24px rgba(0,0,0,0.5)`,
          }}>{emoji}</div>
          <p style={{ color:"#fff", fontSize:20, fontWeight:700, marginTop:12, letterSpacing:"-0.02em" }}>{whale.display_name}</p>
          <div style={{ marginTop:6 }}><Badge score={whale.risk_score} /></div>
        </div>

        {/* Bottom overlay */}
        <div style={{ position:"absolute", bottom:0, left:0, right:0, zIndex:20 }}>
          <div style={{ height:80, background:"linear-gradient(to bottom, transparent, rgba(0,0,0,0.88))", pointerEvents:"none" }} />
          <div style={{ background:"rgba(0,0,0,0.88)", padding:"0 14px 14px" }}>
            {/* Stats */}
            <div style={{ display:"flex", gap:8, marginBottom:10 }}>
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

            {/* Bio */}
            <button onClick={e=>{e.stopPropagation();setOpen(v=>!v);}} style={{
              width:"100%", background:"none", border:"none", cursor:"pointer", textAlign:"left", padding:0 }}>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:4 }}>
                <span style={{ color:"rgba(255,255,255,0.35)", fontSize:9, textTransform:"uppercase", letterSpacing:1 }}>About</span>
                <ChevronUp size={12} color="rgba(255,255,255,0.3)" style={{ transform: open?"rotate(180deg)":"rotate(0deg)", transition:"transform 0.2s" }} />
              </div>
              <AnimatePresence initial={false}>
                {open ? (
                  <motion.p key="full" initial={{height:0,opacity:0}} animate={{height:"auto",opacity:1}} exit={{height:0,opacity:0}}
                    style={{ color:"rgba(255,255,255,0.6)", fontSize:12, lineHeight:1.5, fontStyle:"italic", overflow:"hidden" }}>
                    &ldquo;{whale.ai_bio}&rdquo;
                  </motion.p>
                ) : (
                  <p style={{ color:"rgba(255,255,255,0.6)", fontSize:12, lineHeight:1.5, fontStyle:"italic",
                    overflow:"hidden", display:"-webkit-box", WebkitLineClamp:1, WebkitBoxOrient:"vertical" }}>
                    &ldquo;{whale.ai_bio}&rdquo;
                  </p>
                )}
              </AnimatePresence>
            </button>
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
