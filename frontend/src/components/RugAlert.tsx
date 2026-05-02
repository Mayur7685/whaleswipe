"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ShieldOff, X } from "lucide-react";

interface Props { flags: string[]; onDismiss: () => void; }

export default function RugAlert({ flags, onDismiss }: Props) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => { setVisible(false); setTimeout(onDismiss, 300); }, 6000);
    return () => clearTimeout(t);
  }, [onDismiss]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:20 }}
          transition={{ duration:0.25 }}
          style={{
            position:"fixed", bottom:80, left:12, right:12, zIndex:100, borderRadius:16, padding:14,
            background:"linear-gradient(135deg, #7f1d1d, #991b1b)",
            border:"1px solid rgba(239,68,68,0.4)",
            boxShadow:"0 16px 40px rgba(239,68,68,0.3)",
          }}>
          <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:10 }}>
            <div style={{ display:"flex", alignItems:"center", gap:10 }}>
              <div style={{ width:36, height:36, borderRadius:"50%", background:"rgba(239,68,68,0.25)",
                display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                <ShieldOff size={17} color="#fca5a5" />
              </div>
              <div>
                <p style={{ color:"#fff", fontWeight:700, fontSize:13 }}>🚨 Rug Intercepted!</p>
                <p style={{ color:"#fca5a5", fontSize:11, marginTop:2 }}>Trade blocked by WhaleSwipe Guard</p>
              </div>
            </div>
            <button onClick={()=>{setVisible(false);setTimeout(onDismiss,300);}}
              style={{ background:"none", border:"none", cursor:"pointer", padding:2 }}>
              <X size={15} color="#fca5a5" />
            </button>
          </div>
          {flags.length > 0 && (
            <div style={{ marginTop:10, display:"flex", flexDirection:"column", gap:5 }}>
              {flags.map((f,i) => (
                <div key={i} style={{ display:"flex", alignItems:"center", gap:6, fontSize:11, color:"#fca5a5" }}>
                  <span style={{ color:"#f87171" }}>▸</span>{f}
                </div>
              ))}
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
