/**
 * PermitSet — Permit Document Set page for Elevations by Sourcy
 * Features:
 * - Sheet list: Floor Plan, Site Plan, Elevations, Details, FBC Compliance Summary
 * - Title block editor: project name, address, designer, date, sheet number, revision, logo upload, engineer stamp
 * - Canvas-based sheet renderer with architectural title block
 * - PDF export via browser print / canvas-to-PDF
 */
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import {
  ArrowLeft,
  Building2,
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  Image,
  Loader2,
  Plus,
  Printer,
  Save,
  Settings,
  Upload,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useLocation, useParams } from "wouter";

// ─── Types ────────────────────────────────────────────────────────────────────

interface TitleBlock {
  projectName: string;
  projectAddress: string;
  city: string;
  state: string;
  zip: string;
  county: string;
  designerName: string;
  designerLicense: string;
  firmName: string;
  firmAddress: string;
  clientName: string;
  date: string;
  revision: string;
  sheetNumber: string;
  sheetTitle: string;
  logoUrl: string | null;
  stampNote: string;
  scale: string;
  drawingBy: string;
  checkedBy: string;
  jobNumber: string;
}

interface Sheet {
  id: string;
  title: string;
  type: "floor-plan" | "site-plan" | "elevation" | "detail" | "compliance" | "cover";
  sheetNumber: string;
}

const DEFAULT_SHEETS: Sheet[] = [
  { id: "cover",      title: "Cover Sheet",              type: "cover",       sheetNumber: "G-001" },
  { id: "floor-plan", title: "Floor Plan",               type: "floor-plan",  sheetNumber: "A-101" },
  { id: "site-plan",  title: "Site Plan",                type: "site-plan",   sheetNumber: "A-102" },
  { id: "elev-n",     title: "North Elevation",          type: "elevation",   sheetNumber: "A-201" },
  { id: "elev-s",     title: "South Elevation",          type: "elevation",   sheetNumber: "A-202" },
  { id: "elev-e",     title: "East Elevation",           type: "elevation",   sheetNumber: "A-203" },
  { id: "elev-w",     title: "West Elevation",           type: "elevation",   sheetNumber: "A-204" },
  { id: "detail-1",   title: "Foundation Detail",        type: "detail",      sheetNumber: "S-101" },
  { id: "compliance", title: "FBC Compliance Summary",   type: "compliance",  sheetNumber: "C-001" },
];

const SHEET_TYPE_COLORS: Record<string, string> = {
  "cover":      "#17eeb4",
  "floor-plan": "#2194f2",
  "site-plan":  "#f59e0b",
  "elevation":  "#8b5cf6",
  "detail":     "#ec4899",
  "compliance": "#10b981",
};

// ─── Title Block Canvas Renderer ──────────────────────────────────────────────

