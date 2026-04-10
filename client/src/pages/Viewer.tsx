import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  Building2,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  FileCode2,
  Info,
  Loader2,
  MessageSquare,
  RotateCcw,
  Zap,
  Send,
  Shield,
  X,
  Box,
  LayoutGrid,
  Map,
} from "lucide-react";
import { useEffect, useRef, useState, lazy, Suspense } from "react";
import { toast } from "sonner";
import { useLocation, useParams } from "wouter";
import FloorPlan2D from "@/components/FloorPlan2D";

const GLBViewer3D = lazy(() => import("@/components/GLBViewer3D"));

type ViewMode = "schematic" | "3d" | "2d";

// ─── Types ────────────────────────────────────────────────────────────────────

interface IfcElement {
  id: number;
  globalId: string;
  ifcClass: string;
  name: string | null;
  storey: string | null;
  positionX: number | null;
  positionY: number | null;
  positionZ: number | null;
  width: number | null;
  height: number | null;
  depth: number | null;
  propertySets: Record<string, Record<string, unknown>> | null;
  isGhost: boolean | null;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  sessionId?: number | null;
  isModelChange?: boolean;
  elements?: unknown[];
  codeFlags?: Array<{ severity: string; fbcSection: string; message: string }>;
  professionalDecisions?: Array<{ id: string; question: string; required: boolean }>;
}

// ─── 3D Viewer Component ──────────────────────────────────────────────────────

