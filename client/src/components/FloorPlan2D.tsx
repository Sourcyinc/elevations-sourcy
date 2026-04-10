import { useEffect, useRef, useState } from "react";
import { RotateCcw } from "lucide-react";

export interface IfcElement2D {
  id: number;
  ifcClass: string;
  name: string | null;
  posX: number | null;
  posY: number | null;
  posZ: number | null;
  width: number | null;
  height: number | null;
  depth: number | null;
  rotation: number | null;
  isGhost?: boolean | null;
}

// Architectural line weights and colors for 2D plan
const PLAN_STYLES: Record<string, { fill: string; stroke: string; lineWidth: number; dash?: number[] }> = {
  IfcWall:           { fill: "#1a1a1a", stroke: "#000000", lineWidth: 3 },
  IfcSlab:           { fill: "#e8e4dc", stroke: "#888888", lineWidth: 1 },
  IfcRoof:           { fill: "rgba(180,160,140,0.15)", stroke: "#aaa", lineWidth: 1, dash: [6, 4] },
  IfcDoor:           { fill: "rgba(39,174,96,0.12)", stroke: "#27ae60", lineWidth: 1.5 },
  IfcWindow:         { fill: "rgba(52,152,219,0.25)", stroke: "#3498db", lineWidth: 1.5 },
  IfcOpeningElement: { fill: "rgba(255,255,255,0.9)", stroke: "#999", lineWidth: 1, dash: [3, 3] },
  IfcBeam:           { fill: "#555", stroke: "#333", lineWidth: 2 },
  IfcColumn:         { fill: "#333", stroke: "#000", lineWidth: 2 },
  IfcFooting:        { fill: "rgba(120,100,80,0.3)", stroke: "#795548", lineWidth: 1, dash: [4, 4] },
  IfcStair:          { fill: "rgba(200,180,150,0.3)", stroke: "#8d6e63", lineWidth: 1 },
};

const SCALE_PX_PER_M = 40; // 1 meter = 40px at zoom=1

function worldToCanvas(
  wx: number, wy: number,
  cx: number, cy: number,
  zoom: number, pan: { x: number; y: number }
) {
  return {
    sx: cx + pan.x + wx * SCALE_PX_PER_M * zoom,
    sy: cy + pan.y - wy * SCALE_PX_PER_M * zoom,
  };
}

function drawDoor(
  ctx: CanvasRenderingContext2D,
  sx: number, sy: number,
  w: number, d: number,
  rot: number,
  zoom: number,
  selected: boolean,
  ghost: boolean
) {
  const scale = SCALE_PX_PER_M * zoom;
  ctx.save();
  ctx.translate(sx, sy);
  ctx.rotate(-rot * Math.PI / 180);
  ctx.globalAlpha = ghost ? 0.4 : 1;

  // Door panel
  ctx.fillStyle = selected ? "rgba(255,200,0,0.15)" : "rgba(39,174,96,0.12)";
  ctx.strokeStyle = selected ? "#ffd700" : "#27ae60";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.rect(0, -d * scale / 2, w * scale, d * scale);
  ctx.fill();
  ctx.stroke();

  // Swing arc
  ctx.strokeStyle = selected ? "#ffd700" : "#27ae60";
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 3]);
  ctx.beginPath();
  ctx.arc(0, 0, w * scale, -Math.PI / 2, 0);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.restore();
  ctx.globalAlpha = 1;
}

function drawWindow(
  ctx: CanvasRenderingContext2D,
  sx: number, sy: number,
  w: number, d: number,
  rot: number,
  zoom: number,
  selected: boolean,
  ghost: boolean
) {
  const scale = SCALE_PX_PER_M * zoom;
  ctx.save();
  ctx.translate(sx, sy);
  ctx.rotate(-rot * Math.PI / 180);
  ctx.globalAlpha = ghost ? 0.4 : 1;

  const ww = w * scale;
  const dd = Math.max(d * scale, 8);

  // Frame
  ctx.fillStyle = selected ? "rgba(255,200,0,0.2)" : "rgba(52,152,219,0.25)";
  ctx.strokeStyle = selected ? "#ffd700" : "#3498db";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.rect(0, -dd / 2, ww, dd);
  ctx.fill();
  ctx.stroke();

  // Center line (glass)
  ctx.strokeStyle = selected ? "#ffd700" : "rgba(52,152,219,0.6)";
  ctx.lineWidth = 0.75;
  ctx.beginPath();
  ctx.moveTo(0, 0); ctx.lineTo(ww, 0);
  ctx.stroke();

  ctx.restore();
  ctx.globalAlpha = 1;
}