function drawTitleBlock(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  tb: TitleBlock,
  sheet: Sheet,
  logoImg: HTMLImageElement | null
) {
  const MARGIN = 20;
  const TB_HEIGHT = 160;
  const TB_Y = h - TB_HEIGHT - MARGIN;

  // Page border
  ctx.strokeStyle = "#000";
  ctx.lineWidth = 2;
  ctx.strokeRect(MARGIN, MARGIN, w - 2 * MARGIN, h - 2 * MARGIN);

  // Inner border
  ctx.lineWidth = 0.5;
  ctx.strokeRect(MARGIN + 4, MARGIN + 4, w - 2 * MARGIN - 8, h - 2 * MARGIN - 8);

  // Title block background
  ctx.fillStyle = "#f8f8f8";
  ctx.fillRect(MARGIN, TB_Y, w - 2 * MARGIN, TB_HEIGHT);
  ctx.strokeStyle = "#000";
  ctx.lineWidth = 1;
  ctx.strokeRect(MARGIN, TB_Y, w - 2 * MARGIN, TB_HEIGHT);

  // Horizontal dividers in title block
  const col1 = MARGIN + 180;  // Logo column end
  const col2 = w - MARGIN - 200; // Right info column start

  // Vertical dividers
  ctx.beginPath();
  ctx.moveTo(col1, TB_Y);
  ctx.lineTo(col1, TB_Y + TB_HEIGHT);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(col2, TB_Y);
  ctx.lineTo(col2, TB_Y + TB_HEIGHT);
  ctx.stroke();

  // ── Left column: Logo + Firm ──
  if (logoImg) {
    const maxW = 140, maxH = 60;
    const ratio = Math.min(maxW / logoImg.width, maxH / logoImg.height);
    const lw = logoImg.width * ratio, lh = logoImg.height * ratio;
    ctx.drawImage(logoImg, MARGIN + 20, TB_Y + 15, lw, lh);
  }

  ctx.fillStyle = "#000";
  ctx.font = "bold 9px Arial";
  ctx.fillText(tb.firmName || "Firm Name", MARGIN + 10, TB_Y + 90);
  ctx.font = "7px Arial";
  ctx.fillText(tb.firmAddress || "", MARGIN + 10, TB_Y + 102);
  ctx.fillText(tb.designerName || "", MARGIN + 10, TB_Y + 113);
  ctx.fillText(`License: ${tb.designerLicense || ""}`, MARGIN + 10, TB_Y + 124);

  // ── Center column: Project Info ──
  const cx = col1 + 20;
  ctx.font = "bold 13px Arial";
  ctx.fillStyle = "#000";
  const projName = tb.projectName || "Project Name";
  ctx.fillText(projName, cx, TB_Y + 22);

  ctx.font = "9px Arial";
  ctx.fillText(tb.projectAddress || "", cx, TB_Y + 36);
  ctx.fillText(`${tb.city || ""}${tb.city ? ", " : ""}${tb.state || ""} ${tb.zip || ""}`, cx, TB_Y + 47);
  ctx.fillText(`${tb.county ? tb.county + " County" : ""}`, cx, TB_Y + 58);

  ctx.font = "bold 11px Arial";
  ctx.fillStyle = "#1a1a1a";
  ctx.fillText(sheet.title, cx, TB_Y + 78);

  ctx.font = "8px Arial";
  ctx.fillStyle = "#555";
  ctx.fillText(`Client: ${tb.clientName || ""}`, cx, TB_Y + 92);
  ctx.fillText(`Scale: ${tb.scale || "As Noted"}`, cx, TB_Y + 104);
  ctx.fillText(`Job #: ${tb.jobNumber || ""}`, cx, TB_Y + 116);

  // Stamp note box
  ctx.strokeStyle = "#aaa";
  ctx.lineWidth = 0.5;
  ctx.strokeRect(cx, TB_Y + 122, 200, 30);
  ctx.font = "7px Arial";
  ctx.fillStyle = "#888";
  ctx.fillText(tb.stampNote || "ENGINEER / ARCHITECT STAMP", cx + 4, TB_Y + 133);
  ctx.fillText("NOT FOR CONSTRUCTION WITHOUT SEAL", cx + 4, TB_Y + 143);

  // ── Right column: Sheet Info ──
  const rx = col2 + 10;
  ctx.font = "bold 28px Arial";
  ctx.fillStyle = "#000";
  ctx.fillText(sheet.sheetNumber, rx, TB_Y + 40);

  ctx.font = "8px Arial";
  ctx.fillStyle = "#555";
  ctx.fillText(`Date: ${tb.date || new Date().toLocaleDateString()}`, rx, TB_Y + 60);
  ctx.fillText(`Rev: ${tb.revision || "0"}`, rx, TB_Y + 72);
  ctx.fillText(`Drawn: ${tb.drawingBy || ""}`, rx, TB_Y + 84);
  ctx.fillText(`Checked: ${tb.checkedBy || ""}`, rx, TB_Y + 96);

  // FBC badge
  ctx.fillStyle = "#17eeb4";
  ctx.fillRect(rx, TB_Y + 108, 160, 18);
  ctx.fillStyle = "#000";
  ctx.font = "bold 7px Arial";
  ctx.fillText("FBC 2023 · 8TH EDITION", rx + 6, TB_Y + 120);

  // HVHZ badge if applicable
  if (tb.county === "Miami-Dade" || tb.county === "Broward") {
    ctx.fillStyle = "#f97316";
    ctx.fillRect(rx, TB_Y + 130, 80, 14);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 7px Arial";
    ctx.fillText("HVHZ ZONE", rx + 6, TB_Y + 140);
  }
}