function IFCViewer3D({
  elements,
  selectedId,
  onSelect,
}: {
  elements: IfcElement[];
  selectedId: number | null;
  onSelect: (id: number | null) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [rotating, setRotating] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [rotation, setRotation] = useState({ x: -25, y: 30 });
  const dragRef = useRef<{ startX: number; startY: number; startRot: { x: number; y: number } } | null>(null);

  const IFC_COLORS: Record<string, string> = {
    IfcWall: "#4a9eff",
    IfcSlab: "#8a7a60",
    IfcRoof: "#c0392b",
    IfcDoor: "#27ae60",
    IfcWindow: "#3498db",
    IfcOpeningElement: "#9b59b6",
    IfcBeam: "#e67e22",
    IfcColumn: "#e74c3c",
    IfcFooting: "#795548",
  };

  // Render a schematic 3D-like view using Canvas 2D
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    // Background
    ctx.fillStyle = "#0d1117";
    ctx.fillRect(0, 0, W, H);

    // Grid
    ctx.strokeStyle = "#1e2a3a";
    ctx.lineWidth = 1;
    const gridSize = 40 * zoom;
    const offsetX = (W / 2 + pan.x) % gridSize;
    const offsetY = (H / 2 + pan.y) % gridSize;
    for (let x = offsetX; x < W; x += gridSize) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    for (let y = offsetY; y < H; y += gridSize) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }

    // Axes
    const cx = W / 2 + pan.x;
    const cy = H / 2 + pan.y;
    ctx.strokeStyle = "#ff4444"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + 60 * zoom, cy); ctx.stroke();
    ctx.fillStyle = "#ff4444"; ctx.font = "11px monospace";
    ctx.fillText("X", cx + 65 * zoom, cy + 4);

    ctx.strokeStyle = "#44ff44"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx, cy - 60 * zoom); ctx.stroke();
    ctx.fillStyle = "#44ff44";
    ctx.fillText("Y", cx + 4, cy - 65 * zoom);

    // Draw elements as isometric-style boxes
    const iso = (x: number, y: number, z: number) => ({
      sx: cx + (x - y) * 0.7 * zoom * 20,
      sy: cy - z * zoom * 20 + (x + y) * 0.35 * zoom * 20,
    });

    const drawBox = (
      px: number, py: number, pz: number,
      w: number, h: number, d: number,
      color: string,
      selected: boolean,
      ghost: boolean
    ) => {
      const alpha = ghost ? 0.35 : 1.0;
      const pts = {
        a: iso(px, py, pz),
        b: iso(px + w, py, pz),
        c: iso(px + w, py + d, pz),
        e: iso(px, py + d, pz),
        f: iso(px, py, pz + h),
        g: iso(px + w, py, pz + h),
        i: iso(px + w, py + d, pz + h),
        j: iso(px, py + d, pz + h),
      };

      const faces = [
        { pts: [pts.e, pts.c, pts.i, pts.j], brightness: 0.6 },
        { pts: [pts.b, pts.c, pts.i, pts.g], brightness: 0.8 },
        { pts: [pts.f, pts.g, pts.i, pts.j], brightness: 1.0 },
      ];

      for (const face of faces) {
        const r = parseInt(color.slice(1, 3), 16);
        const g = parseInt(color.slice(3, 5), 16);
        const b = parseInt(color.slice(5, 7), 16);
        const br = face.brightness;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = `rgb(${Math.round(r * br)},${Math.round(g * br)},${Math.round(b * br)})`;
        ctx.beginPath();
        ctx.moveTo(face.pts[0].sx, face.pts[0].sy);
        for (let k = 1; k < face.pts.length; k++) ctx.lineTo(face.pts[k].sx, face.pts[k].sy);
        ctx.closePath();
        ctx.fill();

        if (selected) {
          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = 2;
          ctx.globalAlpha = 1;
        } else {
          ctx.strokeStyle = ghost ? "#4a9eff" : "rgba(0,0,0,0.3)";
          ctx.lineWidth = ghost ? 1.5 : 0.5;
          ctx.globalAlpha = alpha;
        }
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    };

    // Place elements in a grid layout
    let row = 0, col = 0;
    const cols = 4;
    const spacing = 2.5;

    for (const el of elements) {
      const color = IFC_COLORS[el.ifcClass] ?? "#888888";
      const selected = el.id === selectedId;
      const ghost = el.isGhost ?? false;

      const px = col * spacing;
      const py = row * spacing;
      const pz = 0;

      let w = 2, h = 1, d = 0.3;
      if (el.ifcClass === "IfcSlab") { w = 2; h = 0.15; d = 2; }
      else if (el.ifcClass === "IfcDoor") { w = 0.9; h = 2.1; d = 0.1; }
      else if (el.ifcClass === "IfcWindow") { w = 1.2; h = 1.2; d = 0.1; }
      else if (el.ifcClass === "IfcRoof") { w = 2.5; h = 0.3; d = 2.5; }
      else if (el.ifcClass === "IfcOpeningElement") { w = 0.9; h = 2.1; d = 0.2; }

      drawBox(px, py, pz, w, h, d, color, selected, ghost);

      // Label
      const center = iso(px + w / 2, py + d / 2, pz + h / 2);
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = "#ffffff";
      ctx.font = `${10 * zoom}px monospace`;
      ctx.textAlign = "center";
      ctx.fillText(el.name?.substring(0, 12) ?? el.ifcClass.replace("Ifc", ""), center.sx, center.sy);
      ctx.textAlign = "left";
      ctx.globalAlpha = 1;

      col++;
      if (col >= cols) { col = 0; row++; }
    }

    // Empty state
    if (elements.length === 0) {
      ctx.fillStyle = "#3d4f6e";
      ctx.font = "14px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("No IFC elements loaded", W / 2, H / 2 - 10);
      ctx.fillStyle = "#2d3f5e";
      ctx.font = "12px sans-serif";
      ctx.fillText("Upload an IFC file or use the AI chat to add elements", W / 2, H / 2 + 14);
      ctx.textAlign = "left";
    }
  }, [elements, selectedId, zoom, pan, rotation]);

  // Mouse events for rotation/pan
  const handleMouseDown = (e: React.MouseEvent) => {
    dragRef.current = { startX: e.clientX, startY: e.clientY, startRot: { ...rotation } };
    setRotating(true);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragRef.current) return;
    if (e.buttons === 1) {
      const dx = e.clientX - dragRef.current.startX;
      const dy = e.clientY - dragRef.current.startY;
      setRotation({
        x: dragRef.current.startRot.x + dy * 0.5,
        y: dragRef.current.startRot.y + dx * 0.5,
      });
    } else if (e.buttons === 2) {
      setPan((p) => ({ x: p.x + e.movementX, y: p.y + e.movementY }));
    }
  };

  const handleMouseUp = () => {
    dragRef.current = null;
    setRotating(false);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    setZoom((z) => Math.max(0.3, Math.min(3, z - e.deltaY * 0.001)));
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Simple hit detection — find closest element center
    const W = canvas.width;
    const H = canvas.height;
    const cx = W / 2 + pan.x;
    const cy = H / 2 + pan.y;

    let closest: number | null = null;
    let minDist = 40;

    elements.forEach((el, idx) => {
      const col = idx % 4;
      const row = Math.floor(idx / 4);
      const px = col * 2.5 + 1;
      const py = row * 2.5 + 1;
      const sx = cx + (px - py) * 0.7 * zoom * 20;
      const sy = cy - 0.5 * zoom * 20 + (px + py) * 0.35 * zoom * 20;
      const dist = Math.sqrt((x - sx) ** 2 + (y - sy) ** 2);
      if (dist < minDist) {
        minDist = dist;
        closest = el.id;
      }
    });

    onSelect(closest);
  };

  return (
    <div className="relative w-full h-full bg-[#0d1117]">
      <canvas
        ref={canvasRef}
        width={800}
        height={600}
        className="w-full h-full cursor-crosshair"
        style={{ cursor: rotating ? "grabbing" : "crosshair" }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        onClick={handleCanvasClick}
        onContextMenu={(e) => e.preventDefault()}
      />
      {/* Viewer controls */}
      <div className="absolute bottom-3 right-3 flex flex-col gap-1.5">
        <button
          className="w-7 h-7 bg-card/80 border border-border rounded text-foreground text-sm flex items-center justify-center hover:bg-card transition-colors"
          onClick={() => setZoom((z) => Math.min(3, z + 0.2))}
        >+</button>
        <button
          className="w-7 h-7 bg-card/80 border border-border rounded text-foreground text-sm flex items-center justify-center hover:bg-card transition-colors"
          onClick={() => setZoom((z) => Math.max(0.3, z - 0.2))}
        >−</button>
        <button
          className="w-7 h-7 bg-card/80 border border-border rounded text-foreground flex items-center justify-center hover:bg-card transition-colors"
          onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); setRotation({ x: -25, y: 30 }); }}
          title="Reset view"
        ><RotateCcw className="w-3.5 h-3.5" /></button>
      </div>
      <div className="absolute bottom-3 left-3 text-xs text-muted-foreground/60">
        Drag: rotate · Right-drag: pan · Scroll: zoom · Click: select
      </div>
    </div>
  );
}

// ─── Element Inspector Panel ──────────────────────────────────────────────────

