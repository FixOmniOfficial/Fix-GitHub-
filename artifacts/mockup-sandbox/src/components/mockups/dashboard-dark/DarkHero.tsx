export function DarkHero() {
  const services = [
    { emoji: "❄️", label: "AC Service", count: 8, unit: "jobs today",  action: "OPEN" },
    { emoji: "🔧", label: "Repair",     count: 5, unit: "pending",      action: "OPEN" },
    { emoji: "📦", label: "Install",    count: 3, unit: "scheduled",    action: "OPEN" },
    { emoji: "💡", label: "Electrician",count: 2, unit: "in progress",  action: "OPEN" },
    { emoji: "🎨", label: "Painter",    count: 1, unit: "new request",  action: "OPEN" },
  ];

  const stats = [
    { label: "आज के Jobs", value: "19" },
    { label: "कुल ग्राहक",  value: "148" },
    { label: "आज Revenue", value: "₹6,400" },
  ];

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
      <div style={{ padding: "0 20px", marginTop: -48 }}>
        {/* Snowflake floating over the hero bottom */}
        <div style={{
          fontSize: 64, lineHeight: 1, marginBottom: 12,
          filter: "drop-shadow(0 4px 12px rgba(100,180,255,0.6))"
        }}>❄️</div>

        <h1 style={{
          fontSize: 32, fontWeight: 800, letterSpacing: "-0.5px",
          margin: "0 0 4px", lineHeight: 1.15, color: "#fff"
        }}>Service Centre</h1>
        <p style={{ fontSize: 13, color: "#888", margin: "0 0 18px" }}>
          आपकी कार्यशाला का अवलोकन
        </p>

        {/* Quick stats row */}
        <div style={{ display: "flex", gap: 10, marginBottom: 22 }}>
          {stats.map((s) => (
            <div key={s.label} style={{
              flex: 1, background: "#1a1a1a", borderRadius: 12,
              padding: "10px 8px", textAlign: "center", border: "1px solid #2a2a2a"
            }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#fff" }}>{s.value}</div>
              <div style={{ fontSize: 10, color: "#888", marginTop: 2 }}>{s.label}</div>
            </div>
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

      {/* ── Bottom new job button ── */}
      <div style={{ padding: "20px 20px 32px" }}>
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
        }}>
          + नया कार्य जोड़ें
        </button>
      </div>
    </div>
  );
}