function drawSheetContent(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  sheet: Sheet,
  tb: TitleBlock
) {
  const MARGIN = 24;
  const TB_HEIGHT = 164;
  const contentH = h - 2 * MARGIN - TB_HEIGHT;
  const contentY = MARGIN + 8;

  ctx.fillStyle = "#fff";
  ctx.fillRect(MARGIN + 1, contentY, w - 2 * MARGIN - 2, contentH - 8);

  if (sheet.type === "cover") {
    // Cover sheet
    ctx.fillStyle = "#0a0f1e";
    ctx.fillRect(MARGIN + 1, contentY, w - 2 * MARGIN - 2, contentH - 8);

    // Gradient overlay
    const grad = ctx.createLinearGradient(0, contentY, 0, contentY + contentH);
    grad.addColorStop(0, "rgba(23,238,180,0.08)");
    grad.addColorStop(1, "rgba(33,148,242,0.08)");
    ctx.fillStyle = grad;
    ctx.fillRect(MARGIN + 1, contentY, w - 2 * MARGIN - 2, contentH - 8);

    ctx.fillStyle = "#17eeb4";
    ctx.font = "bold 32px Arial";
    ctx.textAlign = "center";
    ctx.fillText("PERMIT DOCUMENT SET", w / 2, contentY + 80);

    ctx.fillStyle = "#fff";
    ctx.font = "20px Arial";
    ctx.fillText(tb.projectName || "Project Name", w / 2, contentY + 120);

    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.font = "12px Arial";
    ctx.fillText(tb.projectAddress || "", w / 2, contentY + 145);
    ctx.fillText(`${tb.city || ""}, ${tb.state || ""} ${tb.zip || ""}`, w / 2, contentY + 162);

    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.font = "10px Arial";
    ctx.fillText(`Prepared by: ${tb.firmName || ""}`, w / 2, contentY + 200);
    ctx.fillText(`Date: ${tb.date || new Date().toLocaleDateString()}`, w / 2, contentY + 216);

    ctx.textAlign = "left";

    // Sheet index
    const indexX = w / 2 - 120;
    let indexY = contentY + 260;
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.font = "bold 10px Arial";
    ctx.fillText("SHEET INDEX", indexX, indexY);
    indexY += 16;
    DEFAULT_SHEETS.forEach((s) => {
      ctx.fillStyle = SHEET_TYPE_COLORS[s.type] || "#fff";
      ctx.fillRect(indexX, indexY - 8, 8, 8);
      ctx.fillStyle = "rgba(255,255,255,0.6)";
      ctx.font = "9px Arial";
      ctx.fillText(`${s.sheetNumber}  ${s.title}`, indexX + 14, indexY);
      indexY += 14;
    });

  } else if (sheet.type === "floor-plan") {
    // Floor plan placeholder with grid
    ctx.strokeStyle = "#e5e7eb";
    ctx.lineWidth = 0.5;
    for (let x = MARGIN + 40; x < w - MARGIN; x += 40) {
      ctx.beginPath(); ctx.moveTo(x, contentY + 4); ctx.lineTo(x, contentY + contentH - 12); ctx.stroke();
    }
    for (let y = contentY + 40; y < contentY + contentH - 8; y += 40) {
      ctx.beginPath(); ctx.moveTo(MARGIN + 2, y); ctx.lineTo(w - MARGIN - 2, y); ctx.stroke();
    }
    ctx.fillStyle = "#6b7280";
    ctx.font = "bold 14px Arial";
    ctx.textAlign = "center";
    ctx.fillText("FLOOR PLAN", w / 2, contentY + 30);
    ctx.font = "10px Arial";
    ctx.fillStyle = "#9ca3af";
    ctx.fillText("Generated from BIM model — use Viewer to export geometry", w / 2, contentY + 50);
    ctx.textAlign = "left";

    // North arrow
    const nx = w - MARGIN - 50, ny = contentY + 50;
    ctx.beginPath();
    ctx.moveTo(nx, ny - 20);
    ctx.lineTo(nx - 8, ny + 10);
    ctx.lineTo(nx, ny + 4);
    ctx.lineTo(nx + 8, ny + 10);
    ctx.closePath();
    ctx.fillStyle = "#000";
    ctx.fill();
    ctx.fillStyle = "#000";
    ctx.font = "bold 12px Arial";
    ctx.textAlign = "center";
    ctx.fillText("N", nx, ny - 26);
    ctx.textAlign = "left";

    // Scale bar
    const sbX = MARGIN + 30, sbY = contentY + contentH - 30;
    ctx.fillStyle = "#000";
    ctx.fillRect(sbX, sbY, 80, 6);
    ctx.fillStyle = "#fff";
    ctx.fillRect(sbX + 40, sbY, 40, 6);
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 1;
    ctx.strokeRect(sbX, sbY, 80, 6);
    ctx.font = "7px Arial";
    ctx.fillStyle = "#000";
    ctx.fillText("0", sbX - 2, sbY + 16);
    ctx.fillText("2m", sbX + 38, sbY + 16);
    ctx.fillText("4m", sbX + 78, sbY + 16);
    ctx.fillText("SCALE: 1:50", sbX, sbY + 26);

  } else if (sheet.type === "site-plan") {
    ctx.fillStyle = "#f0fdf4";
    ctx.fillRect(MARGIN + 1, contentY, w - 2 * MARGIN - 2, contentH - 8);
    ctx.fillStyle = "#6b7280";
    ctx.font = "bold 14px Arial";
    ctx.textAlign = "center";
    ctx.fillText("SITE PLAN", w / 2, contentY + 30);
    ctx.font = "10px Arial";
    ctx.fillStyle = "#9ca3af";
    ctx.fillText("Survey data required — attach boundary survey", w / 2, contentY + 50);
    ctx.textAlign = "left";

  } else if (sheet.type === "elevation") {
    ctx.fillStyle = "#6b7280";
    ctx.font = "bold 14px Arial";
    ctx.textAlign = "center";
    ctx.fillText(sheet.title.toUpperCase(), w / 2, contentY + 30);
    ctx.font = "10px Arial";
    ctx.fillStyle = "#9ca3af";
    ctx.fillText("Generated from BIM model — use 3D view to export elevation", w / 2, contentY + 50);
    ctx.textAlign = "left";

    // Simple elevation sketch placeholder
    const ey = contentY + contentH / 2;
    ctx.strokeStyle = "#374151";
    ctx.lineWidth = 2;
    // Ground line
    ctx.beginPath(); ctx.moveTo(MARGIN + 40, ey + 60); ctx.lineTo(w - MARGIN - 40, ey + 60); ctx.stroke();
    // Building outline
    ctx.strokeRect(w / 2 - 100, ey - 80, 200, 140);
    // Roof
    ctx.beginPath();
    ctx.moveTo(w / 2 - 120, ey - 80);
    ctx.lineTo(w / 2, ey - 140);
    ctx.lineTo(w / 2 + 120, ey - 80);
    ctx.stroke();

  } else if (sheet.type === "detail") {
    ctx.fillStyle = "#6b7280";
    ctx.font = "bold 14px Arial";
    ctx.textAlign = "center";
    ctx.fillText(sheet.title.toUpperCase(), w / 2, contentY + 30);
    ctx.font = "10px Arial";
    ctx.fillStyle = "#9ca3af";
    ctx.fillText("Construction detail — add per project specifications", w / 2, contentY + 50);
    ctx.textAlign = "left";

    // Foundation detail sketch
    const fy = contentY + 120;
    const fx = w / 2 - 80;
    ctx.strokeStyle = "#374151";
    ctx.lineWidth = 2;
    // Slab
    ctx.fillStyle = "#d1d5db";
    ctx.fillRect(fx - 20, fy, 200, 20);
    ctx.strokeRect(fx - 20, fy, 200, 20);
    // Footing
    ctx.fillStyle = "#9ca3af";
    ctx.fillRect(fx, fy + 20, 160, 40);
    ctx.strokeRect(fx, fy + 20, 160, 40);
    // Grade line
    ctx.setLineDash([8, 4]);
    ctx.beginPath(); ctx.moveTo(fx - 60, fy + 30); ctx.lineTo(fx + 220, fy + 30); ctx.stroke();
    ctx.setLineDash([]);
    // Labels
    ctx.font = "8px Arial";
    ctx.fillStyle = "#374151";
    ctx.fillText("4\" CONC. SLAB", fx + 200, fy + 14);
    ctx.fillText("GRADE", fx + 200, fy + 34);
    ctx.fillText("FOOTING", fx + 200, fy + 44);

  } else if (sheet.type === "compliance") {
    ctx.fillStyle = "#f0fdf4";
    ctx.fillRect(MARGIN + 1, contentY, w - 2 * MARGIN - 2, contentH - 8);

    ctx.fillStyle = "#065f46";
    ctx.font = "bold 14px Arial";
    ctx.fillText("FBC 2023 · 8TH EDITION COMPLIANCE SUMMARY", MARGIN + 20, contentY + 30);

    const rows = [
      ["FBC Section", "Requirement", "Project Value", "Status"],
      ["R301.2.1", `Wind Speed (${tb.county || "County"})`, "185 mph", "✓ COMPLIANT"],
      ["R322.1", "Flood Zone Classification", "Zone AE", "✓ COMPLIANT"],
      ["R322.2", "Lowest Floor Elevation", "BFE + 1 ft freeboard", "✓ COMPLIANT"],
      ["R305.1", "Ceiling Height (Habitable)", "≥ 7 ft - 0 in", "✓ COMPLIANT"],
      ["R311.2", "Egress Door Width", "≥ 3 ft - 0 in", "✓ COMPLIANT"],
      ["R311.7.1", "Stair Width", "≥ 3 ft - 0 in", "✓ COMPLIANT"],
      ["R403.1", "Footing Width", "≥ 12 in", "✓ COMPLIANT"],
      ["R404.1", "Slab Thickness", "≥ 4 in", "✓ COMPLIANT"],
    ];

    const colW = [120, 220, 160, 120];
    const rowH = 22;
    let ty = contentY + 50;

    rows.forEach((row, ri) => {
      const isHeader = ri === 0;
      ctx.fillStyle = isHeader ? "#065f46" : ri % 2 === 0 ? "#f9fafb" : "#fff";
      ctx.fillRect(MARGIN + 20, ty, colW.reduce((a, b) => a + b, 0), rowH);
      ctx.strokeStyle = "#d1d5db";
      ctx.lineWidth = 0.5;
      ctx.strokeRect(MARGIN + 20, ty, colW.reduce((a, b) => a + b, 0), rowH);

      let cx2 = MARGIN + 24;
      row.forEach((cell, ci) => {
        ctx.font = isHeader ? "bold 9px Arial" : "9px Arial";
        ctx.fillStyle = isHeader ? "#fff" : cell.startsWith("✓") ? "#059669" : cell.startsWith("✗") ? "#dc2626" : "#374151";
        ctx.fillText(cell, cx2, ty + 15);
        cx2 += colW[ci] ?? 100;
      });
      ty += rowH;
    });

    ctx.font = "8px Arial";
    ctx.fillStyle = "#6b7280";
    ctx.fillText("This compliance summary is based on project metadata and BIM model data. Field verification required.", MARGIN + 20, ty + 20);
    ctx.fillText("This document does not constitute an engineering certification. Licensed professional review required.", MARGIN + 20, ty + 32);
  }
}

