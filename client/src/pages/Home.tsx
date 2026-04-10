import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { getLoginUrl } from "@/const";
import {
  Building2,
  CheckCircle2,
  ChevronRight,
  FileCode2,
  MessageSquareCode,
  ShieldCheck,
  Users,
  Zap,
} from "lucide-react";
import { useLocation } from "wouter";

const FEATURES = [
  {
    icon: FileCode2,
    title: "IFC File Support",
    desc: "Upload, parse, and export IFC files. Full support for IfcWall, IfcSlab, IfcRoof, IfcDoor, IfcWindow, and IfcOpeningElement.",
  },
  {
    icon: Building2,
    title: "3D WebGL Viewer",
    desc: "Interactive browser-native 3D model viewer with element selection, property inspection, and navigation controls.",
  },
  {
    icon: ShieldCheck,
    title: "FBC Compliance Engine",
    desc: "Real-time Florida Building Code 2023 8th Edition checks — flood zone, wind speed, egress, structural, and more.",
  },
  {
    icon: MessageSquareCode,
    title: "AI Command Interface",
    desc: "Natural language commands to create and edit IFC elements. All AI output appears in ghost-state preview before professional confirmation.",
  },
  {
    icon: Users,
    title: "Multi-User Access",
    desc: "Project-level collaboration with owner and collaborator roles. Secure Manus OAuth authentication.",
  },
  {
    icon: Zap,
    title: "Live Schedules",
    desc: "Auto-generated door and window schedules from model data with bidirectional editing — changes sync back to IFC property sets.",
  },
];

const COUNTIES = [
  "Lee County",
  "Collier County",
  "Miami-Dade County",
  "Broward County",
  "Palm Beach County",
  "Sarasota County",
  "Charlotte County",
  "Hillsborough County",
];

export default function Home() {
  const { user, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();

  const handleCTA = () => {
    if (isAuthenticated) {
      navigate("/dashboard");
    } else {
      window.location.href = getLoginUrl();
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <nav className="border-b border-border/50 bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container flex items-center justify-between h-14">
          <div className="flex items-center gap-2">
            <Building2 className="w-6 h-6 text-primary" />
            <span className="font-semibold text-foreground tracking-tight">
              Elevations <span className="text-primary">by Sourcy</span>
            </span>
          </div>
          <div className="flex items-center gap-3">
            {isAuthenticated ? (
              <Button size="sm" onClick={() => navigate("/dashboard")}>
                Dashboard <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            ) : (
              <Button size="sm" onClick={handleCTA}>
                Sign In
              </Button>
            )}
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent pointer-events-none" />
        <div className="container py-24 lg:py-32">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 text-xs font-medium text-primary bg-primary/10 border border-primary/20 rounded-full px-3 py-1 mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              Florida Building Code 2023 · 8th Edition
            </div>
            <h1 className="text-4xl lg:text-6xl font-bold tracking-tight text-foreground mb-6 leading-tight">
              Browser-based BIM
              <br />
              <span className="text-primary">for Florida AEC</span>
            </h1>
            <p className="text-lg text-muted-foreground mb-8 max-w-2xl leading-relaxed">
              Elevations by Sourcy is a cloud-native BIM platform for Florida licensed architects and engineers.
              IFC file processing, real-time FBC compliance checking, AI-assisted design, and multi-user collaboration
              — all in your browser.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button size="lg" onClick={handleCTA} className="gap-2">
                {isAuthenticated ? "Open Dashboard" : "Get Started"}
                <ChevronRight className="w-4 h-4" />
              </Button>
              <Button size="lg" variant="outline" onClick={() => navigate("/dashboard")}>
                View Demo Project
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20 border-t border-border/50">
        <div className="container">
          <div className="text-center mb-12">
            <h2 className="text-2xl font-bold text-foreground mb-3">Built for Florida AEC Professionals</h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Every feature designed around Florida Building Code compliance and the Florida AEC workflow.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="bg-card border border-border rounded-lg p-5 hover:border-primary/40 transition-colors"
              >
                <div className="w-9 h-9 rounded-md bg-primary/10 flex items-center justify-center mb-3">
                  <f.icon className="w-5 h-5 text-primary" />
                </div>
                <h3 className="font-semibold text-foreground mb-1.5">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Counties */}
      <section className="py-16 border-t border-border/50 bg-card/30">
        <div className="container">
          <div className="text-center mb-8">
            <h2 className="text-xl font-bold text-foreground mb-2">County-Specific FBC Rules</h2>
            <p className="text-sm text-muted-foreground">
              Seeded with wind speed, freeboard, HVHZ, and submittal requirements for all 8 major Florida counties.
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            {COUNTIES.map((c) => (
              <div
                key={c}
                className="flex items-center gap-1.5 text-sm bg-secondary/50 border border-border rounded-full px-3 py-1.5"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
                <span className="text-foreground">{c}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 border-t border-border/50">
        <div className="container text-center">
          <h2 className="text-2xl font-bold text-foreground mb-3">Ready to start your Florida BIM project?</h2>
          <p className="text-muted-foreground mb-6">
            Sign in with your Manus account to create your first project.
          </p>
          <Button size="lg" onClick={handleCTA}>
            {isAuthenticated ? `Continue as ${user?.name ?? "User"}` : "Sign In to Get Started"}
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 py-8">
        <div className="container flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-primary" />
            <span>Elevations by Sourcy</span>
          </div>
          <span>Florida Building Code 2023 8th Edition · IFC4 · IfcOpenShell</span>
        </div>
      </footer>
    </div>
  );
}
