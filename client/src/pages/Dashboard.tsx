import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import {
  AlertTriangle,
  Building2,
  ChevronRight,
  Clock,
  FileCode2,
  FolderOpen,
  LogOut,
  MapPin,
  Plus,
  Wind,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

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

const FLOOD_ZONES = ["AE", "VE", "X", "AH", "AO", "A"];
const OCCUPANCY_TYPES = ["R-3", "R-2", "A-2", "A-3", "B", "E", "I-1", "I-2", "M", "S-1"];
const CONSTRUCTION_TYPES = ["IA", "IB", "IIA", "IIB", "IIIA", "IIIB", "IV", "VA", "VB"];

function CreateProjectModal({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    description: "",
    county: "",
    floodZone: "",
    bfe: "",
    hvhz: false,
    windSpeedMph: "",
    occupancyType: "",
    constructionType: "",
    stories: "1",
    conditionedAreaSf: "",
  });

  const createProject = trpc.projects.create.useMutation({
    onSuccess: () => {
      toast.success("Project created successfully");
      setOpen(false);
      onCreated();
    },
    onError: (err) => toast.error(err.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    createProject.mutate({
      name: form.name,
      description: form.description || undefined,
      county: form.county || undefined,
      floodZone: form.floodZone || undefined,
      bfe: form.bfe ? parseFloat(form.bfe) : undefined,
      hvhz: form.hvhz,
      windSpeedMph: form.windSpeedMph ? parseInt(form.windSpeedMph) : undefined,
      occupancyType: form.occupancyType || undefined,
      constructionType: form.constructionType || undefined,
      stories: form.stories ? parseInt(form.stories) : undefined,
      conditionedAreaSf: form.conditionedAreaSf ? parseFloat(form.conditionedAreaSf) : undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="w-4 h-4" />
          New Project
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-foreground">Create New BIM Project</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div>
            <Label className="text-foreground text-sm">Project Name *</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Smith Residence Addition"
              className="mt-1 bg-input border-border text-foreground"
              required
            />
          </div>
          <div>
            <Label className="text-foreground text-sm">Description</Label>
            <Textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Project description..."
              className="mt-1 bg-input border-border text-foreground resize-none"
              rows={2}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-foreground text-sm">County</Label>
              <Select value={form.county} onValueChange={(v) => setForm((f) => ({ ...f, county: v }))}>
                <SelectTrigger className="mt-1 bg-input border-border text-foreground">
                  <SelectValue placeholder="Select county" />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  {COUNTIES.map((c) => (
                    <SelectItem key={c} value={c} className="text-foreground">
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-foreground text-sm">Flood Zone</Label>
              <Select value={form.floodZone} onValueChange={(v) => setForm((f) => ({ ...f, floodZone: v }))}>
                <SelectTrigger className="mt-1 bg-input border-border text-foreground">
                  <SelectValue placeholder="Select zone" />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  {FLOOD_ZONES.map((z) => (
                    <SelectItem key={z} value={z} className="text-foreground">
                      Zone {z}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-foreground text-sm">BFE (ft NAVD)</Label>
              <Input
                type="number"
                step="0.1"
                value={form.bfe}
                onChange={(e) => setForm((f) => ({ ...f, bfe: e.target.value }))}
                placeholder="e.g. 8.0"
                className="mt-1 bg-input border-border text-foreground"
              />
            </div>
            <div>
              <Label className="text-foreground text-sm">Wind Speed (mph)</Label>
              <Input
                type="number"
                value={form.windSpeedMph}
                onChange={(e) => setForm((f) => ({ ...f, windSpeedMph: e.target.value }))}
                placeholder="e.g. 155"
                className="mt-1 bg-input border-border text-foreground"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-foreground text-sm">Occupancy Type</Label>
              <Select value={form.occupancyType} onValueChange={(v) => setForm((f) => ({ ...f, occupancyType: v }))}>
                <SelectTrigger className="mt-1 bg-input border-border text-foreground">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  {OCCUPANCY_TYPES.map((t) => (
                    <SelectItem key={t} value={t} className="text-foreground">
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-foreground text-sm">Construction Type</Label>
              <Select value={form.constructionType} onValueChange={(v) => setForm((f) => ({ ...f, constructionType: v }))}>
                <SelectTrigger className="mt-1 bg-input border-border text-foreground">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  {CONSTRUCTION_TYPES.map((t) => (
                    <SelectItem key={t} value={t} className="text-foreground">
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-foreground text-sm">Stories</Label>
              <Input
                type="number"
                min="1"
                max="10"
                value={form.stories}
                onChange={(e) => setForm((f) => ({ ...f, stories: e.target.value }))}
                className="mt-1 bg-input border-border text-foreground"
              />
            </div>
            <div>
              <Label className="text-foreground text-sm">Conditioned Area (SF)</Label>
              <Input
                type="number"
                value={form.conditionedAreaSf}
                onChange={(e) => setForm((f) => ({ ...f, conditionedAreaSf: e.target.value }))}
                placeholder="e.g. 1200"
                className="mt-1 bg-input border-border text-foreground"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="hvhz"
              checked={form.hvhz}
              onChange={(e) => setForm((f) => ({ ...f, hvhz: e.target.checked }))}
              className="w-4 h-4 accent-primary"
            />
            <Label htmlFor="hvhz" className="text-foreground text-sm cursor-pointer">
              HVHZ (High Velocity Hurricane Zone — Miami-Dade / Broward)
            </Label>
          </div>
          <Button type="submit" className="w-full" disabled={createProject.isPending}>
            {createProject.isPending ? "Creating..." : "Create Project"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ProjectCard({ project }: { project: { id: number; name: string; description: string | null; county: string | null; floodZone: string | null; windSpeedMph: number | null; hvhz: boolean | null; createdAt: Date } }) {
  const [, navigate] = useLocation();
  return (
    <Card
      className="bg-card border-border hover:border-primary/40 transition-all cursor-pointer group"
      onClick={() => navigate(`/projects/${project.id}`)}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-1">
            {project.name}
          </CardTitle>
          <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0 mt-0.5" />
        </div>
        {project.description && (
          <p className="text-xs text-muted-foreground line-clamp-2">{project.description}</p>
        )}
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex flex-wrap gap-2 mt-2">
          {project.county && (
            <span className="inline-flex items-center gap-1 text-xs bg-secondary/60 text-secondary-foreground rounded px-2 py-0.5">
              <MapPin className="w-3 h-3" />
              {project.county}
            </span>
          )}
          {project.floodZone && (
            <span className="inline-flex items-center gap-1 text-xs bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded px-2 py-0.5">
              Zone {project.floodZone}
            </span>
          )}
          {project.windSpeedMph && (
            <span className="inline-flex items-center gap-1 text-xs bg-secondary/60 text-secondary-foreground rounded px-2 py-0.5">
              <Wind className="w-3 h-3" />
              {project.windSpeedMph} mph
            </span>
          )}
          {project.hvhz && (
            <span className="inline-flex items-center gap-1 text-xs bg-orange-500/10 text-orange-400 border border-orange-500/20 rounded px-2 py-0.5">
              <AlertTriangle className="w-3 h-3" />
              HVHZ
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 mt-3 text-xs text-muted-foreground">
          <Clock className="w-3 h-3" />
          {new Date(project.createdAt).toLocaleDateString()}
        </div>
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const { user, isAuthenticated, loading } = useAuth();
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();

  const { data: projects, isLoading } = trpc.projects.list.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const logout = trpc.auth.logout.useMutation({
    onSuccess: () => {
      window.location.href = "/";
    },
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground text-sm">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    window.location.href = getLoginUrl();
    return null;
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Sidebar */}
      <div className="flex h-screen">
        <aside className="w-56 bg-sidebar border-r border-sidebar-border flex flex-col flex-shrink-0">
          <div className="p-4 border-b border-sidebar-border">
            <div className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-primary" />
              <div>
                <div className="text-sm font-semibold text-sidebar-foreground">Elevations</div>
                <div className="text-xs text-muted-foreground">by Sourcy</div>
              </div>
            </div>
          </div>
          <nav className="flex-1 p-3 space-y-1">
            <button className="w-full flex items-center gap-2.5 text-sm px-3 py-2 rounded-md bg-sidebar-accent text-sidebar-accent-foreground font-medium">
              <FolderOpen className="w-4 h-4 text-primary" />
              Projects
            </button>
            <button
              className="w-full flex items-center gap-2.5 text-sm px-3 py-2 rounded-md text-sidebar-foreground hover:bg-sidebar-accent/50 transition-colors"
              onClick={() => toast.info("FBC Rules browser coming soon")}
            >
              <FileCode2 className="w-4 h-4" />
              FBC Rules
            </button>
          </nav>
          <div className="p-3 border-t border-sidebar-border">
            <div className="flex items-center gap-2 px-2 py-1.5 mb-2">
              <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-xs font-semibold text-primary">
                {user?.name?.[0]?.toUpperCase() ?? "U"}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-sidebar-foreground truncate">{user?.name ?? "User"}</div>
                <div className="text-xs text-muted-foreground truncate">{user?.email ?? ""}</div>
              </div>
            </div>
            <button
              className="w-full flex items-center gap-2 text-xs px-3 py-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/50 transition-colors"
              onClick={() => logout.mutate()}
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign Out
            </button>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto">
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-xl font-bold text-foreground">Projects</h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {projects?.length ?? 0} project{(projects?.length ?? 0) !== 1 ? "s" : ""}
                </p>
              </div>
              <CreateProjectModal onCreated={() => utils.projects.list.invalidate()} />
            </div>

            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-36 bg-card border border-border rounded-lg animate-pulse" />
                ))}
              </div>
            ) : projects && projects.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {projects.map((p) => (
                  <ProjectCard key={p.id} project={p} />
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                  <Building2 className="w-7 h-7 text-primary" />
                </div>
                <h3 className="text-base font-semibold text-foreground mb-1">No projects yet</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Create your first Florida BIM project to get started.
                </p>
                <CreateProjectModal onCreated={() => utils.projects.list.invalidate()} />
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
