import { useAuth } from "@/_core/hooks/useAuth";
import { runFBCChecks, type FBCViolation, type FBCCheckResult } from "@/lib/fbc-engine";
import { trpc } from "@/lib/trpc";
import { Editor, type SceneGraph, type SidebarTab, type SaveStatus } from "@pascal-app/editor";
import { useScene } from "@pascal-app/core";
import {
  AlertCircle,
  ArrowLeft,
  Building2,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Info,
  Loader2,
  Send,
  Sparkles,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useLocation, useParams } from "wouter";

// FBC engine imported from @/lib/fbc-engine

// ─── FBC Compliance Sidebar Panel ────────────────────────────────────────────

function FBCCompliancePanel() {
  const [result, setResult] = useState<FBCCheckResult>({
    violations: [],
    passCount: 0,
    warnCount: 0,
    errorCount: 0,
  });
  const [expandedCodes, setExpandedCodes] = useState<Set<string>>(new Set());

  useEffect(() => {
    // Subscribe to scene changes and run checks
    const unsubscribe = useScene.subscribe((state: { nodes: Record<string, unknown> }) => {
      const checked = runFBCChecks(state.nodes as Record<string, unknown>);
      setResult(checked);
    });
    // Run once on mount
    const initial = runFBCChecks(useScene.getState().nodes as Record<string, unknown>);
    setResult(initial);
    return unsubscribe;
  }, []);

  const toggleCode = (code: string) => {
    setExpandedCodes((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  const grouped = result.violations.reduce<Record<string, FBCViolation[]>>((acc, v) => {
    if (!acc[v.code]) acc[v.code] = [];
    acc[v.code].push(v);
    return acc;
  }, {});

  const severityIcon = (s: FBCViolation["severity"]) => {
    if (s === "error") return <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />;
    if (s === "warning") return <AlertCircle className="w-3.5 h-3.5 text-yellow-400 shrink-0" />;
    return <Info className="w-3.5 h-3.5 text-blue-400 shrink-0" />;
  };

  return (
    <div className="flex flex-col h-full overflow-hidden bg-sidebar text-foreground">
      {/* Summary bar */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border/40 shrink-0">
        <div className="flex items-center gap-1.5 text-xs">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          <span className="text-emerald-400 font-medium">{result.passCount} pass</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs">
          <AlertCircle className="w-3.5 h-3.5 text-yellow-400" />
          <span className="text-yellow-400 font-medium">{result.warnCount} warn</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs">
          <AlertCircle className="w-3.5 h-3.5 text-red-400" />
          <span className="text-red-400 font-medium">{result.errorCount} error</span>
        </div>
      </div>

      {/* Violations list */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {Object.entries(grouped).map(([code, items]) => (
          <div key={code} className="rounded-lg border border-border/30 overflow-hidden">
            <button
              className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium hover:bg-accent/30 transition-colors"
              onClick={() => toggleCode(code)}
            >
              <div className="flex items-center gap-2">
                {severityIcon(items[0].severity)}
                <span className="font-mono text-muted-foreground">{code}</span>
                <span className="text-foreground/80">{items.length} issue{items.length > 1 ? "s" : ""}</span>
              </div>
              {expandedCodes.has(code) ? (
                <ChevronDown className="w-3 h-3 text-muted-foreground" />
              ) : (
                <ChevronRight className="w-3 h-3 text-muted-foreground" />
              )}
            </button>
            {expandedCodes.has(code) && (
              <div className="px-3 pb-2 space-y-1.5">
                {items.map((v) => (
                  <div key={v.id} className="text-xs text-muted-foreground leading-relaxed pl-5">
                    {v.message}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
        {result.violations.length === 0 && result.passCount > 0 && (
          <div className="flex flex-col items-center justify-center py-8 gap-2 text-center">
            <CheckCircle2 className="w-8 h-8 text-emerald-400" />
            <p className="text-sm font-medium text-emerald-400">All checks passed</p>
            <p className="text-xs text-muted-foreground">No FBC violations detected in the current model.</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-border/40 shrink-0">
        <p className="text-[10px] text-muted-foreground/60 leading-relaxed">
          Checks run against Florida Building Code (FBC) 8th Edition. Always verify with a licensed engineer.
        </p>
      </div>
    </div>
  );
}

// ─── AI Chat Sidebar Panel ────────────────────────────────────────────────────

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  isStreaming?: boolean;
}

// ─── AI-to-Pascal scene mutation helpers ─────────────────────────────────────

interface PendingSceneChange {
  id: string;
  description: string;
  nodeType: string;
  props: Record<string, unknown>;
}

function parsePendingChanges(message: string): PendingSceneChange[] {
  // The LLM may return a JSON block tagged with ```scene-changes ... ```
  const match = message.match(/```scene-changes\s*([\s\S]*?)```/);
  if (!match) return [];
  try {
    const parsed = JSON.parse(match[1]) as unknown;
    if (Array.isArray(parsed)) return parsed as PendingSceneChange[];
  } catch {
    // ignore parse errors
  }
  return [];
}

function AIChatPanel({ projectId }: { projectId: number }) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content:
        "Hi! I'm ELEV, your BIM AI assistant. I can help you understand FBC compliance, suggest design changes, or answer questions about your model. What would you like to know?",
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [pendingChanges, setPendingChanges] = useState<PendingSceneChange[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const aiMutation = trpc.ai.chat.useMutation({
    onSuccess: (data) => {
      const changes = parsePendingChanges(data.message);
      // Strip the JSON block from the displayed message
      const displayMsg = data.message.replace(/```scene-changes[\s\S]*?```/, "").trim();
      setMessages((prev) => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (last?.role === "assistant" && last.isStreaming) {
          updated[updated.length - 1] = { role: "assistant", content: displayMsg || data.message };
        } else {
          updated.push({ role: "assistant", content: displayMsg || data.message });
        }
        return updated;
      });
      if (changes.length > 0) {
        setPendingChanges(changes);
      }
      setIsLoading(false);
    },
    onError: (err) => {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `Error: ${err.message}. Please try again.` },
      ]);
      setIsLoading(false);
    },
  });

  const applyPendingChanges = () => {
    // Apply each pending change to the Pascal scene store
    const store = useScene.getState() as unknown as {
      createNode?: (type: string, props: Record<string, unknown>) => void;
      updateNode?: (id: string, props: Record<string, unknown>) => void;
    };
    for (const change of pendingChanges) {
      if (change.id && store.updateNode) {
        store.updateNode(change.id, change.props);
      } else if (store.createNode) {
        store.createNode(change.nodeType, change.props);
      }
    }
    setPendingChanges([]);
    toast.success(`Applied ${pendingChanges.length} AI suggestion${pendingChanges.length > 1 ? "s" : ""} to the model.`);
  };

  const discardPendingChanges = () => {
    setPendingChanges([]);
    toast.info("AI suggestions discarded.");
  };

  const handleSend = () => {
    if (!input.trim() || isLoading) return;
    const userMsg = input.trim();
    setInput("");
    setIsLoading(true);

    // Get scene summary for context
    const sceneNodes = useScene.getState().nodes;
    const nodeTypes = Object.values(sceneNodes as Record<string, { type: string }>)
      .map((n) => n.type)
      .filter(Boolean);
    const typeCounts = nodeTypes.reduce<Record<string, number>>((acc, t) => {
      acc[t] = (acc[t] ?? 0) + 1;
      return acc;
    }, {});
    const sceneSummary = Object.entries(typeCounts)
      .map(([t, c]) => `${c} ${t}${c > 1 ? "s" : ""}`)
      .join(", ");

    setMessages((prev) => [
      ...prev,
      { role: "user", content: userMsg },
      { role: "assistant", content: "", isStreaming: true },
    ]);

    aiMutation.mutate({
      projectId,
      message: sceneSummary
        ? `${userMsg}\n\n[Scene context: ${sceneSummary}]`
        : userMsg,
    });
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="flex flex-col h-full overflow-hidden bg-sidebar text-foreground">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex gap-2 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}
          >
            <div
              className={`w-6 h-6 rounded-full shrink-0 flex items-center justify-center text-[10px] font-bold ${
                msg.role === "user"
                  ? "bg-primary/20 text-primary"
                  : "bg-emerald-500/20 text-emerald-400"
              }`}
            >
              {msg.role === "user" ? "U" : "AI"}
            </div>
            <div
              className={`max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed ${
                msg.role === "user"
                  ? "bg-primary/15 text-foreground"
                  : "bg-accent/30 text-foreground/90"
              }`}
            >
              {msg.isStreaming ? (
                <span className="flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Thinking...
                </span>
              ) : (
                msg.content
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Pending AI scene changes confirmation */}
      {pendingChanges.length > 0 && (
        <div className="mx-3 mb-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-2.5 shrink-0">
          <div className="flex items-center gap-1.5 mb-2">
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-xs font-medium text-emerald-400">
              {pendingChanges.length} model change{pendingChanges.length > 1 ? "s" : ""} suggested
            </span>
          </div>
          <div className="space-y-0.5 mb-2">
            {pendingChanges.slice(0, 3).map((c) => (
              <p key={c.id} className="text-[10px] text-muted-foreground pl-5 truncate">
                · {c.description}
              </p>
            ))}
            {pendingChanges.length > 3 && (
              <p className="text-[10px] text-muted-foreground pl-5">· and {pendingChanges.length - 3} more…</p>
            )}
          </div>
          <div className="flex gap-1.5">
            <button
              className="flex-1 text-[10px] font-medium rounded px-2 py-1 bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-colors"
              onClick={applyPendingChanges}
            >
              Apply to model
            </button>
            <button
              className="flex-1 text-[10px] font-medium rounded px-2 py-1 bg-accent/30 text-muted-foreground hover:bg-accent/50 transition-colors"
              onClick={discardPendingChanges}
            >
              Discard
            </button>
          </div>
        </div>
      )}

      {/* Input */}
      <div className="px-3 py-2 border-t border-border/40 shrink-0">
        <div className="flex items-end gap-2">
          <textarea
            className="flex-1 resize-none bg-accent/20 border border-border/40 rounded-lg px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary/50 min-h-[60px] max-h-[120px]"
            disabled={isLoading}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Ask about FBC compliance, design suggestions..."
            value={input}
          />
          <button
            className="w-8 h-8 rounded-lg bg-primary/20 hover:bg-primary/30 text-primary flex items-center justify-center transition-colors disabled:opacity-40"
            disabled={isLoading || !input.trim()}
            onClick={handleSend}
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main PascalViewer Component ──────────────────────────────────────────────

export default function PascalViewer() {
  const { id } = useParams<{ id: string }>();
  const projectId = parseInt(id ?? "0");
  const [, navigate] = useLocation();
  const { isAuthenticated } = useAuth();
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const utils = trpc.useUtils();

  const { data: project } = trpc.projects.get.useQuery(
    { id: projectId },
    { enabled: isAuthenticated && projectId > 0 }
  );

  const { data: sceneData, isLoading: isSceneLoading } = trpc.bim.getScene.useQuery(
    { projectId },
    { enabled: isAuthenticated && projectId > 0 }
  );

  const saveSceneMutation = trpc.bim.saveScene.useMutation({
    onError: (err) => {
      toast.error(`Failed to save scene: ${err.message}`);
    },
  });

  const handleLoad = useCallback(async (): Promise<SceneGraph | null> => {
    if (sceneData) {
      return sceneData as SceneGraph;
    }
    return null;
  }, [sceneData]);

  const handleSave = useCallback(
    async (scene: SceneGraph): Promise<void> => {
      await saveSceneMutation.mutateAsync({ projectId, sceneGraph: scene });
    },
    [projectId, saveSceneMutation]
  );

  // Sidebar tabs for v2 layout
  const sidebarTabs: (SidebarTab & { component: React.ComponentType })[] = [
    {
      id: "site",
      label: "Model",
      component: () => null, // handled by built-in site panel
    },
    {
      id: "fbc",
      label: "FBC",
      component: FBCCompliancePanel,
    },
    {
      id: "ai",
      label: "AI",
      component: () => <AIChatPanel projectId={projectId} />,
    },
    {
      id: "settings",
      label: "Settings",
      component: () => null, // handled by built-in settings panel
    },
  ];

  // Navbar slot: project info + save status + back button
  const navbarSlot = (
    <div className="h-11 flex items-center gap-2 px-3 border-b border-border/40 bg-sidebar shrink-0">
      <button
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        onClick={() => navigate(`/projects/${projectId}`)}
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Back
      </button>
      <span className="text-border/60">|</span>
      <Building2 className="w-4 h-4 text-primary" />
      <span className="text-sm font-semibold text-foreground truncate max-w-[200px]">
        {project?.name ?? "Loading..."}
      </span>
      {project?.county && (
        <span className="text-xs text-muted-foreground hidden sm:block">· {project.county}</span>
      )}
      {project?.floodZone && (
        <span className="text-xs bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded px-1.5 py-0.5 hidden sm:block">
          Zone {project.floodZone}
        </span>
      )}
      {project?.hvhz && (
        <span className="text-xs bg-orange-500/10 text-orange-400 border border-orange-500/20 rounded px-1.5 py-0.5 hidden sm:block">
          HVHZ
        </span>
      )}

      {/* Save status */}
      <div className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
        {saveStatus === "saving" && (
          <>
            <Loader2 className="w-3 h-3 animate-spin" />
            <span>Saving…</span>
          </>
        )}
        {saveStatus === "saved" && (
          <>
            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            <span className="text-emerald-400">Saved</span>
          </>
        )}
        {saveStatus === "error" && (
          <>
            <AlertCircle className="w-3 h-3 text-red-400" />
            <span className="text-red-400">Save failed</span>
          </>
        )}
        {saveStatus === "idle" && <span className="opacity-40">Auto-save on</span>}
      </div>
    </div>
  );

  if (!isAuthenticated) {
    navigate("/");
    return null;
  }

  return (
    <div className="h-screen w-screen overflow-hidden bg-sidebar">
      {isSceneLoading ? (
        <div className="h-full w-full flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Loading BIM model…</p>
          </div>
        </div>
      ) : (
        <Editor
          layoutVersion="v2"
          navbarSlot={navbarSlot}
          onLoad={handleLoad}
          onSave={handleSave}
          onSaveStatusChange={setSaveStatus}
          projectId={String(projectId)}
          sidebarTabs={sidebarTabs}
          sitePanelProps={{
            projectId: String(projectId),
          }}
        />
      )}
    </div>
  );
}