function ElementInspector({
  element,
  onClose,
  onUpdate,
}: {
  element: IfcElement;
  onClose: () => void;
  onUpdate: () => void;
}) {
  const [psets, setPsets] = useState<Record<string, Record<string, unknown>>>(
    (element.propertySets as Record<string, Record<string, unknown>>) ?? {}
  );
  const [saving, setSaving] = useState(false);

  const updateElement = trpc.ifc.updateElement.useMutation({
    onSuccess: () => {
      toast.success("Element updated");
      setSaving(false);
      onUpdate();
    },
    onError: (err) => {
      toast.error(err.message);
      setSaving(false);
    },
  });

  const handleSave = () => {
    setSaving(true);
    updateElement.mutate({ id: element.id, propertySets: psets });
  };

  const updatePsetField = (pset: string, field: string, value: string) => {
    setPsets((prev) => ({
      ...prev,
      [pset]: { ...prev[pset], [field]: value === "true" ? true : value === "false" ? false : value },
    }));
  };

  const IFC_CLASS_COLORS: Record<string, string> = {
    IfcWall: "text-blue-400",
    IfcSlab: "text-yellow-600",
    IfcRoof: "text-red-400",
    IfcDoor: "text-green-400",
    IfcWindow: "text-cyan-400",
    IfcOpeningElement: "text-purple-400",
  };

  return (
    <div className="h-full flex flex-col bg-card border-l border-border">
      <div className="flex items-center justify-between p-3 border-b border-border">
        <div>
          <div className={`text-xs font-mono font-semibold ${IFC_CLASS_COLORS[element.ifcClass] ?? "text-muted-foreground"}`}>
            {element.ifcClass}
          </div>
          <div className="text-sm font-semibold text-foreground mt-0.5 truncate">
            {element.name ?? element.globalId}
          </div>
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {/* Basic info */}
        <div>
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Position</div>
          <div className="grid grid-cols-3 gap-1.5 text-xs">
            {[["X", element.positionX], ["Y", element.positionY], ["Z", element.positionZ]].map(([label, val]) => (
              <div key={label as string} className="bg-secondary/40 rounded p-1.5">
                <div className="text-muted-foreground">{label}</div>
                <div className="text-foreground font-mono">{val !== null && val !== undefined ? (val as number).toFixed(2) : "—"}</div>
              </div>
            ))}
          </div>
        </div>

        {element.storey && (
          <div>
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Level</div>
            <div className="text-sm text-foreground">{element.storey}</div>
          </div>
        )}

        {/* Property Sets */}
        {Object.entries(psets).map(([psetName, psetFields]) => (
          <div key={psetName}>
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <ChevronDown className="w-3 h-3" />
              {psetName}
            </div>
            <div className="space-y-2">
              {Object.entries(psetFields).map(([field, value]) => (
                <div key={field}>
                  <Label className="text-xs text-muted-foreground">{field}</Label>
                  {typeof value === "boolean" ? (
                    <select
                      className="w-full mt-0.5 bg-input border border-border rounded px-2 py-1 text-xs text-foreground"
                      value={String(value)}
                      onChange={(e) => updatePsetField(psetName, field, e.target.value)}
                    >
                      <option value="true">Yes</option>
                      <option value="false">No</option>
                    </select>
                  ) : (
                    <Input
                      className="mt-0.5 h-7 text-xs bg-input border-border text-foreground"
                      value={value === null || value === undefined ? "" : String(value)}
                      onChange={(e) => updatePsetField(psetName, field, e.target.value)}
                      placeholder="—"
                    />
                  )}
                  {/* NOA field highlight */}
                  {field === "NOANumber" && (
                    <p className="text-xs text-orange-400 mt-0.5">Required for HVHZ (FBC §1626.1.2)</p>
                  )}
                  {field === "ImpactRated" && (
                    <p className="text-xs text-orange-400 mt-0.5">Impact rating required for HVHZ</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="p-3 border-t border-border">
        <Button size="sm" className="w-full" onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Check className="w-4 h-4 mr-1.5" />}
          Save Changes
        </Button>
      </div>
    </div>
  );
}

// ─── FBC Compliance Sidebar ───────────────────────────────────────────────────

function ComplianceSidebar({ projectId }: { projectId: number }) {
  const { data: flags, refetch } = trpc.compliance.getFlags.useQuery({ projectId });
  const runCheck = trpc.compliance.runCheck.useMutation({
    onSuccess: (data) => {
      toast.success(`${data.flagCount} flag${data.flagCount !== 1 ? "s" : ""} found`);
      refetch();
    },
  });

  const errors = flags?.filter((f) => f.severity === "error") ?? [];
  const warnings = flags?.filter((f) => f.severity === "warning") ?? [];
  const infos = flags?.filter((f) => f.severity === "info") ?? [];

  return (
    <div className="h-full flex flex-col bg-card">
      <div className="flex items-center justify-between p-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">FBC Compliance</span>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => runCheck.mutate({ projectId })}
          disabled={runCheck.isPending}
          className="h-7 text-xs"
        >
          {runCheck.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Run Check"}
        </Button>
      </div>

      {/* Summary */}
      {flags && flags.length > 0 && (
        <div className="flex gap-2 p-3 border-b border-border">
          {errors.length > 0 && (
            <div className="flex-1 bg-red-500/10 border border-red-500/25 rounded p-2 text-center">
              <div className="text-lg font-bold text-red-400">{errors.length}</div>
              <div className="text-xs text-red-400/70">Error{errors.length !== 1 ? "s" : ""}</div>
            </div>
          )}
          {warnings.length > 0 && (
            <div className="flex-1 bg-yellow-500/10 border border-yellow-500/25 rounded p-2 text-center">
              <div className="text-lg font-bold text-yellow-400">{warnings.length}</div>
              <div className="text-xs text-yellow-400/70">Warning{warnings.length !== 1 ? "s" : ""}</div>
            </div>
          )}
          {infos.length > 0 && (
            <div className="flex-1 bg-blue-500/10 border border-blue-500/25 rounded p-2 text-center">
              <div className="text-lg font-bold text-blue-400">{infos.length}</div>
              <div className="text-xs text-blue-400/70">Info</div>
            </div>
          )}
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
        {flags === undefined ? (
          <div className="text-center py-8 text-xs text-muted-foreground">Run a check to see FBC flags</div>
        ) : flags.length === 0 ? (
          <div className="flex flex-col items-center py-8 text-center">
            <CheckCircle2 className="w-7 h-7 text-green-400 mb-2" />
            <p className="text-xs text-muted-foreground">No compliance flags found</p>
          </div>
        ) : (
          [...errors, ...warnings, ...infos].map((flag) => (
            <div
              key={flag.id}
              className={`rounded p-2.5 border text-xs ${
                flag.severity === "error"
                  ? "bg-red-500/8 border-red-500/25"
                  : flag.severity === "warning"
                  ? "bg-yellow-500/8 border-yellow-500/25"
                  : "bg-blue-500/8 border-blue-500/25"
              }`}
            >
              <div className="flex items-start gap-1.5">
                {flag.severity === "error" ? (
                  <AlertCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0 mt-0.5" />
                ) : flag.severity === "warning" ? (
                  <AlertTriangle className="w-3.5 h-3.5 text-yellow-400 flex-shrink-0 mt-0.5" />
                ) : (
                  <Info className="w-3.5 h-3.5 text-blue-400 flex-shrink-0 mt-0.5" />
                )}
                <div>
                  <span className="font-mono text-muted-foreground">FBC {flag.fbcSection} · </span>
                  <span className="text-foreground">{flag.message}</span>
                  {flag.details && (
                    <p className="text-muted-foreground mt-1 leading-relaxed">{flag.details}</p>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ─── AI Chat Panel ────────────────────────────────────────────────────────────

function AIChatPanel({ projectId, onElementsAdded, elementCount }: { projectId: number; onElementsAdded: () => void; elementCount: number }) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content:
        "I'm ELEV, your BIM architect. Describe any building and I'll generate the full model immediately — no back-and-forth. Try: \"1200 sqft 2bed 2bath single story\" or \"Add a 3-car garage to the north side\".",
    },
  ]);
  const [input, setInput] = useState("");
  const [pendingSession, setPendingSession] = useState<number | null>(null);
  const [showIntake, setShowIntake] = useState(elementCount === 0);
  const [intake, setIntake] = useState({ sqft: "", beds: "2", baths: "2", stories: "1", buildingType: "Single Family Residential", extras: "" });
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const chat = trpc.ai.chat.useMutation({
    onSuccess: (data) => {
      const msg: ChatMessage = {
        role: "assistant",
        content: data.message,
        sessionId: data.sessionId,
        isModelChange: data.isModelChange,
        elements: data.elements,
        codeFlags: data.codeFlags as ChatMessage["codeFlags"],
        professionalDecisions: data.professionalDecisions as ChatMessage["professionalDecisions"],
      };
      setMessages((prev) => [...prev, msg]);
      if (data.sessionId) setPendingSession(data.sessionId);
    },
    onError: (err) => toast.error(err.message),
  });

  const confirmChanges = trpc.ai.confirmChanges.useMutation({
    onSuccess: (data) => {
      toast.success(`${data.committed} element${data.committed !== 1 ? "s" : ""} committed to model`);
      setPendingSession(null);
      onElementsAdded();
    },
    onError: (err) => toast.error(err.message),
  });

  const rejectChanges = trpc.ai.rejectChanges.useMutation({
    onSuccess: () => {
      toast.info("AI suggestion rejected");
      setPendingSession(null);
    },
    onError: (err) => toast.error(err.message),
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    if (!input.trim() || chat.isPending) return;
    const userMsg: ChatMessage = { role: "user", content: input };
    setMessages((prev) => [...prev, userMsg]);
    chat.mutate({ projectId, message: input });
    setInput("");
  };

  const QUICK_PROMPTS = [
    "Add a 3-car garage on the north side",
    "Add a covered lanai 20x12 ft on the rear",
    "Check flood and wind compliance",
    "Add impact windows throughout",
    "Add a second story master suite",
    "Add a pool deck with screen enclosure",
  ];

  return (
    <div className="h-full flex flex-col bg-card">
      <div className="flex items-center gap-2 p-3 border-b border-border">
        <MessageSquare className="w-4 h-4 text-primary" />
        <span className="text-sm font-semibold text-foreground">AI Assistant</span>
        <span className="text-xs text-muted-foreground ml-auto">FBC 2023 · Ghost Preview</span>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                msg.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary/60 text-foreground border border-border"
              }`}
            >
              <p className="leading-relaxed">{msg.content}</p>

              {/* Code flags */}
              {msg.codeFlags && msg.codeFlags.length > 0 && (
                <div className="mt-2 space-y-1">
                  {msg.codeFlags.map((flag, fi) => (
                    <div
                      key={fi}
                      className={`text-xs rounded p-1.5 border ${
                        flag.severity === "error"
                          ? "bg-red-500/10 border-red-500/30 text-red-300"
                          : flag.severity === "warning"
                          ? "bg-yellow-500/10 border-yellow-500/30 text-yellow-300"
                          : "bg-blue-500/10 border-blue-500/30 text-blue-300"
                      }`}
                    >
                      <span className="font-mono">FBC {flag.fbcSection}</span> · {flag.message}
                    </div>
                  ))}
                </div>
              )}

              {/* Ghost-state confirmation */}
              {msg.isModelChange && msg.sessionId && msg.sessionId === pendingSession && (
                <div className="mt-3 p-2 bg-primary/10 border border-primary/30 rounded">
                  <p className="text-xs text-primary font-semibold mb-2">
                    ⚠ Professional Review Required
                  </p>
                  <p className="text-xs text-muted-foreground mb-2">
                    {msg.elements?.length ?? 0} element{(msg.elements?.length ?? 0) !== 1 ? "s" : ""} in ghost-state preview.
                    As the licensed professional of record, confirm to commit these changes to the model.
                  </p>
                  {msg.professionalDecisions && msg.professionalDecisions.length > 0 && (
                    <div className="mb-2 space-y-1">
                      {msg.professionalDecisions.map((pd) => (
                        <div key={pd.id} className="text-xs text-yellow-300 flex items-start gap-1">
                          <AlertTriangle className="w-3 h-3 flex-shrink-0 mt-0.5" />
                          {pd.question}
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="h-7 text-xs flex-1 gap-1"
                      onClick={() => confirmChanges.mutate({ sessionId: msg.sessionId! })}
                      disabled={confirmChanges.isPending}
                    >
                      <Check className="w-3 h-3" />
                      Confirm & Commit
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs flex-1 gap-1"
                      onClick={() => rejectChanges.mutate({ sessionId: msg.sessionId! })}
                      disabled={rejectChanges.isPending}
                    >
                      <X className="w-3 h-3" />
                      Reject
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}

        {chat.isPending && (
          <div className="flex justify-start">
            <div className="bg-secondary/60 border border-border rounded-lg px-3 py-2">
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick-start intake form — shown when model is empty */}
      {showIntake && messages.length <= 1 && (
        <div className="mx-3 mb-2 p-3 bg-primary/5 border border-primary/20 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-primary">Quick-Start: Generate Full Building</span>
            <button className="text-xs text-muted-foreground hover:text-foreground" onClick={() => setShowIntake(false)}>Skip</button>
          </div>
          <div className="grid grid-cols-2 gap-2 mb-2">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Building Type</label>
              <select
                className="w-full text-xs bg-input border border-border rounded px-2 py-1.5 text-foreground"
                value={intake.buildingType}
                onChange={(e) => setIntake((p) => ({ ...p, buildingType: e.target.value }))}
              >
                <option>Single Family Residential</option>
                <option>Duplex</option>
                <option>Townhouse</option>
                <option>Commercial Office</option>
                <option>Retail</option>
                <option>Warehouse</option>
                <option>Mixed Use</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Total Sq Ft *</label>
              <input
                type="number"
                placeholder="e.g. 1200"
                className="w-full text-xs bg-input border border-border rounded px-2 py-1.5 text-foreground"
                value={intake.sqft}
                onChange={(e) => setIntake((p) => ({ ...p, sqft: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Bedrooms</label>
              <select
                className="w-full text-xs bg-input border border-border rounded px-2 py-1.5 text-foreground"
                value={intake.beds}
                onChange={(e) => setIntake((p) => ({ ...p, beds: e.target.value }))}
              >
                {["1","2","3","4","5","6"].map((n) => <option key={n}>{n}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Bathrooms</label>
              <select
                className="w-full text-xs bg-input border border-border rounded px-2 py-1.5 text-foreground"
                value={intake.baths}
                onChange={(e) => setIntake((p) => ({ ...p, baths: e.target.value }))}
              >
                {["1","1.5","2","2.5","3","3.5","4"].map((n) => <option key={n}>{n}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Stories</label>
              <select
                className="w-full text-xs bg-input border border-border rounded px-2 py-1.5 text-foreground"
                value={intake.stories}
                onChange={(e) => setIntake((p) => ({ ...p, stories: e.target.value }))}
              >
                {["1","2","3"].map((n) => <option key={n}>{n}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Special Features</label>
              <input
                type="text"
                placeholder="e.g. open kitchen, 3-car garage"
                className="w-full text-xs bg-input border border-border rounded px-2 py-1.5 text-foreground"
                value={intake.extras}
                onChange={(e) => setIntake((p) => ({ ...p, extras: e.target.value }))}
              />
            </div>
          </div>
          <Button
            size="sm"
            className="w-full h-8 text-xs gap-1.5"
            disabled={!intake.sqft || chat.isPending}
            onClick={() => {
              const prompt = `Generate a complete ${intake.buildingType} building: ${intake.sqft} sq ft, ${intake.beds} bedroom${parseInt(intake.beds) !== 1 ? 's' : ''}, ${intake.baths} bathroom${parseFloat(intake.baths) !== 1 ? 's' : ''}, ${intake.stories} ${parseInt(intake.stories) !== 1 ? 'stories' : 'story'}${intake.extras ? ', ' + intake.extras : ''}. Generate the full floor plan with all walls, slabs, doors, windows, and roof now.`;
              const userMsg: ChatMessage = { role: "user", content: prompt };
              setMessages((prev) => [...prev, userMsg]);
              chat.mutate({ projectId, message: prompt });
              setShowIntake(false);
            }}
          >
            <Zap className="w-3 h-3" />
            Generate Full Building Now
          </Button>
        </div>
      )}

      {/* Quick prompts — shown when no intake form */}
      {!showIntake && messages.length <= 1 && (
        <div className="px-3 pb-2 flex flex-wrap gap-1.5">
          {QUICK_PROMPTS.map((p) => (
            <button
              key={p}
              className="text-xs bg-secondary/50 border border-border rounded-full px-2.5 py-1 text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
              onClick={() => setInput(p)}
            >
              {p}
            </button>
          ))}
        </div>
      )}

      <div className="p-3 border-t border-border flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
          placeholder="Ask AI to create elements or check compliance..."
          className="flex-1 bg-input border-border text-foreground text-sm h-9"
          disabled={chat.isPending}
        />
        <Button
          size="sm"
          onClick={handleSend}
          disabled={!input.trim() || chat.isPending}
          className="h-9 w-9 p-0"
        >
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

// ─── Schedules Panel ──────────────────────────────────────────────────────────

function SchedulesPanel({ projectId }: { projectId: number }) {
  const utils = trpc.useUtils();
  const { data: doors, isLoading: doorsLoading } = trpc.schedules.getDoors.useQuery({ projectId });
  const { data: windows, isLoading: windowsLoading } = trpc.schedules.getWindows.useQuery({ projectId });

  const updateEntry = trpc.schedules.updateScheduleEntry.useMutation({
    onSuccess: () => {
      utils.schedules.getDoors.invalidate({ projectId });
      utils.schedules.getWindows.invalidate({ projectId });
    },
    onError: (err) => toast.error(err.message),
  });

  const handleUpdate = (elementId: number, psetName: string, fieldName: string, value: string) => {
    updateEntry.mutate({ elementId, psetName, fieldName, value: value || null });
  };

  return (
    <div className="h-full flex flex-col bg-card">
      <div className="flex items-center gap-2 p-3 border-b border-border">
        <FileCode2 className="w-4 h-4 text-primary" />
        <span className="text-sm font-semibold text-foreground">Schedules</span>
        <span className="text-xs text-muted-foreground ml-auto">Bidirectional sync</span>
      </div>

      <div className="flex-1 overflow-auto">
        <Tabs defaultValue="doors">
          <TabsList className="w-full rounded-none border-b border-border bg-transparent">
            <TabsTrigger value="doors" className="flex-1 rounded-none data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:bg-transparent text-xs">
              Doors ({doors?.length ?? 0})
            </TabsTrigger>
            <TabsTrigger value="windows" className="flex-1 rounded-none data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:bg-transparent text-xs">
              Windows ({windows?.length ?? 0})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="doors" className="m-0">
            {doorsLoading ? (
              <div className="p-4 text-center text-xs text-muted-foreground">Loading...</div>
            ) : doors && doors.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border bg-secondary/30">
                      {["Mark", "W (in)", "H (ft)", "Material", "NOA #", "Impact", "Hardware", "Location"].map((h) => (
                        <th key={h} className="text-left px-2 py-1.5 text-muted-foreground font-medium whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {doors.map((door) => (
                      <tr key={door.id} className="border-b border-border/50 hover:bg-secondary/20">
                        <td className="px-2 py-1.5 text-foreground font-medium">{door.mark}</td>
                        <td className="px-2 py-1.5">
                          <input
                            className="w-12 bg-transparent border-b border-transparent hover:border-border focus:border-primary outline-none text-foreground"
                            defaultValue={door.width !== null ? String(Math.round((door.width ?? 0) * 39.37)) : ""}
                            onBlur={(e) => handleUpdate(door.id, "Pset_DoorCommon", "Width", String(parseFloat(e.target.value) / 39.37))}
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <input
                            className="w-12 bg-transparent border-b border-transparent hover:border-border focus:border-primary outline-none text-foreground"
                            defaultValue={door.height !== null ? String(((door.height ?? 0) * 3.281).toFixed(2)) : ""}
                            onBlur={(e) => handleUpdate(door.id, "Pset_DoorCommon", "Height", String(parseFloat(e.target.value) / 3.281))}
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <input
                            className="w-20 bg-transparent border-b border-transparent hover:border-border focus:border-primary outline-none text-foreground"
                            defaultValue={door.material ?? ""}
                            onBlur={(e) => handleUpdate(door.id, "FL_DoorProperties", "Material", e.target.value)}
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <input
                            className={`w-24 bg-transparent border-b outline-none text-foreground ${!door.noaNumber ? "border-orange-500/50" : "border-transparent hover:border-border focus:border-primary"}`}
                            defaultValue={door.noaNumber ?? ""}
                            placeholder="Required"
                            onBlur={(e) => handleUpdate(door.id, "FL_DoorProperties", "NOANumber", e.target.value)}
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <select
                            className="bg-transparent text-foreground outline-none"
                            defaultValue={door.impactRated === null ? "" : String(door.impactRated)}
                            onChange={(e) => handleUpdate(door.id, "FL_DoorProperties", "ImpactRated", e.target.value)}
                          >
                            <option value="">—</option>
                            <option value="true">Yes</option>
                            <option value="false">No</option>
                          </select>
                        </td>
                        <td className="px-2 py-1.5">
                          <input
                            className="w-16 bg-transparent border-b border-transparent hover:border-border focus:border-primary outline-none text-foreground"
                            defaultValue={door.hardwareSet ?? ""}
                            onBlur={(e) => handleUpdate(door.id, "FL_DoorProperties", "HardwareSet", e.target.value)}
                          />
                        </td>
                        <td className="px-2 py-1.5 text-muted-foreground">{door.location}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-6 text-center text-xs text-muted-foreground">No doors in model</div>
            )}
          </TabsContent>

          <TabsContent value="windows" className="m-0">
            {windowsLoading ? (
              <div className="p-4 text-center text-xs text-muted-foreground">Loading...</div>
            ) : windows && windows.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border bg-secondary/30">
                      {["Mark", "W (in)", "H (in)", "U-Factor", "SHGC", "NOA #", "Impact", "Location"].map((h) => (
                        <th key={h} className="text-left px-2 py-1.5 text-muted-foreground font-medium whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {windows.map((win) => (
                      <tr key={win.id} className="border-b border-border/50 hover:bg-secondary/20">
                        <td className="px-2 py-1.5 text-foreground font-medium">{win.mark}</td>
                        <td className="px-2 py-1.5">
                          <input
                            className="w-12 bg-transparent border-b border-transparent hover:border-border focus:border-primary outline-none text-foreground"
                            defaultValue={win.width !== null ? String(Math.round((win.width ?? 0) * 39.37)) : ""}
                            onBlur={(e) => handleUpdate(win.id, "Pset_WindowCommon", "Width", String(parseFloat(e.target.value) / 39.37))}
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <input
                            className="w-12 bg-transparent border-b border-transparent hover:border-border focus:border-primary outline-none text-foreground"
                            defaultValue={win.height !== null ? String(Math.round((win.height ?? 0) * 39.37)) : ""}
                            onBlur={(e) => handleUpdate(win.id, "Pset_WindowCommon", "Height", String(parseFloat(e.target.value) / 39.37))}
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <input
                            className="w-12 bg-transparent border-b border-transparent hover:border-border focus:border-primary outline-none text-foreground"
                            defaultValue={win.uFactor !== null ? String(win.uFactor) : ""}
                            onBlur={(e) => handleUpdate(win.id, "Pset_WindowCommon", "UFactor", e.target.value)}
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <input
                            className="w-12 bg-transparent border-b border-transparent hover:border-border focus:border-primary outline-none text-foreground"
                            defaultValue={win.shgc !== null ? String(win.shgc) : ""}
                            onBlur={(e) => handleUpdate(win.id, "Pset_WindowCommon", "SHGC", e.target.value)}
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <input
                            className={`w-24 bg-transparent border-b outline-none text-foreground ${!win.noaNumber ? "border-orange-500/50" : "border-transparent hover:border-border focus:border-primary"}`}
                            defaultValue={win.noaNumber ?? ""}
                            placeholder="Required"
                            onBlur={(e) => handleUpdate(win.id, "FL_WindowProperties", "NOANumber", e.target.value)}
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <select
                            className="bg-transparent text-foreground outline-none"
                            defaultValue={win.impactRated === null ? "" : String(win.impactRated)}
                            onChange={(e) => handleUpdate(win.id, "FL_WindowProperties", "ImpactRated", e.target.value)}
                          >
                            <option value="">—</option>
                            <option value="true">Yes</option>
                            <option value="false">No</option>
                          </select>
                        </td>
                        <td className="px-2 py-1.5 text-muted-foreground">{win.location}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-6 text-center text-xs text-muted-foreground">No windows in model</div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

// ─── Element Tree ─────────────────────────────────────────────────────────────

function ElementTree({
  elements,
  selectedId,
  onSelect,
}: {
  elements: IfcElement[];
  selectedId: number | null;
  onSelect: (id: number | null) => void;
}) {
  const grouped = elements.reduce(
    (acc, el) => {
      const cls = el.ifcClass;
      if (!acc[cls]) acc[cls] = [];
      acc[cls].push(el);
      return acc;
    },
    {} as Record<string, IfcElement[]>
  );

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const IFC_ICONS: Record<string, React.ReactNode> = {
    IfcWall: <span className="w-2 h-2 rounded-sm bg-blue-400 flex-shrink-0" />,
    IfcSlab: <span className="w-2 h-2 rounded-sm bg-yellow-600 flex-shrink-0" />,
    IfcRoof: <span className="w-2 h-2 rounded-sm bg-red-400 flex-shrink-0" />,
    IfcDoor: <span className="w-2 h-2 rounded-sm bg-green-400 flex-shrink-0" />,
    IfcWindow: <span className="w-2 h-2 rounded-sm bg-cyan-400 flex-shrink-0" />,
    IfcOpeningElement: <span className="w-2 h-2 rounded-sm bg-purple-400 flex-shrink-0" />,
  };

  return (
    <div className="h-full flex flex-col bg-card border-r border-border">
      <div className="flex items-center gap-2 p-3 border-b border-border">
        <Building2 className="w-4 h-4 text-primary" />
        <span className="text-xs font-semibold text-foreground">Elements ({elements.length})</span>
      </div>
      <div className="flex-1 overflow-y-auto p-1">
        {Object.entries(grouped).map(([cls, els]) => (
          <div key={cls}>
            <button
              className="w-full flex items-center gap-1.5 px-2 py-1 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setCollapsed((c) => ({ ...c, [cls]: !c[cls] }))}
            >
              {collapsed[cls] ? <ChevronRight className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              {IFC_ICONS[cls] ?? <span className="w-2 h-2 rounded-sm bg-gray-400 flex-shrink-0" />}
              {cls.replace("Ifc", "")} ({els.length})
            </button>
            {!collapsed[cls] &&
              els.map((el) => (
                <button
                  key={el.id}
                  className={`w-full flex items-center gap-1.5 pl-6 pr-2 py-0.5 text-xs transition-colors ${
                    selectedId === el.id
                      ? "bg-primary/15 text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary/30"
                  }`}
                  onClick={() => onSelect(el.id === selectedId ? null : el.id)}
                >
                  {el.isGhost && <span className="text-primary/60">◌</span>}
                  <span className="truncate">{el.name ?? el.globalId.substring(0, 16)}</span>
                </button>
              ))}
          </div>
        ))}
        {elements.length === 0 && (
          <div className="text-center py-6 text-xs text-muted-foreground">No elements</div>
        )}
      </div>
    </div>
  );
}

// ─── Main Viewer Page ─────────────────────────────────────────────────────────

export default function Viewer() {
  const { id } = useParams<{ id: string }>();
  const projectId = parseInt(id ?? "0");
  const [, navigate] = useLocation();
  const { isAuthenticated } = useAuth();

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [rightPanel, setRightPanel] = useState<"compliance" | "ai" | "schedules">("compliance");
  const [viewMode, setViewMode] = useState<ViewMode>("schematic");
  const [glbUrl, setGlbUrl] = useState<string | null>(null);
  const [isGeneratingGlb, setIsGeneratingGlb] = useState(false);

  const generateGlbMutation = trpc.blender.generateGLB.useMutation({
    onSuccess: (data) => {
      setGlbUrl(data.url);
      setIsGeneratingGlb(false);
      toast.success(`3D model rendered — ${data.elementCount} elements`);
    },
    onError: (err) => {
      setIsGeneratingGlb(false);
      toast.error(`Render failed: ${err.message}`);
    },
  });

  const handleGenerateGlb = () => {
    setIsGeneratingGlb(true);
    generateGlbMutation.mutate({ projectId });
  };

  const { data: project } = trpc.projects.get.useQuery(
    { id: projectId },
    { enabled: isAuthenticated && projectId > 0 }
  );

  const { data: elements, refetch: refetchElements } = trpc.ifc.getElements.useQuery(
    { projectId, includeGhost: false },
    { enabled: isAuthenticated && projectId > 0 }
  );

  const typedElements: IfcElement[] = (elements ?? []).map((e) => ({
    ...e,
    propertySets: e.propertySets as Record<string, Record<string, unknown>> | null,
  }));
  const selectedElement = typedElements.find((e) => e.id === selectedId) ?? null;

  if (!isAuthenticated) {
    navigate("/");
    return null;
  }

  return (
    <div className="h-screen flex flex-col bg-background text-foreground overflow-hidden">
      {/* Top bar */}
      <header className="h-11 border-b border-border/50 bg-card/80 flex items-center gap-2 px-3 flex-shrink-0">
        <button
          onClick={() => navigate(`/projects/${projectId}`)}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back
        </button>
        <span className="text-border">|</span>
        <Building2 className="w-4 h-4 text-primary" />
        <span className="text-sm font-semibold text-foreground">{project?.name ?? "Loading..."}</span>
        {project?.county && (
          <span className="text-xs text-muted-foreground">· {project.county}</span>
        )}
        {project?.floodZone && (
          <span className="text-xs bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded px-1.5 py-0.5">
            Zone {project.floodZone}
          </span>
        )}
        {project?.hvhz && (
          <span className="text-xs bg-orange-500/10 text-orange-400 border border-orange-500/20 rounded px-1.5 py-0.5">
            HVHZ
          </span>
        )}

        {/* View mode toggle */}
        <div className="flex items-center gap-0.5 ml-4 p-0.5 rounded" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
          {(["schematic", "3d", "2d"] as ViewMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => {
                setViewMode(mode);
                if (mode === "3d" && !glbUrl && !isGeneratingGlb && typedElements.length > 0) {
                  handleGenerateGlb();
                }
              }}
              className={`flex items-center gap-1 text-xs px-2 py-1 rounded transition-all ${
                viewMode === mode
                  ? "text-primary font-medium"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              style={viewMode === mode ? { background: "rgba(23,238,180,0.15)" } : {}}
            >
              {mode === "schematic" && <LayoutGrid className="w-3 h-3" />}
              {mode === "3d" && <Box className="w-3 h-3" />}
              {mode === "2d" && <Map className="w-3 h-3" />}
              {mode === "schematic" ? "Schematic" : mode === "3d" ? "3D Model" : "2D Plan"}
            </button>
          ))}
        </div>

        {/* Right panel toggle */}
        <div className="ml-auto flex items-center gap-1">
          {(["compliance", "ai", "schedules"] as const).map((panel) => (
            <button
              key={panel}
              onClick={() => setRightPanel(panel)}
              className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded transition-colors ${
                rightPanel === panel
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {panel === "compliance" && <Shield className="w-3.5 h-3.5" />}
              {panel === "ai" && <MessageSquare className="w-3.5 h-3.5" />}
              {panel === "schedules" && <FileCode2 className="w-3.5 h-3.5" />}
              {panel === "compliance" ? "FBC" : panel === "ai" ? "AI" : "Schedules"}
            </button>
          ))}
        </div>
      </header>

      {/* Main layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Element tree */}
        <div className="w-44 flex-shrink-0 overflow-hidden">
          <ElementTree
            elements={typedElements}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
        </div>

        {/* Center: View Canvas */}
        <div className="flex-1 overflow-hidden relative">
          {viewMode === "schematic" && (
            <IFCViewer3D
              elements={typedElements}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
          )}
          {viewMode === "3d" && (
            <Suspense fallback={
              <div className="w-full h-full flex items-center justify-center" style={{ background: "#0a0f1e" }}>
                <Loader2 className="animate-spin" style={{ color: "#17eeb4" }} />
              </div>
            }>
              <GLBViewer3D
                glbUrl={glbUrl}
                isGenerating={isGeneratingGlb}
                onRegenerate={handleGenerateGlb}
                elementCount={typedElements.length}
              />
            </Suspense>
          )}
          {viewMode === "2d" && (
            <FloorPlan2D
              elements={typedElements.map((e) => ({
                id: e.id,
                ifcClass: e.ifcClass,
                name: e.name,
                posX: e.positionX ?? null,
                posY: e.positionY ?? null,
                posZ: e.positionZ ?? null,
                width: e.width,
                height: e.height,
                depth: e.depth,
                rotation: null,
                isGhost: e.isGhost,
              }))}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
          )}
        </div>

        {/* Right: Inspector or panel */}
        <div className="w-72 flex-shrink-0 overflow-hidden flex flex-col border-l border-border">
          {selectedElement ? (
            <ElementInspector
              element={selectedElement}
              onClose={() => setSelectedId(null)}
              onUpdate={() => refetchElements()}
            />
          ) : (
            <>
              {rightPanel === "compliance" && <ComplianceSidebar projectId={projectId} />}
              {rightPanel === "ai" && (
                <AIChatPanel projectId={projectId} onElementsAdded={() => refetchElements()} elementCount={typedElements.length} />
              )}
              {rightPanel === "schedules" && <SchedulesPanel projectId={projectId} />}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