export default function FloorPlan2D({
  elements,
  selectedId,
  onSelect,
}: {
  elements: IfcElement2D[];
  selectedId: number | null;
  onSelect: (id: number | null) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; startPan: { x: number; y: number } } | null>(null);

  // Resize canvas to container
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;
    const ro = new ResizeObserver(() => {
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
    });
    ro.observe(container);
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;
    return () => ro.disconnect();
  }, []);

  // Draw
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    // White background (paper)
    ctx.fillStyle = "#f8f7f4";
    ctx.fillRect(0, 0, W, H);

    // Grid — light gray
    ctx.strokeStyle = "#e0ddd8";
    ctx.lineWidth = 0.5;
    const gridM = 1; // 1m grid
    const gridPx = gridM * SCALE_PX_PER_M * zoom;
    const cx = W / 2;
    const cy = H / 2;
    const startX = (cx + pan.x) % gridPx;
    const startY = (cy + pan.y) % gridPx;
    for (let x = startX; x < W; x += gridPx) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    for (let y = startY; y < H; y += gridPx) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }

    // Major grid every 5m
    ctx.strokeStyle = "#ccc8c0";
    ctx.lineWidth = 0.75;
    const majorPx = 5 * SCALE_PX_PER_M * zoom;
    const mStartX = (cx + pan.x) % majorPx;
    const mStartY = (cy + pan.y) % majorPx;
    for (let x = mStartX; x < W; x += majorPx) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    for (let y = mStartY; y < H; y += majorPx) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }

    // Origin crosshair
    const { sx: ox, sy: oy } = worldToCanvas(0, 0, cx, cy, zoom, pan);
    ctx.strokeStyle = "rgba(200,0,0,0.3)";
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(ox - 12, oy); ctx.lineTo(ox + 12, oy); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(ox, oy - 12); ctx.lineTo(ox, oy + 12); ctx.stroke();

    // Sort: slabs first, then walls, then openings/doors/windows on top
    const ORDER: Record<string, number> = {
      IfcSlab: 0, IfcFooting: 1, IfcWall: 2, IfcBeam: 3, IfcColumn: 4,
      IfcRoof: 5, IfcOpeningElement: 6, IfcDoor: 7, IfcWindow: 8,
    };
    const sorted = [...elements].sort((a, b) =>
      (ORDER[a.ifcClass] ?? 5) - (ORDER[b.ifcClass] ?? 5)
    );

    for (const el of sorted) {
      const selected = el.id === selectedId;
      const ghost = el.isGhost ?? false;
      const style = PLAN_STYLES[el.ifcClass] ?? { fill: "#ccc", stroke: "#888", lineWidth: 1 };

      // Use stored coordinates or fallback to auto-layout
      const wx = el.posX ?? 0;
      const wy = el.posY ?? 0;
      const w = el.width ?? 2;
      const d = el.depth ?? 0.3;
      const rot = el.rotation ?? 0;

      const { sx, sy } = worldToCanvas(wx, wy, cx, cy, zoom, pan);
      const wPx = w * SCALE_PX_PER_M * zoom;
      const dPx = d * SCALE_PX_PER_M * zoom;

      if (el.ifcClass === "IfcDoor") {
        drawDoor(ctx, sx, sy, w, d, rot, zoom, selected, ghost);
      } else if (el.ifcClass === "IfcWindow") {
        drawWindow(ctx, sx, sy, w, d, rot, zoom, selected, ghost);
      } else {
        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(-rot * Math.PI / 180);
        ctx.globalAlpha = ghost ? 0.4 : 1;

        if (style.dash) ctx.setLineDash(style.dash);
        else ctx.setLineDash([]);

        ctx.fillStyle = selected ? "rgba(255,200,0,0.2)" : style.fill;
        ctx.strokeStyle = selected ? "#ffd700" : style.stroke;
        ctx.lineWidth = style.lineWidth * (selected ? 1.5 : 1);

        ctx.beginPath();
        ctx.rect(0, -dPx / 2, wPx, dPx);
        ctx.fill();
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
        ctx.globalAlpha = 1;
      }

      // Label for walls and slabs
      if (["IfcWall", "IfcSlab", "IfcColumn", "IfcBeam"].includes(el.ifcClass)) {
        const { sx: lx, sy: ly } = worldToCanvas(wx + w / 2, wy, cx, cy, zoom, pan);
        ctx.globalAlpha = 0.7;
        ctx.fillStyle = "#333";
        ctx.font = `${Math.max(9, 10 * zoom)}px 'Courier New', monospace`;
        ctx.textAlign = "center";
        ctx.fillText(el.name?.substring(0, 14) ?? el.ifcClass.replace("Ifc", ""), lx, ly - 4);
        ctx.textAlign = "left";
        ctx.globalAlpha = 1;
      }
    }

    // Empty state
    if (elements.length === 0) {
      ctx.fillStyle = "#aaa";
      ctx.font = "14px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("No elements to display", W / 2, H / 2 - 10);
      ctx.fillStyle = "#bbb";
      ctx.font = "12px sans-serif";
      ctx.fillText("Upload an IFC file or use AI to generate elements", W / 2, H / 2 + 14);
      ctx.textAlign = "left";
    }

    // Scale bar
    const barM = 5;
    const barPx = barM * SCALE_PX_PER_M * zoom;
    const bx = 16, by = H - 20;
    ctx.fillStyle = "#333";
    ctx.strokeStyle = "#333";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(bx, by); ctx.lineTo(bx + barPx, by);
    ctx.moveTo(bx, by - 4); ctx.lineTo(bx, by + 4);
    ctx.moveTo(bx + barPx, by - 4); ctx.lineTo(bx + barPx, by + 4);
    ctx.stroke();
    ctx.font = "10px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`${barM}m`, bx + barPx / 2, by - 6);
    ctx.textAlign = "left";

    // North arrow
    const nx = W - 30, ny = H - 50;
    ctx.fillStyle = "#333";
    ctx.strokeStyle = "#333";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(nx, ny - 18); ctx.lineTo(nx - 7, ny + 4); ctx.lineTo(nx, ny - 2); ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(nx, ny - 18); ctx.lineTo(nx + 7, ny + 4); ctx.lineTo(nx, ny - 2); ctx.closePath();
    ctx.fillStyle = "#fff";
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#333";
    ctx.font = "bold 11px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("N", nx, ny + 16);
    ctx.textAlign = "left";

  }, [elements, selectedId, zoom, pan]);

  const handleMouseDown = (e: React.MouseEvent) => {
    dragRef.current = { startX: e.clientX, startY: e.clientY, startPan: { ...pan } };
    setDragging(true);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragRef.current) return;
    setPan({
      x: dragRef.current.startPan.x + (e.clientX - dragRef.current.startX),
      y: dragRef.current.startPan.y + (e.clientY - dragRef.current.startY),
    });
  };

  const handleMouseUp = () => {
    dragRef.current = null;
    setDragging(false);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    setZoom((z) => Math.max(0.2, Math.min(5, z - e.deltaY * 0.001)));
  };

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (dragging) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;

    let closest: number | null = null;
    let minDist = 30;

    for (const el of elements) {
      const wx = el.posX ?? 0;
      const wy = el.posY ?? 0;
      const w = el.width ?? 2;
      const { sx, sy } = worldToCanvas(wx + w / 2, wy, cx, cy, zoom, pan);
      const dist = Math.sqrt((mx - sx) ** 2 + (my - sy) ** 2);
      if (dist < minDist) {
        minDist = dist;
        closest = el.id;
      }
    }
    onSelect(closest);
  };

  const fitToView = () => {
    if (elements.length === 0) { setZoom(1); setPan({ x: 0, y: 0 }); return; }
    const xs = elements.map((e) => e.posX ?? 0);
    const ys = elements.map((e) => e.posY ?? 0);
    const minX = Math.min(...xs) - 2;
    const maxX = Math.max(...xs) + 6;
    const minY = Math.min(...ys) - 2;
    const maxY = Math.max(...ys) + 6;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rangeX = maxX - minX;
    const rangeY = maxY - minY;
    const newZoom = Math.min(
      canvas.width / (rangeX * SCALE_PX_PER_M),
      canvas.height / (rangeY * SCALE_PX_PER_M),
      3
    ) * 0.85;
    setZoom(newZoom);
    setPan({
      x: -(minX + rangeX / 2) * SCALE_PX_PER_M * newZoom,
      y: (minY + rangeY / 2) * SCALE_PX_PER_M * newZoom,
    });
  };

  return (
    <div ref={containerRef} className="relative w-full h-full bg-[#f8f7f4]">
      <canvas
        ref={canvasRef}
        className="w-full h-full"
        style={{ cursor: dragging ? "grabbing" : "crosshair" }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        onClick={handleClick}
        onContextMenu={(e) => e.preventDefault()}
      />
      {/* Controls */}
      <div className="absolute bottom-3 right-3 flex flex-col gap-1.5">
        <button
          className="w-7 h-7 bg-white/90 border border-gray-300 rounded text-gray-700 text-sm flex items-center justify-center hover:bg-white shadow-sm"
          onClick={() => setZoom((z) => Math.min(5, z + 0.25))}
        >+</button>
        <button
          className="w-7 h-7 bg-white/90 border border-gray-300 rounded text-gray-700 text-sm flex items-center justify-center hover:bg-white shadow-sm"
          onClick={() => setZoom((z) => Math.max(0.2, z - 0.25))}
        >−</button>
        <button
          className="w-7 h-7 bg-white/90 border border-gray-300 rounded text-gray-700 flex items-center justify-center hover:bg-white shadow-sm"
          onClick={fitToView}
          title="Fit to view"
        ><RotateCcw className="w-3.5 h-3.5" /></button>
      </div>
      <div className="absolute bottom-3 left-3 text-xs text-gray-400">
        Drag: pan · Scroll: zoom · Click: select
      </div>
      {/* Zoom level */}
      <div className="absolute top-2 right-3 text-xs text-gray-400 bg-white/70 px-2 py-0.5 rounded">
        {Math.round(zoom * 100)}%
      </div>
    </div>
  );
}
