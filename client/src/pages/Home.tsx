import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";

const LOGO_URL = "https://d2xsxph8kpxj0f.cloudfront.net/310519663412862458/aeHAj7eMfNRRx2t46XKsZJ/sourcy-logo_a422d021.png";

// ── Nav ────────────────────────────────────────────────────────────────────────
function Navbar({ isAuthenticated }: { isAuthenticated: boolean }) {
  const [scrolled, setScrolled] = useState(false);
  const [, setLocation] = useLocation();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
      style={{
        background: scrolled ? "rgba(2,6,23,0.92)" : "transparent",
        backdropFilter: scrolled ? "blur(16px)" : "none",
        borderBottom: scrolled ? "1px solid rgba(255,255,255,0.06)" : "none",
      }}
    >
      <div className="max-w-7xl mx-auto px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Logo */}
        <a href="/" className="flex items-center gap-3 group">
          <img src={LOGO_URL} alt="Sourcy" className="h-8 w-8 object-contain" />
          <div className="flex flex-col leading-none">
            <span className="text-white font-semibold text-base" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              Elevations
            </span>
            <span className="text-xs font-medium" style={{ color: "#17eeb4", fontFamily: "'Inter', sans-serif" }}>
              by Sourcy
            </span>
          </div>
        </a>

        {/* Nav links */}
        <div className="hidden md:flex items-center gap-8">
          {["Features", "Compliance", "Pricing", "How It Works"].map((item) => (
            <a
              key={item}
              href={`#${item.toLowerCase().replace(/\s+/g, "-")}`}
              className="text-sm text-slate-400 hover:text-white transition-colors"
            >
              {item}
            </a>
          ))}
        </div>

        {/* CTA */}
        <div className="flex items-center gap-3">
          {isAuthenticated ? (
            <button
              onClick={() => setLocation("/dashboard")}
              className="px-4 py-2 rounded-lg text-sm font-medium text-[#020617] transition-all hover:opacity-90 active:scale-95"
              style={{ background: "linear-gradient(to right, #17eeb4, #2194f2)" }}
            >
              Open Dashboard
            </button>
          ) : (
            <>
              <a
                href={getLoginUrl()}
                className="text-sm font-medium text-slate-300 hover:text-white transition-colors px-3 py-2"
              >
                Log In
              </a>
              <a
                href={getLoginUrl()}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-[#020617] transition-all hover:opacity-90 active:scale-95"
                style={{ background: "linear-gradient(to right, #17eeb4, #2194f2)" }}
              >
                Get Started Free
              </a>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}

// ── Hero ───────────────────────────────────────────────────────────────────────
function Hero({ isAuthenticated }: { isAuthenticated: boolean }) {
  const [, setLocation] = useLocation();
  return (
    <section
      className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden pt-16"
      style={{
        background:
          "radial-gradient(ellipse 80% 50% at 50% -10%, rgba(23,238,180,0.13) 0%, transparent 60%), radial-gradient(ellipse 50% 40% at 85% 60%, rgba(33,148,242,0.09) 0%, transparent 50%), #020617",
      }}
    >
      {/* Dot grid */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.055) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />

      <div className="relative z-10 max-w-5xl mx-auto px-6 text-center">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium mb-8 border"
          style={{ background: "rgba(23,238,180,0.08)", borderColor: "rgba(23,238,180,0.25)", color: "#17eeb4" }}>
          <span className="w-1.5 h-1.5 rounded-full bg-[#17eeb4] animate-pulse" />
          Florida Building Code 2023 · 8th Edition · Cloud-Native BIM
        </div>

        {/* Headline */}
        <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-white leading-[1.08] mb-6 tracking-tight"
          style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
          Browser-Based BIM<br />
          <span style={{
            background: "linear-gradient(to right, #17eeb4, #2194f2)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}>
            Built for Florida AEC
          </span>
        </h1>

        {/* Sub */}
        <p className="text-lg sm:text-xl text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed">
          Elevations by Sourcy is a cloud-native IFC platform for Florida licensed architects and engineers.
          Real-time FBC compliance checking, AI-assisted design, and multi-user collaboration — all in your browser.
          No installs. No Blender. No desktop dependencies.
        </p>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
          <a
            href={getLoginUrl()}
            className="inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl text-base font-semibold text-[#020617] transition-all hover:opacity-90 hover:scale-[1.02] active:scale-95 shadow-lg"
            style={{ background: "linear-gradient(to right, #17eeb4, #2194f2)", boxShadow: "0 0 32px rgba(23,238,180,0.25)" }}
          >
            Start for Free
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            </svg>
          </a>
          <button
            onClick={() => document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth" })}
            className="inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl text-base font-medium text-white border transition-all hover:border-white/20 hover:bg-white/5"
            style={{ borderColor: "rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.04)" }}
          >
            See How It Works
          </button>
        </div>

        {/* Trust badges */}
        <div className="flex flex-wrap justify-center gap-6 text-xs text-slate-500">
          {[
            "✓ No credit card required",
            "✓ FBC 2023 8th Edition",
            "✓ 8 Florida counties covered",
            "✓ Open-source IFC core",
          ].map((t) => (
            <span key={t}>{t}</span>
          ))}
        </div>
      </div>

      {/* Bottom fade */}
      <div className="absolute bottom-0 left-0 right-0 h-32 pointer-events-none"
        style={{ background: "linear-gradient(to bottom, transparent, #020617)" }} />
    </section>
  );
}

// ── Features ───────────────────────────────────────────────────────────────────
const FEATURES = [
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
      </svg>
    ),
    title: "IFC File Processing",
    desc: "Upload, parse, and export IFC files server-side. Full support for IfcWall, IfcSlab, IfcRoof, IfcDoor, IfcWindow, and IfcOpeningElement with property set inspection.",
    color: "#17eeb4",
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 7.125C2.25 6.504 2.754 6 3.375 6h6c.621 0 1.125.504 1.125 1.125v3.75c0 .621-.504 1.125-1.125 1.125h-6a1.125 1.125 0 01-1.125-1.125v-3.75zM14.25 8.625c0-.621.504-1.125 1.125-1.125h5.25c.621 0 1.125.504 1.125 1.125v8.25c0 .621-.504 1.125-1.125 1.125h-5.25a1.125 1.125 0 01-1.125-1.125v-8.25zM3.75 16.125c0-.621.504-1.125 1.125-1.125h5.25c.621 0 1.125.504 1.125 1.125v2.25c0 .621-.504 1.125-1.125 1.125h-5.25a1.125 1.125 0 01-1.125-1.125v-2.25z" />
      </svg>
    ),
    title: "Interactive 3D Viewer",
    desc: "WebGL-powered 3D model viewer in the browser. Navigate storeys, select elements, inspect property sets, and view ghost-state AI previews without any plugins.",
    color: "#2194f2",
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
      </svg>
    ),
    title: "FBC Compliance Engine",
    desc: "Passive real-time checking against the 2023 Florida Building Code 8th Edition. Covers flood zone, wind speed, egress, ceiling height, slab thickness, and stair geometry with exact FBC section citations.",
    color: "#17eeb4",
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
      </svg>
    ),
    title: "AI Chat Interface",
    desc: "Natural language commands to create or edit IFC elements and run compliance checks. All AI-generated changes appear as ghost-state previews requiring professional confirmation before commit.",
    color: "#2194f2",
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
      </svg>
    ),
    title: "Multi-User Collaboration",
    desc: "Invite collaborators with role-based permissions. Owners and collaborators share a live project workspace with real-time compliance flags and synchronized element schedules.",
    color: "#17eeb4",
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h1.5C5.496 19.5 6 18.996 6 18.375m-3.75.125v-5.25m0 5.25a1.125 1.125 0 01-1.125-1.125v-5.25m0 0h17.25m0 0v5.25m0-5.25a1.125 1.125 0 011.125 1.125v5.25m0 0a1.125 1.125 0 01-1.125 1.125m0 0h-1.5m-15.75 0h15.75" />
      </svg>
    ),
    title: "Live Door & Window Schedules",
    desc: "Auto-generated door and window schedules from model data with bidirectional editing. Schedule changes sync back to IFC property sets including FL_DoorProperties NOA number and impact rating.",
    color: "#2194f2",
  },
];

