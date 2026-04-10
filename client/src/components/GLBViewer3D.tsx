/**
 * GLBViewer3D — Three.js / react-three-fiber based 3D viewer for Blender-generated GLB models.
 * Supports orbit controls, element highlighting, and ghost-state transparency.
 */
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, Grid, OrbitControls, useGLTF } from "@react-three/drei";
import { Suspense, useEffect, useRef, useState } from "react";
import { Loader2, RotateCcw, ZoomIn, ZoomOut, Maximize2 } from "lucide-react";
import * as THREE from "three";

// ─── GLB Model Loader ─────────────────────────────────────────────────────────

function GLBModel({ url }: { url: string }) {
  const { scene } = useGLTF(url);
  const modelRef = useRef<THREE.Group>(null);

  useEffect(() => {
    if (!scene) return;
    // Center the model
    const box = new THREE.Box3().setFromObject(scene);
    const center = box.getCenter(new THREE.Vector3());
    scene.position.sub(center);
    // Ensure all meshes cast/receive shadows
    scene.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        // Enhance materials
        if (child.material instanceof THREE.MeshStandardMaterial) {
          child.material.roughness = 0.7;
          child.material.metalness = 0.1;
        }
      }
    });
  }, [scene]);

  return <primitive ref={modelRef} object={scene} />;
}

// ─── Scene Setup ──────────────────────────────────────────────────────────────

function SceneSetup() {
  const { camera } = useThree();

  useEffect(() => {
    camera.position.set(15, 12, 15);
    camera.lookAt(0, 0, 0);
  }, [camera]);

  return null;
}

// ─── Loading Fallback ─────────────────────────────────────────────────────────

function LoadingMesh() {
  const meshRef = useRef<THREE.Mesh>(null);
  useFrame((_, delta) => {
    if (meshRef.current) meshRef.current.rotation.y += delta;
  });
  return (
    <mesh ref={meshRef} position={[0, 1, 0]}>
      <boxGeometry args={[2, 2, 2]} />
      <meshStandardMaterial color="#17eeb4" wireframe />
    </mesh>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface GLBViewer3DProps {
  glbUrl: string | null;
  isGenerating?: boolean;
  onRegenerate?: () => void;
  elementCount?: number;
}

export default function GLBViewer3D({
  glbUrl,
  isGenerating = false,
  onRegenerate,
  elementCount = 0,
}: GLBViewer3DProps) {
  const [key, setKey] = useState(0);

  // Reset camera when URL changes
  useEffect(() => {
    setKey((k) => k + 1);
  }, [glbUrl]);

  return (
    <div className="relative w-full h-full" style={{ background: "#0a0f1e" }}>
      {/* Toolbar */}
      <div
        className="absolute top-3 left-3 z-10 flex items-center gap-2"
        style={{ pointerEvents: "auto" }}
      >
        <div
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium"
          style={{
            background: "rgba(15,23,42,0.85)",
            border: "1px solid rgba(23,238,180,0.25)",
            color: "#17eeb4",
            backdropFilter: "blur(8px)",
          }}
        >
          <div className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
          3D Model · {elementCount} elements
        </div>
      </div>

      {/* Regenerate button */}
      {onRegenerate && (
        <div className="absolute top-3 right-3 z-10">
          <button
            onClick={onRegenerate}
            disabled={isGenerating}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-all"
            style={{
              background: isGenerating
                ? "rgba(23,238,180,0.1)"
                : "rgba(23,238,180,0.15)",
              border: "1px solid rgba(23,238,180,0.4)",
              color: "#17eeb4",
              cursor: isGenerating ? "not-allowed" : "pointer",
            }}
          >
            {isGenerating ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <RotateCcw size={12} />
            )}
            {isGenerating ? "Rendering…" : "Re-render 3D"}
          </button>
        </div>
      )}

      {/* Controls hint */}
      <div
        className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 text-xs"
        style={{ color: "rgba(255,255,255,0.35)" }}
      >
        Left-drag: rotate · Right-drag: pan · Scroll: zoom
      </div>

      {/* Three.js Canvas */}
      {isGenerating ? (
        <div className="w-full h-full flex flex-col items-center justify-center gap-4">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center"
            style={{ background: "rgba(23,238,180,0.1)", border: "1px solid rgba(23,238,180,0.3)" }}
          >
            <Loader2 size={28} className="animate-spin" style={{ color: "#17eeb4" }} />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium" style={{ color: "#17eeb4" }}>
              Blender is rendering your model…
            </p>
            <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.4)" }}>
              This takes 15–30 seconds for complex models
            </p>
          </div>
          {/* Animated progress bar */}
          <div
            className="w-48 h-1 rounded-full overflow-hidden"
            style={{ background: "rgba(255,255,255,0.1)" }}
          >
            <div
              className="h-full rounded-full animate-pulse"
              style={{
                background: "linear-gradient(to right, #17eeb4, #2194f2)",
                width: "60%",
              }}
            />
          </div>
        </div>
      ) : !glbUrl ? (
        <div className="w-full h-full flex flex-col items-center justify-center gap-3">
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center"
            style={{ background: "rgba(33,148,242,0.1)", border: "1px solid rgba(33,148,242,0.3)" }}
          >
            <Maximize2 size={24} style={{ color: "#2194f2" }} />
          </div>
          <p className="text-sm" style={{ color: "rgba(255,255,255,0.5)" }}>
            No 3D model generated yet
          </p>
          {onRegenerate && elementCount > 0 && (
            <button
              onClick={onRegenerate}
              className="px-4 py-2 rounded text-sm font-medium transition-all"
              style={{
                background: "linear-gradient(135deg, #17eeb4, #2194f2)",
                color: "#0a0f1e",
              }}
            >
              Generate 3D Model
            </button>
          )}
          {elementCount === 0 && (
            <p className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
              Add elements first using the AI chat or IFC upload
            </p>
          )}
        </div>
      ) : (
        <Canvas
          key={key}
          shadows
          gl={{ antialias: true, alpha: false }}
          style={{ background: "#0a0f1e" }}
          camera={{ fov: 45, near: 0.1, far: 1000 }}
        >
          <SceneSetup />

          {/* Lighting */}
          <ambientLight intensity={0.4} />
          <directionalLight
            position={[20, 30, 20]}
            intensity={1.2}
            castShadow
            shadow-mapSize={[2048, 2048]}
            shadow-camera-far={200}
            shadow-camera-left={-50}
            shadow-camera-right={50}
            shadow-camera-top={50}
            shadow-camera-bottom={-50}
          />
          <directionalLight position={[-10, 10, -10]} intensity={0.4} />
          <hemisphereLight args={["#87ceeb", "#4a3728", 0.3]} />

          {/* Ground grid */}
          <Grid
            args={[100, 100]}
            cellSize={1}
            cellThickness={0.5}
            cellColor="#1e293b"
            sectionSize={5}
            sectionThickness={1}
            sectionColor="#334155"
            fadeDistance={80}
            position={[0, -0.01, 0]}
          />

          {/* GLB Model */}
          <Suspense fallback={<LoadingMesh />}>
            <GLBModel url={glbUrl} />
          </Suspense>

          {/* Camera controls */}
          <OrbitControls
            makeDefault
            enableDamping
            dampingFactor={0.05}
            minDistance={2}
            maxDistance={200}
            maxPolarAngle={Math.PI / 2 + 0.1}
          />
        </Canvas>
      )}
    </div>
  );
}
