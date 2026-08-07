import { motion, useSpring, useTransform, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";

function AnimatedNumber({ value, prefix = "", suffix = "" }: { value: number, prefix?: string, suffix?: string }) {
  const spring = useSpring(0, { mass: 1, stiffness: 60, damping: 20 });

  useEffect(() => {
    spring.set(value);
  }, [value, spring]);

  const display = useTransform(spring, (current) => {
    return `${prefix}${Math.round(current).toLocaleString("en-IN")}${suffix}`;
  });

  return <motion.span>{display}</motion.span>;
}

export function DarkHeroLiveFeed() {
  const services = [
    { emoji: "❄️", label: "AC Service", count: 8, unit: "jobs today", action: "OPEN" },
    { emoji: "🔧", label: "Repair", count: 5, unit: "pending", action: "OPEN" },
    { emoji: "📦", label: "Install", count: 3, unit: "scheduled", action: "OPEN" },
    { emoji: "💡", label: "Electrician", count: 2, unit: "in progress", action: "OPEN" },
    { emoji: "🎨", label: "Painter", count: 1, unit: "new request", action: "OPEN" },
  ];

  const stats = [
    { label: "आज के Jobs", value: 19 },
    { label: "कुल ग्राहक", value: 148 },
    { label: "आज Revenue", value: 6400, prefix: "₹" },
  ];

  // We'll simulate new items coming into the live feed
  const initialActivities = [
    { id: 2, text: "Suresh completed Repair job #492", time: "5 mins ago", type: "complete", emoji: "✅" },
    { id: 3, text: "Payment of ₹1,200 received from Anil", time: "12 mins ago", type: "payment", emoji: "💳" },
    { id: 4, text: "Electrician assigned to Ramesh", time: "28 mins ago", type: "assign", emoji: "💡" },
  ];

  const [activities, setActivities] = useState(initialActivities);

  useEffect(() => {
    // Add a new activity after 2 seconds to show the animation
    const timer = setTimeout(() => {
      setActivities((prev) => [
        { id: 1, text: "New AC Service requested by Rahul", time: "Just now", type: "new", emoji: "❄️" },
        ...prev
      ]);
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div
      style={{ background: "#0d0d0d", minHeight: "100vh", fontFamily: "'Inter', sans-serif", color: "#fff", overflowX: "hidden" }}
    >
      {/* ── Hero image ── */}
      <div style={{ position: "relative", width: "100%", height: 260, overflow: "hidden" }}>
        <img
          src="/__mockup/images/sc-hero.jpg"
          alt="Service Centre"
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
        {/* bottom fade to dark */}
        <div style={{
          position: "absolute", bottom: 0, left: 0, right: 0, height: 120,
          background: "linear-gradient(to bottom, transparent, #0d0d0d)"
        }} />
        {/* top dark scrim */}
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, height: 60,
          background: "linear-gradient(to bottom, rgba(0,0,0,0.45), transparent)"
        }} />
      </div>

      {/* ── Icon + Title ── */}
      <div style={{ padding: "0 20px", marginTop: -48, position: "relative", zIndex: 10 }}>
        {/* Snowflake floating over the hero bottom */}
        <motion.div 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: "spring", stiffness: 100, damping: 20 }}
          style={{
            fontSize: 64, lineHeight: 1, marginBottom: 12,
            filter: "drop-shadow(0 4px 12px rgba(100,180,255,0.6))"
          }}
        >
          ❄️
        </motion.div>

        <h1 style={{
          fontSize: 32, fontWeight: 800, letterSpacing: "-0.5px",
          margin: "0 0 4px", lineHeight: 1.15, color: "#fff"
        }}>Service Centre</h1>
        <p style={{ fontSize: 13, color: "#888", margin: "0 0 18px" }}>
          आपकी कार्यशाला का अवलोकन
        </p>

        {/* Quick stats row with animated counters */}
        <div style={{ display: "flex", gap: 10, marginBottom: 22 }}>
          {stats.map((s, idx) => (
            <motion.div 
              key={s.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 * idx, duration: 0.4 }}
              style={{
                flex: 1, background: "#1a1a1a", borderRadius: 12,
                padding: "10px 8px", textAlign: "center", border: "1px solid #2a2a2a"
              }}
            >
              <div style={{ fontSize: 16, fontWeight: 700, color: "#fff" }}>
                <AnimatedNumber value={s.value} prefix={s.prefix} />
              </div>
              <div style={{ fontSize: 10, color: "#888", marginTop: 2 }}>{s.label}</div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* ── Service rows ── */}
      <div style={{ padding: "0 0" }}>
        {services.map((svc, i) => (
          <div
            key={svc.label}
            style={{
              display: "flex", alignItems: "center",
              padding: "14px 20px",
              borderTop: i === 0 ? "1px solid #222" : undefined,
              borderBottom: "1px solid #222",
              background: "#0d0d0d",
            }}
          >
            {/* Emoji */}
            <span style={{ fontSize: 26, marginRight: 14, lineHeight: 1 }}>{svc.emoji}</span>

            {/* Label + sub */}
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 17, fontWeight: 600, color: "#fff", letterSpacing: "-0.2px" }}>
                {svc.label}
              </div>
              <div style={{ fontSize: 12, color: "#666", marginTop: 2 }}>
                {svc.count} {svc.unit}
              </div>
            </div>

            {/* OPEN button */}
            <button style={{
              background: "#1e1e1e",
              border: "1px solid #333",
              borderRadius: 8,
              color: "#ccc",
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: 0.8,
              padding: "7px 14px",
              cursor: "pointer",
              lineHeight: 1,
            }}>
              OPEN
            </button>
          </div>
        ))}
      </div>

      {/* ── Live Job Activity Feed ── */}
      <div style={{ padding: "28px 20px 10px" }}>
        <div style={{ display: "flex", alignItems: "center", marginBottom: 16, gap: 8 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "#fff", margin: 0, letterSpacing: "-0.2px" }}>
            Live Job Activity
          </h2>
          {/* Pulsing indicator */}
          <motion.div 
            animate={{ opacity: [1, 0.4, 1] }}
            transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
            style={{ width: 8, height: 8, borderRadius: "50%", background: "#10b981", boxShadow: "0 0 8px #10b981" }}
          />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <AnimatePresence initial={false}>
            {activities.map((act) => (
              <motion.div
                key={act.id}
                initial={{ opacity: 0, height: 0, marginBottom: 0, scale: 0.95 }}
                animate={{ opacity: 1, height: "auto", marginBottom: 0, scale: 1 }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 25 }}
                style={{ overflow: "hidden" }}
              >
                <div style={{ 
                  background: "linear-gradient(to right, #141414, #1a1a1a)",
                  border: "1px solid #222", 
                  borderLeft: act.type === 'new' ? "2px solid #3b82f6" : act.type === 'complete' ? "2px solid #10b981" : "2px solid #222",
                  borderRadius: "0 10px 10px 0",
                  padding: "12px 14px",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 12
                }}>
                  <div style={{ fontSize: 18, marginTop: 2, lineHeight: 1 }}>{act.emoji}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, color: "#e5e5e5", lineHeight: 1.4, fontWeight: 500 }}>
                      {act.text}
                    </div>
                    <div style={{ fontSize: 11, color: "#777", marginTop: 4 }}>
                      {act.time}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>

      {/* ── Bottom new job button ── */}
      <div style={{ padding: "24px 20px 40px" }}>
        <button style={{
          width: "100%",
          background: "linear-gradient(135deg, #f59e0b, #ea580c)",
          border: "none",
          borderRadius: 14,
          color: "#fff",
          fontSize: 16,
          fontWeight: 700,
          padding: "15px 0",
          cursor: "pointer",
          letterSpacing: 0.3,
          boxShadow: "0 4px 14px rgba(234, 88, 12, 0.4)",
          transition: "transform 0.1s"
        }}>
          + नया कार्य जोड़ें
        </button>
      </div>
    </div>
  );
}