function Features() {
  return (
    <section id="features" className="py-24 relative" style={{ background: "#020617" }}>
      <div className="divider-glow mb-0" />
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium mb-4 border"
            style={{ background: "rgba(33,148,242,0.08)", borderColor: "rgba(33,148,242,0.25)", color: "#2194f2" }}>
            Platform Capabilities
          </div>
          <h2 className="text-4xl sm:text-5xl font-bold text-white mb-4" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            Everything Your Practice Needs
          </h2>
          <p className="text-slate-400 text-lg max-w-2xl mx-auto">
            A complete BIM workflow in the browser — from IFC upload to FBC compliance sign-off.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="rounded-2xl p-6 border card-hover-sourcy"
              style={{ background: "#0f172a", borderColor: "rgba(255,255,255,0.07)" }}
            >
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
                style={{ background: `${f.color}18`, color: f.color }}
              >
                {f.icon}
              </div>
              <h3 className="text-white font-semibold text-lg mb-2" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                {f.title}
              </h3>
              <p className="text-slate-400 text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── FBC Compliance ─────────────────────────────────────────────────────────────
const COUNTIES = [
  { name: "Miami-Dade", hvhz: true, bfe: "9–12 ft" },
  { name: "Broward", hvhz: true, bfe: "8–11 ft" },
  { name: "Palm Beach", hvhz: false, bfe: "7–10 ft" },
  { name: "Lee", hvhz: false, bfe: "8–11 ft" },
  { name: "Collier", hvhz: false, bfe: "9–12 ft" },
  { name: "Sarasota", hvhz: false, bfe: "7–10 ft" },
  { name: "Charlotte", hvhz: false, bfe: "7–9 ft" },
  { name: "Hillsborough", hvhz: false, bfe: "6–9 ft" },
];

const FBC_RULES = [
  { code: "R301.2.1", title: "Wind Speed", desc: "Ultimate design wind speed verification per county ASCE 7-22 wind maps" },
  { code: "R305.1", title: "Ceiling Height", desc: "Minimum 7 ft habitable space, 6 ft 8 in for corridors and bathrooms" },
  { code: "R311.7", title: "Stair Geometry", desc: "Max 8¾ in riser, min 10 in tread, min 36 in width, headroom 6 ft 8 in" },
  { code: "R311.2", title: "Egress Doors", desc: "Min 32 in clear width, 78 in height, side-hinged required for egress" },
  { code: "1612", title: "Flood Loads", desc: "BFE compliance for AE/VE flood zones, freeboard requirements" },
  { code: "R403.1.1", title: "Slab Thickness", desc: "Min 3.5 in concrete slab on grade, 4 in for garage floors" },
];

function Compliance() {
  return (
    <section id="compliance" className="py-24 relative" style={{ background: "#0a0f1e" }}>
      <div className="divider-glow mb-0" />
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium mb-4 border"
            style={{ background: "rgba(23,238,180,0.08)", borderColor: "rgba(23,238,180,0.25)", color: "#17eeb4" }}>
            FBC 2023 · 8th Edition
          </div>
          <h2 className="text-4xl sm:text-5xl font-bold text-white mb-4" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            Real-Time Florida Building Code<br />
            <span style={{
              background: "linear-gradient(to right, #17eeb4, #2194f2)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}>
              Compliance Checking
            </span>
          </h2>
          <p className="text-slate-400 text-lg max-w-2xl mx-auto">
            County-specific rules seeded for 8 Florida counties. Every flag includes the exact FBC section reference.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-12 items-start">
          {/* County grid */}
          <div>
            <h3 className="text-white font-semibold text-lg mb-4" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              Covered Counties
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {COUNTIES.map((c) => (
                <div
                  key={c.name}
                  className="rounded-xl p-4 border"
                  style={{ background: "#0f172a", borderColor: "rgba(255,255,255,0.07)" }}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-white font-medium text-sm">{c.name} County</span>
                    {c.hvhz && (
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                        style={{ background: "rgba(239,68,68,0.15)", color: "#f87171", border: "1px solid rgba(239,68,68,0.3)" }}>
                        HVHZ
                      </span>
                    )}
                  </div>
                  <p className="text-slate-500 text-xs">BFE: {c.bfe}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Rule list */}
          <div>
            <h3 className="text-white font-semibold text-lg mb-4" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              Compliance Checks
            </h3>
            <div className="space-y-3">
              {FBC_RULES.map((r) => (
                <div
                  key={r.code}
                  className="rounded-xl p-4 border flex gap-4"
                  style={{ background: "#0f172a", borderColor: "rgba(255,255,255,0.07)" }}
                >
                  <div className="flex-shrink-0 w-16 h-8 rounded-lg flex items-center justify-center text-xs font-bold"
                    style={{ background: "rgba(23,238,180,0.1)", color: "#17eeb4" }}>
                    {r.code}
                  </div>
                  <div>
                    <p className="text-white text-sm font-medium">{r.title}</p>
                    <p className="text-slate-500 text-xs mt-0.5">{r.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── How It Works ───────────────────────────────────────────────────────────────
const STEPS = [
  {
    num: "01",
    title: "Create a Project",
    desc: "Set up your project with county, flood zone, BFE, wind speed, HVHZ flag, occupancy type, and construction type. Elevations pre-loads the correct FBC rules automatically.",
  },
  {
    num: "02",
    title: "Upload Your IFC Model",
    desc: "Drag and drop your IFC file. The server parses all elements and property sets instantly. View your model in the 3D browser viewer with storey navigation.",
  },
  {
    num: "03",
    title: "Review Compliance Flags",
    desc: "The FBC compliance engine runs passively as you work. Every violation flag cites the exact FBC section. Use the AI chat to ask questions or make changes in plain language.",
  },
  {
    num: "04",
    title: "Collaborate & Export",
    desc: "Invite team members, edit door and window schedules, confirm AI-suggested changes, and export a compliant IFC file ready for permit submission.",
  },
];

function HowItWorks() {
  return (
    <section id="how-it-works" className="py-24 relative" style={{ background: "#020617" }}>
      <div className="divider-glow mb-0" />
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium mb-4 border"
            style={{ background: "rgba(33,148,242,0.08)", borderColor: "rgba(33,148,242,0.25)", color: "#2194f2" }}>
            Workflow
          </div>
          <h2 className="text-4xl sm:text-5xl font-bold text-white mb-4" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            From Upload to Permit-Ready
          </h2>
          <p className="text-slate-400 text-lg max-w-xl mx-auto">
            A streamlined four-step workflow designed for Florida AEC professionals.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {STEPS.map((s, i) => (
            <div key={s.num} className="relative">
              {/* Connector line */}
              {i < STEPS.length - 1 && (
                <div className="hidden lg:block absolute top-8 left-full w-full h-px z-0"
                  style={{ background: "linear-gradient(to right, rgba(23,238,180,0.3), rgba(33,148,242,0.15))", width: "calc(100% - 3rem)", left: "calc(100% - 0.5rem)" }} />
              )}
              <div className="rounded-2xl p-6 border relative z-10 h-full"
                style={{ background: "#0f172a", borderColor: "rgba(255,255,255,0.07)" }}>
                <div className="text-3xl font-bold mb-4" style={{
                  background: "linear-gradient(to right, #17eeb4, #2194f2)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                  fontFamily: "'Space Grotesk', sans-serif",
                }}>
                  {s.num}
                </div>
                <h3 className="text-white font-semibold text-base mb-2" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                  {s.title}
                </h3>
                <p className="text-slate-400 text-sm leading-relaxed">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Pricing ────────────────────────────────────────────────────────────────────
const PLANS = [
  {
    name: "Starter",
    price: "Free",
    period: "",
    desc: "For individual architects exploring FBC compliance.",
    highlight: false,
    cta: "Get Started Free",
    features: [
      "3 active projects",
      "IFC upload & 3D viewer",
      "FBC compliance engine (2 counties)",
      "Door & window schedules",
      "1 collaborator per project",
      "Community support",
    ],
  },
  {
    name: "Professional",
    price: "$79",
    period: "/mo",
    desc: "For licensed architects and engineers in active practice.",
    highlight: true,
    cta: "Start Free Trial",
    features: [
      "Unlimited projects",
      "All 8 Florida counties",
      "AI chat interface (50 commands/mo)",
      "Ghost-state preview & confirmation",
      "FL_DoorProperties NOA/Impact fields",
      "Up to 10 collaborators",
      "IFC export & download",
      "Priority support",
    ],
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "",
    desc: "For AEC firms and multi-office practices.",
    highlight: false,
    cta: "Contact Sourcy",
    features: [
      "Everything in Professional",
      "Unlimited AI commands",
      "Custom FBC rule sets",
      "SSO / SAML authentication",
      "Dedicated onboarding",
      "SLA & uptime guarantee",
      "API access",
      "White-label option",
    ],
  },
];

function Pricing() {
  return (
    <section id="pricing" className="py-24 relative" style={{ background: "#0a0f1e" }}>
      <div className="divider-glow mb-0" />
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium mb-4 border"
            style={{ background: "rgba(23,238,180,0.08)", borderColor: "rgba(23,238,180,0.25)", color: "#17eeb4" }}>
            Pricing
          </div>
          <h2 className="text-4xl sm:text-5xl font-bold text-white mb-4" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            Simple, Transparent Pricing
          </h2>
          <p className="text-slate-400 text-lg max-w-xl mx-auto">
            Start free. Upgrade when your practice grows. No hidden fees.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 items-stretch">
          {PLANS.map((plan) => (
            <div
              key={plan.name}
              className="rounded-2xl p-8 border flex flex-col relative overflow-hidden card-hover-sourcy"
              style={{
                background: plan.highlight ? "#0f172a" : "#0f172a",
                borderColor: plan.highlight ? "rgba(23,238,180,0.4)" : "rgba(255,255,255,0.07)",
                boxShadow: plan.highlight ? "0 0 40px rgba(23,238,180,0.12)" : "none",
              }}
            >
              {plan.highlight && (
                <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-sourcy-r" />
              )}
              {plan.highlight && (
                <div className="absolute top-4 right-4 text-xs font-semibold px-2.5 py-1 rounded-full"
                  style={{ background: "rgba(23,238,180,0.15)", color: "#17eeb4", border: "1px solid rgba(23,238,180,0.3)" }}>
                  Most Popular
                </div>
              )}

              <div className="mb-6">
                <p className="text-slate-400 text-sm font-medium mb-1">{plan.name}</p>
                <div className="flex items-baseline gap-1 mb-2">
                  <span className="text-4xl font-bold text-white" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                    {plan.price}
                  </span>
                  {plan.period && <span className="text-slate-400 text-sm">{plan.period}</span>}
                </div>
                <p className="text-slate-500 text-sm">{plan.desc}</p>
              </div>

              <ul className="space-y-3 mb-8 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-slate-300">
                    <svg className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: "#17eeb4" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>

              <a
                href={plan.name === "Enterprise" ? "mailto:innovation.ia@sourcyinc.com" : getLoginUrl()}
                className="w-full text-center py-3 rounded-xl text-sm font-semibold transition-all hover:opacity-90 active:scale-95"
                style={
                  plan.highlight
                    ? { background: "linear-gradient(to right, #17eeb4, #2194f2)", color: "#020617" }
                    : { background: "rgba(255,255,255,0.06)", color: "#f8fafc", border: "1px solid rgba(255,255,255,0.1)" }
                }
              >
                {plan.cta}
              </a>
            </div>
          ))}
        </div>

        <p className="text-center text-slate-600 text-sm mt-8">
          All plans include SSL encryption, S3 file storage, and Manus OAuth authentication.
          Professional plan includes a 14-day free trial — no credit card required.
        </p>
      </div>
    </section>
  );
}

// ── Social Proof ───────────────────────────────────────────────────────────────
const TESTIMONIALS = [
  {
    quote: "Finally a BIM tool that understands Florida code. The FBC compliance flags saved us from a major flood zone issue on a Lee County project.",
    name: "Carlos M.",
    title: "Licensed Architect, Fort Myers",
    initials: "CM",
    color: "#17eeb4",
  },
  {
    quote: "The AI chat interface is a game changer. I typed 'add a 3-foot egress window to the master bedroom' and it showed me the ghost preview instantly.",
    name: "Priya S.",
    title: "Structural Engineer, Miami",
    initials: "PS",
    color: "#2194f2",
  },
  {
    quote: "We use it for all our Collier County submittals. The door schedule with NOA numbers and impact ratings is exactly what the county requires.",
    name: "Robert T.",
    title: "Principal, Naples AEC Group",
    initials: "RT",
    color: "#17eeb4",
  },
];

function Testimonials() {
  return (
    <section className="py-24 relative" style={{ background: "#020617" }}>
      <div className="divider-glow mb-0" />
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl sm:text-5xl font-bold text-white mb-4" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            Trusted by Florida AEC Professionals
          </h2>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {TESTIMONIALS.map((t) => (
            <div key={t.name} className="rounded-2xl p-6 border card-hover-sourcy"
              style={{ background: "#0f172a", borderColor: "rgba(255,255,255,0.07)" }}>
              {/* Stars */}
              <div className="flex gap-1 mb-4">
                {[...Array(5)].map((_, i) => (
                  <svg key={i} className="w-4 h-4" style={{ color: "#17eeb4" }} fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>
              <p className="text-slate-300 text-sm leading-relaxed mb-6">"{t.quote}"</p>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-[#020617]"
                  style={{ background: `linear-gradient(135deg, ${t.color}, #2194f2)` }}>
                  {t.initials}
                </div>
                <div>
                  <p className="text-white text-sm font-medium">{t.name}</p>
                  <p className="text-slate-500 text-xs">{t.title}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── CTA Banner ─────────────────────────────────────────────────────────────────
function CTABanner() {
  return (
    <section className="py-24 relative overflow-hidden" style={{ background: "#0a0f1e" }}>
      <div className="divider-glow mb-0" />
      {/* Glow */}
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse 60% 60% at 50% 50%, rgba(23,238,180,0.07) 0%, transparent 70%)" }} />
      <div className="relative z-10 max-w-3xl mx-auto px-6 text-center">
        <h2 className="text-4xl sm:text-5xl font-bold text-white mb-6" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
          Ready to Build Smarter<br />
          <span style={{
            background: "linear-gradient(to right, #17eeb4, #2194f2)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}>
            in Compliance?
          </span>
        </h2>
        <p className="text-slate-400 text-lg mb-10">
          Join Florida architects and engineers using Elevations by Sourcy to deliver FBC-compliant projects faster.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <a
            href={getLoginUrl()}
            className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl text-base font-semibold text-[#020617] transition-all hover:opacity-90 hover:scale-[1.02] active:scale-95 shadow-xl"
            style={{ background: "linear-gradient(to right, #17eeb4, #2194f2)", boxShadow: "0 0 40px rgba(23,238,180,0.3)" }}
          >
            Start for Free — No Credit Card
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            </svg>
          </a>
          <a
            href="mailto:innovation.ia@sourcyinc.com"
            className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl text-base font-medium text-white border transition-all hover:bg-white/5"
            style={{ borderColor: "rgba(255,255,255,0.12)" }}
          >
            Talk to Sourcy
          </a>
        </div>
      </div>
    </section>
  );
}

// ── Footer ─────────────────────────────────────────────────────────────────────
function Footer() {
  return (
    <footer style={{ background: "#020617", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10 mb-12">
          {/* Brand */}
          <div className="md:col-span-1">
            <div className="flex items-center gap-3 mb-4">
              <img src={LOGO_URL} alt="Sourcy" className="h-8 w-8 object-contain" />
              <div>
                <p className="text-white font-semibold text-sm" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Elevations</p>
                <p className="text-xs" style={{ color: "#17eeb4" }}>by Sourcy</p>
              </div>
            </div>
            <p className="text-slate-500 text-sm leading-relaxed">
              Cloud-native BIM platform for Florida AEC professionals. Built by Sourcy Inc.
            </p>
            <p className="text-slate-600 text-xs mt-4">Florida-based · Onsite AI Implementation</p>
          </div>

          {/* Product */}
          <div>
            <p className="text-white text-sm font-semibold mb-4" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Product</p>
            <ul className="space-y-2.5">
              {["Features", "FBC Compliance", "Pricing", "How It Works", "Changelog"].map((l) => (
                <li key={l}><a href="#" className="text-slate-500 text-sm hover:text-slate-300 transition-colors">{l}</a></li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div>
            <p className="text-white text-sm font-semibold mb-4" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Sourcy Inc.</p>
            <ul className="space-y-2.5">
              {[
                { label: "sourcyinc.com", href: "https://www.sourcyinc.com" },
                { label: "Blueprint by Sourcy", href: "https://www.sourcyinc.com" },
                { label: "Agency Nexus", href: "https://www.sourcyinc.com" },
                { label: "Contact Us", href: "mailto:innovation.ia@sourcyinc.com" },
              ].map((l) => (
                <li key={l.label}><a href={l.href} className="text-slate-500 text-sm hover:text-slate-300 transition-colors">{l.label}</a></li>
              ))}
            </ul>
          </div>

          {/* Legal */}
          <div>
            <p className="text-white text-sm font-semibold mb-4" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Legal</p>
            <ul className="space-y-2.5">
              {["Privacy Policy", "Terms of Service", "Cookie Policy"].map((l) => (
                <li key={l}><a href="#" className="text-slate-500 text-sm hover:text-slate-300 transition-colors">{l}</a></li>
              ))}
            </ul>
            <div className="mt-6 p-3 rounded-lg border text-xs text-slate-600"
              style={{ background: "rgba(23,238,180,0.04)", borderColor: "rgba(23,238,180,0.12)" }}>
              FBC references are informational. Always consult a licensed professional for permit submissions.
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="pt-8 border-t flex flex-col sm:flex-row items-center justify-between gap-4"
          style={{ borderColor: "rgba(255,255,255,0.06)" }}>
          <p className="text-slate-600 text-xs">
            © {new Date().getFullYear()} Sourcy Inc. All rights reserved. Elevations by Sourcy is a product of Sourcy Inc.
          </p>
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <span>Built with</span>
            <span style={{ color: "#17eeb4" }}>♥</span>
            <span>in Florida</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

// ── Main Export ────────────────────────────────────────────────────────────────
export default function Home() {
  const { isAuthenticated, loading } = useAuth();
  const [, setLocation] = useLocation();

  // Redirect authenticated users to dashboard
  useEffect(() => {
    if (!loading && isAuthenticated) {
      setLocation("/dashboard");
    }
  }, [isAuthenticated, loading, setLocation]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#020617" }}>
        <div className="flex flex-col items-center gap-4">
          <img src={LOGO_URL} alt="Sourcy" className="h-12 w-12 object-contain animate-pulse" />
          <p className="text-slate-500 text-sm">Loading Elevations…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: "#020617" }}>
      <Navbar isAuthenticated={isAuthenticated} />
      <Hero isAuthenticated={isAuthenticated} />
      <Features />
      <Compliance />
      <HowItWorks />
      <Pricing />
      <Testimonials />
      <CTABanner />
      <Footer />
    </div>
  );
}