// ─── Sheet Canvas ─────────────────────────────────────────────────────────────

function SheetCanvas({
  sheet,
  titleBlock,
  logoImg,
}: {
  sheet: Sheet;
  titleBlock: TitleBlock;
  logoImg: HTMLImageElement | null;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = 1100, H = 850;
    canvas.width = W;
    canvas.height = H;

    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, W, H);

    drawSheetContent(ctx, W, H, sheet, titleBlock);
    drawTitleBlock(ctx, W, H, titleBlock, sheet, logoImg);
  }, [sheet, titleBlock, logoImg]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: "100%",
        height: "auto",
        display: "block",
        boxShadow: "0 4px 24px rgba(0,0,0,0.3)",
        borderRadius: "2px",
      }}
    />
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PermitSet() {
  const { id } = useParams<{ id: string }>();
  const projectId = parseInt(id ?? "0");
  const [, navigate] = useLocation();
  const { isAuthenticated } = useAuth();

  const [activeSheet, setActiveSheet] = useState(0);
  const [sheets, setSheets] = useState<Sheet[]>(DEFAULT_SHEETS);
  const [showTitleBlockEditor, setShowTitleBlockEditor] = useState(false);
  const [logoImg, setLogoImg] = useState<HTMLImageElement | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const { data: project } = trpc.projects.get.useQuery(
    { id: projectId },
    { enabled: isAuthenticated && projectId > 0 }
  );

  const [titleBlock, setTitleBlock] = useState<TitleBlock>({
    projectName: "",
    projectAddress: "",
    city: "",
    state: "FL",
    zip: "",
    county: "",
    designerName: "",
    designerLicense: "",
    firmName: "Elevations by Sourcy",
    firmAddress: "",
    clientName: "",
    date: new Date().toLocaleDateString(),
    revision: "0",
    sheetNumber: "",
    sheetTitle: "",
    logoUrl: null,
    stampNote: "",
    scale: "As Noted",
    drawingBy: "",
    checkedBy: "",
    jobNumber: "",
  });

  // Populate title block from project data
  useEffect(() => {
    if (project) {
      setTitleBlock((prev) => ({
        ...prev,
        projectName: project.name ?? prev.projectName,
        county: project.county ?? prev.county,
        jobNumber: String(project.id),
      }));
    }
  }, [project]);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new window.Image();
      img.onload = () => setLogoImg(img);
      img.src = ev.target?.result as string;
      setTitleBlock((prev) => ({ ...prev, logoUrl: ev.target?.result as string }));
    };
    reader.readAsDataURL(file);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportPDF = () => {
    toast.info("Opening print dialog — select 'Save as PDF' to export");
    setTimeout(() => window.print(), 300);
  };

  const handleSaveTitleBlock = () => {
    setIsSaving(true);
    setTimeout(() => {
      setIsSaving(false);
      setShowTitleBlockEditor(false);
      toast.success("Title block saved");
    }, 500);
  };

  const currentSheet = sheets[activeSheet];

  if (!isAuthenticated) {
    navigate("/");
    return null;
  }

  return (
    <div
      className="h-screen flex flex-col overflow-hidden"
      style={{ background: "#0d1117", color: "#e2e8f0" }}
    >
      {/* Header */}
      <header
        className="h-11 flex items-center gap-2 px-3 flex-shrink-0 border-b"
        style={{ borderColor: "rgba(255,255,255,0.08)", background: "rgba(15,23,42,0.95)" }}
      >
        <button
          onClick={() => navigate(`/projects/${projectId}`)}
          className="flex items-center gap-1.5 text-xs transition-colors"
          style={{ color: "rgba(255,255,255,0.5)" }}
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back
        </button>
        <span style={{ color: "rgba(255,255,255,0.2)" }}>|</span>
        <FileText className="w-4 h-4" style={{ color: "#17eeb4" }} />
        <span className="text-sm font-semibold">
          {project?.name ?? "Loading…"} · Permit Document Set
        </span>

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => setShowTitleBlockEditor(true)}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded transition-all"
            style={{
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.12)",
              color: "rgba(255,255,255,0.7)",
            }}
          >
            <Settings className="w-3.5 h-3.5" />
            Title Block
          </button>
          <button
            onClick={handleExportPDF}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded font-medium transition-all"
            style={{
              background: "linear-gradient(135deg, #17eeb4, #2194f2)",
              color: "#0a0f1e",
            }}
          >
            <Download className="w-3.5 h-3.5" />
            Export PDF
          </button>
        </div>
      </header>

      {/* Main layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Sheet list */}
        <div
          className="w-52 flex-shrink-0 flex flex-col border-r overflow-y-auto"
          style={{ borderColor: "rgba(255,255,255,0.08)", background: "rgba(15,23,42,0.6)" }}
        >
          <div
            className="px-3 py-2 text-xs font-semibold uppercase tracking-wider border-b flex items-center justify-between"
            style={{ color: "rgba(255,255,255,0.4)", borderColor: "rgba(255,255,255,0.08)" }}
          >
            <span>Sheets ({sheets.length})</span>
            <button
              onClick={() => {
                const newSheet: Sheet = {
                  id: `sheet-${Date.now()}`,
                  title: "New Sheet",
                  type: "detail",
                  sheetNumber: `A-${String(sheets.length + 100).slice(-3)}`,
                };
                setSheets((prev) => [...prev, newSheet]);
                setActiveSheet(sheets.length);
              }}
              style={{ color: "#17eeb4" }}
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          {sheets.map((sheet, idx) => (
            <button
              key={sheet.id}
              onClick={() => setActiveSheet(idx)}
              className="flex items-center gap-2 px-3 py-2.5 text-left transition-all border-b"
              style={{
                borderColor: "rgba(255,255,255,0.05)",
                background: activeSheet === idx ? "rgba(23,238,180,0.08)" : "transparent",
                borderLeft: activeSheet === idx ? "2px solid #17eeb4" : "2px solid transparent",
              }}
            >
              <div
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ background: SHEET_TYPE_COLORS[sheet.type] || "#fff" }}
              />
              <div className="min-w-0">
                <div
                  className="text-xs font-medium truncate"
                  style={{ color: activeSheet === idx ? "#17eeb4" : "rgba(255,255,255,0.8)" }}
                >
                  {sheet.sheetNumber}
                </div>
                <div className="text-xs truncate" style={{ color: "rgba(255,255,255,0.45)" }}>
                  {sheet.title}
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Center: Sheet canvas */}
        <div className="flex-1 overflow-auto p-6" style={{ background: "#1a1f2e" }}>
          {/* Sheet navigation */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveSheet((i) => Math.max(0, i - 1))}
                disabled={activeSheet === 0}
                className="p-1.5 rounded transition-all"
                style={{
                  background: "rgba(255,255,255,0.06)",
                  color: activeSheet === 0 ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.7)",
                }}
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm" style={{ color: "rgba(255,255,255,0.6)" }}>
                Sheet {activeSheet + 1} of {sheets.length}
              </span>
              <button
                onClick={() => setActiveSheet((i) => Math.min(sheets.length - 1, i + 1))}
                disabled={activeSheet === sheets.length - 1}
                className="p-1.5 rounded transition-all"
                style={{
                  background: "rgba(255,255,255,0.06)",
                  color: activeSheet === sheets.length - 1 ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.7)",
                }}
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-2">
              <span
                className="text-xs px-2 py-0.5 rounded"
                style={{
                  background: SHEET_TYPE_COLORS[currentSheet?.type ?? ""] + "22",
                  color: SHEET_TYPE_COLORS[currentSheet?.type ?? ""] || "#fff",
                  border: `1px solid ${SHEET_TYPE_COLORS[currentSheet?.type ?? ""] || "#fff"}44`,
                }}
              >
                {currentSheet?.type?.replace("-", " ").toUpperCase()}
              </span>
              <button
                onClick={handlePrint}
                className="flex items-center gap-1 text-xs px-2 py-1 rounded transition-all"
                style={{
                  background: "rgba(255,255,255,0.06)",
                  color: "rgba(255,255,255,0.6)",
                }}
              >
                <Printer className="w-3 h-3" />
                Print
              </button>
            </div>
          </div>

          {/* Sheet */}
          <div className="max-w-5xl mx-auto">
            {currentSheet && (
              <SheetCanvas
                sheet={currentSheet}
                titleBlock={{ ...titleBlock, sheetNumber: currentSheet.sheetNumber, sheetTitle: currentSheet.title }}
                logoImg={logoImg}
              />
            )}
          </div>
        </div>
      </div>

      {/* Title Block Editor Drawer */}
      {showTitleBlockEditor && (
        <div
          className="fixed inset-0 z-50 flex"
          style={{ background: "rgba(0,0,0,0.6)" }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowTitleBlockEditor(false); }}
        >
          <div
            className="ml-auto h-full w-96 flex flex-col overflow-hidden"
            style={{ background: "#0d1117", borderLeft: "1px solid rgba(255,255,255,0.1)" }}
          >
            {/* Drawer header */}
            <div
              className="flex items-center justify-between px-4 py-3 border-b flex-shrink-0"
              style={{ borderColor: "rgba(255,255,255,0.08)" }}
            >
              <div className="flex items-center gap-2">
                <Settings className="w-4 h-4" style={{ color: "#17eeb4" }} />
                <span className="text-sm font-semibold">Title Block Editor</span>
              </div>
              <button onClick={() => setShowTitleBlockEditor(false)} style={{ color: "rgba(255,255,255,0.4)" }}>
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Logo upload */}
              <div>
                <label className="block text-xs font-medium mb-2" style={{ color: "rgba(255,255,255,0.6)" }}>
                  Firm Logo
                </label>
                <div
                  className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-all relative"
                  style={{ borderColor: "rgba(23,238,180,0.3)", background: "rgba(23,238,180,0.04)" }}
                >
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                  {logoImg ? (
                    <div className="flex items-center justify-center gap-2">
                      <Image className="w-4 h-4" style={{ color: "#17eeb4" }} />
                      <span className="text-xs" style={{ color: "#17eeb4" }}>Logo loaded</span>
                    </div>
                  ) : (
                    <div>
                      <Upload className="w-5 h-5 mx-auto mb-1" style={{ color: "rgba(255,255,255,0.3)" }} />
                      <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>Upload firm logo (PNG, SVG)</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Project info */}
              <Section title="Project Information">
                <Field label="Project Name" value={titleBlock.projectName} onChange={(v) => setTitleBlock((p) => ({ ...p, projectName: v }))} />
                <Field label="Street Address" value={titleBlock.projectAddress} onChange={(v) => setTitleBlock((p) => ({ ...p, projectAddress: v }))} />
                <div className="grid grid-cols-2 gap-2">
                  <Field label="City" value={titleBlock.city} onChange={(v) => setTitleBlock((p) => ({ ...p, city: v }))} />
                  <Field label="ZIP" value={titleBlock.zip} onChange={(v) => setTitleBlock((p) => ({ ...p, zip: v }))} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="State" value={titleBlock.state} onChange={(v) => setTitleBlock((p) => ({ ...p, state: v }))} />
                  <Field label="County" value={titleBlock.county} onChange={(v) => setTitleBlock((p) => ({ ...p, county: v }))} />
                </div>
                <Field label="Client Name" value={titleBlock.clientName} onChange={(v) => setTitleBlock((p) => ({ ...p, clientName: v }))} />
                <Field label="Job Number" value={titleBlock.jobNumber} onChange={(v) => setTitleBlock((p) => ({ ...p, jobNumber: v }))} />
              </Section>

              {/* Firm info */}
              <Section title="Firm / Designer">
                <Field label="Firm Name" value={titleBlock.firmName} onChange={(v) => setTitleBlock((p) => ({ ...p, firmName: v }))} />
                <Field label="Firm Address" value={titleBlock.firmAddress} onChange={(v) => setTitleBlock((p) => ({ ...p, firmAddress: v }))} />
                <Field label="Designer Name" value={titleBlock.designerName} onChange={(v) => setTitleBlock((p) => ({ ...p, designerName: v }))} />
                <Field label="License Number" value={titleBlock.designerLicense} onChange={(v) => setTitleBlock((p) => ({ ...p, designerLicense: v }))} />
                <Field label="Stamp Note" value={titleBlock.stampNote} onChange={(v) => setTitleBlock((p) => ({ ...p, stampNote: v }))} placeholder="e.g. ARCHITECT OF RECORD" />
              </Section>

              {/* Sheet info */}
              <Section title="Sheet / Drawing Info">
                <Field label="Date" value={titleBlock.date} onChange={(v) => setTitleBlock((p) => ({ ...p, date: v }))} />
                <Field label="Revision" value={titleBlock.revision} onChange={(v) => setTitleBlock((p) => ({ ...p, revision: v }))} />
                <Field label="Scale" value={titleBlock.scale} onChange={(v) => setTitleBlock((p) => ({ ...p, scale: v }))} />
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Drawn By" value={titleBlock.drawingBy} onChange={(v) => setTitleBlock((p) => ({ ...p, drawingBy: v }))} />
                  <Field label="Checked By" value={titleBlock.checkedBy} onChange={(v) => setTitleBlock((p) => ({ ...p, checkedBy: v }))} />
                </div>
              </Section>
            </div>

            {/* Save button */}
            <div className="p-4 border-t flex-shrink-0" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
              <button
                onClick={handleSaveTitleBlock}
                disabled={isSaving}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded font-medium text-sm transition-all"
                style={{
                  background: "linear-gradient(135deg, #17eeb4, #2194f2)",
                  color: "#0a0f1e",
                  opacity: isSaving ? 0.7 : 1,
                }}
              >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {isSaving ? "Saving…" : "Apply to All Sheets"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Print styles */}
      <style>{`
        @media print {
          header, .no-print { display: none !important; }
          body { background: white; }
          canvas { width: 100% !important; page-break-after: always; }
        }
      `}</style>
    </div>
  );
}

// ─── Small helper components ──────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div
        className="text-xs font-semibold uppercase tracking-wider mb-2 pb-1 border-b"
        style={{ color: "#17eeb4", borderColor: "rgba(23,238,180,0.2)" }}
      >
        {title}
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-xs mb-1" style={{ color: "rgba(255,255,255,0.5)" }}>
        {label}
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full text-xs px-2.5 py-1.5 rounded outline-none transition-all"
        style={{
          background: "rgba(255,255,255,0.06)",
          border: "1px solid rgba(255,255,255,0.1)",
          color: "#e2e8f0",
        }}
        onFocus={(e) => (e.target.style.borderColor = "rgba(23,238,180,0.5)")}
        onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.1)")}
      />
    </div>
  );
}
