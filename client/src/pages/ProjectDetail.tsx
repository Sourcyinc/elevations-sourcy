import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  Building2,
  CheckCircle2,
  Download,
  Eye,
  FileCode2,
  FileText,
  Info,
  Loader2,
  MapPin,
  Shield,
  Upload,
  Users,
  Wind,
} from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { useLocation, useParams } from "wouter";

function SeverityIcon({ severity }: { severity: string }) {
  if (severity === "error") return <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />;
  if (severity === "warning") return <AlertTriangle className="w-4 h-4 text-yellow-400 flex-shrink-0" />;
  return <Info className="w-4 h-4 text-blue-400 flex-shrink-0" />;
}

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const projectId = parseInt(id ?? "0");
  const [, navigate] = useLocation();
  const { isAuthenticated } = useAuth();
  const utils = trpc.useUtils();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const { data: project, isLoading: projectLoading } = trpc.projects.get.useQuery(
    { id: projectId },
    { enabled: isAuthenticated && projectId > 0 }
  );

  const { data: files, isLoading: filesLoading } = trpc.ifc.getFiles.useQuery(
    { projectId },
    { enabled: isAuthenticated && projectId > 0 }
  );

  const { data: members } = trpc.projects.getMembers.useQuery(
    { projectId },
    { enabled: isAuthenticated && projectId > 0 }
  );

  const { data: complianceFlags, refetch: refetchFlags } = trpc.compliance.getFlags.useQuery(
    { projectId },
    { enabled: isAuthenticated && projectId > 0 }
  );

  const runCheck = trpc.compliance.runCheck.useMutation({
    onSuccess: (data) => {
      toast.success(`Compliance check complete: ${data.flagCount} flag${data.flagCount !== 1 ? "s" : ""} found`);
      refetchFlags();
    },
    onError: (err) => toast.error(err.message),
  });

  const uploadMutation = trpc.ifc.upload.useMutation({
    onSuccess: (data) => {
      toast.success(`IFC file uploaded: ${data.elementCount} elements parsed`);
      utils.ifc.getFiles.invalidate({ projectId });
      setUploading(false);
    },
    onError: (err) => {
      toast.error(err.message);
      setUploading(false);
    },
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith(".ifc")) {
      toast.error("Only .ifc files are supported");
      return;
    }
    setUploading(true);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const base64 = (ev.target?.result as string).split(",")[1];
      uploadMutation.mutate({
        projectId,
        filename: file.name,
        fileContent: base64,
        fileSizeBytes: file.size,
      });
    };
    reader.readAsDataURL(file);
  };

  if (!isAuthenticated) {
    navigate("/");
    return null;
  }

  if (projectLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Project not found</div>
      </div>
    );
  }

  const errorCount = complianceFlags?.filter((f) => f.severity === "error").length ?? 0;
  const warningCount = complianceFlags?.filter((f) => f.severity === "warning").length ?? 0;
  const infoCount = complianceFlags?.filter((f) => f.severity === "info").length ?? 0;

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/50 sticky top-0 z-40">
        <div className="container flex items-center gap-3 h-14">
          <button
            onClick={() => navigate("/dashboard")}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Dashboard
          </button>
          <span className="text-border">/</span>
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-primary" />
            <span className="font-semibold text-foreground">{project.name}</span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => navigate(`/projects/${projectId}/permit-set`)}
              className="gap-2"
            >
              <FileText className="w-4 h-4" />
              Permit Set
            </Button>
            <Button
              size="sm"
              onClick={() => navigate(`/projects/${projectId}/viewer`)}
              className="gap-2"
            >
              <Eye className="w-4 h-4" />
              Open Viewer
            </Button>
          </div>
        </div>
      </header>

      <div className="container py-6">
        {/* Project metadata cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {project.county && (
            <div className="bg-card border border-border rounded-lg p-3">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                <MapPin className="w-3.5 h-3.5" />
                County
              </div>
              <div className="text-sm font-medium text-foreground">{project.county}</div>
            </div>
          )}
          {project.floodZone && (
            <div className="bg-card border border-border rounded-lg p-3">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                Flood Zone
              </div>
              <div className="text-sm font-medium text-foreground">
                Zone {project.floodZone}
                {project.bfe !== null && project.bfe !== undefined && (
                  <span className="text-muted-foreground ml-1">· BFE {project.bfe} ft</span>
                )}
              </div>
            </div>
          )}
          {project.windSpeedMph && (
            <div className="bg-card border border-border rounded-lg p-3">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                <Wind className="w-3.5 h-3.5" />
                Wind Speed
              </div>
              <div className="text-sm font-medium text-foreground">{project.windSpeedMph} mph</div>
            </div>
          )}
          {project.hvhz && (
            <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-3">
              <div className="flex items-center gap-1.5 text-xs text-orange-400 mb-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                HVHZ
              </div>
              <div className="text-sm font-medium text-orange-300">NOA Required</div>
            </div>
          )}
        </div>

        <Tabs defaultValue="files">
          <TabsList className="bg-secondary/50 border border-border mb-4">
            <TabsTrigger value="files" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <FileCode2 className="w-4 h-4 mr-1.5" />
              IFC Files
            </TabsTrigger>
            <TabsTrigger value="compliance" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Shield className="w-4 h-4 mr-1.5" />
              FBC Compliance
              {errorCount > 0 && (
                <span className="ml-1.5 bg-red-500/20 text-red-400 text-xs rounded-full px-1.5">{errorCount}</span>
              )}
            </TabsTrigger>
            <TabsTrigger value="members" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Users className="w-4 h-4 mr-1.5" />
              Team
            </TabsTrigger>
          </TabsList>

          {/* IFC Files Tab */}
          <TabsContent value="files">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-foreground">IFC Files</h2>
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".ifc"
                  className="hidden"
                  onChange={handleFileUpload}
                />
                <Button
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="gap-2"
                >
                  {uploading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Upload className="w-4 h-4" />
                  )}
                  {uploading ? "Uploading..." : "Upload IFC"}
                </Button>
              </div>
            </div>

            {filesLoading ? (
              <div className="space-y-2">
                {[1, 2].map((i) => (
                  <div key={i} className="h-16 bg-card border border-border rounded-lg animate-pulse" />
                ))}
              </div>
            ) : files && files.length > 0 ? (
              <div className="space-y-2">
                {files.map((file) => (
                  <div
                    key={file.id}
                    className="bg-card border border-border rounded-lg p-4 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center">
                        <FileCode2 className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <div className="text-sm font-medium text-foreground">{file.originalName}</div>
                        <div className="text-xs text-muted-foreground">
                          {file.elementCount ?? 0} elements ·{" "}
                          {file.fileSizeBytes ? `${(file.fileSizeBytes / 1024).toFixed(1)} KB` : "—"} ·{" "}
                          {new Date(file.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => navigate(`/projects/${projectId}/viewer`)}
                        className="gap-1.5"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        View
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => window.open(file.fileUrl, "_blank")}
                        className="gap-1.5"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Download
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center border border-dashed border-border rounded-lg">
                <FileCode2 className="w-8 h-8 text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground mb-3">No IFC files uploaded yet</p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  className="gap-2"
                >
                  <Upload className="w-4 h-4" />
                  Upload IFC File
                </Button>
              </div>
            )}
          </TabsContent>

          {/* FBC Compliance Tab */}
          <TabsContent value="compliance">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <h2 className="text-sm font-semibold text-foreground">FBC Compliance Flags</h2>
                <div className="flex items-center gap-1.5">
                  {errorCount > 0 && (
                    <span className="text-xs bg-red-500/15 text-red-400 border border-red-500/30 rounded-full px-2 py-0.5">
                      {errorCount} error{errorCount !== 1 ? "s" : ""}
                    </span>
                  )}
                  {warningCount > 0 && (
                    <span className="text-xs bg-yellow-500/15 text-yellow-400 border border-yellow-500/30 rounded-full px-2 py-0.5">
                      {warningCount} warning{warningCount !== 1 ? "s" : ""}
                    </span>
                  )}
                  {infoCount > 0 && (
                    <span className="text-xs bg-blue-500/15 text-blue-400 border border-blue-500/30 rounded-full px-2 py-0.5">
                      {infoCount} info
                    </span>
                  )}
                </div>
              </div>
              <Button
                size="sm"
                onClick={() => runCheck.mutate({ projectId })}
                disabled={runCheck.isPending}
                className="gap-2"
              >
                {runCheck.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
                Run FBC Check
              </Button>
            </div>

            {complianceFlags && complianceFlags.length > 0 ? (
              <div className="space-y-2">
                {complianceFlags.map((flag) => (
                  <div
                    key={flag.id}
                    className={`border rounded-lg p-3 ${
                      flag.severity === "error"
                        ? "severity-error-bg border-red-500/30"
                        : flag.severity === "warning"
                        ? "severity-warning-bg border-yellow-500/30"
                        : "severity-info-bg border-blue-500/30"
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <SeverityIcon severity={flag.severity} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-xs font-mono font-semibold text-muted-foreground">
                            FBC {flag.fbcSection}
                          </span>
                        </div>
                        <p className="text-sm text-foreground">{flag.message}</p>
                        {flag.details && (
                          <p className="text-xs text-muted-foreground mt-1">{flag.details}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center border border-dashed border-border rounded-lg">
                <CheckCircle2 className="w-8 h-8 text-green-400 mb-3" />
                <p className="text-sm text-muted-foreground">
                  {complianceFlags === undefined ? "Run a compliance check to see FBC flags." : "No compliance flags found."}
                </p>
              </div>
            )}
          </TabsContent>

          {/* Team Tab */}
          <TabsContent value="members">
            <Card className="bg-card border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-foreground">Project Team</CardTitle>
              </CardHeader>
              <CardContent>
                {members && members.length > 0 ? (
                  <div className="space-y-2">
                    {members.map((m) => (
                      <div key={m.id} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-xs font-semibold text-primary">
                            {(m.userName?.[0] ?? "U").toUpperCase()}
                          </div>
                          <div>
                            <div className="text-sm text-foreground">{m.userName}</div>
                            {m.userEmail && <div className="text-xs text-muted-foreground">{m.userEmail}</div>}
                          </div>
                        </div>
                        <span className={`text-xs rounded-full px-2 py-0.5 ${
                          m.memberRole === "owner"
                            ? "bg-primary/15 text-primary border border-primary/30"
                            : "bg-secondary text-secondary-foreground"
                        }`}>
                          {m.memberRole}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No team members found.</p>
                )}
                <div className="mt-4 pt-4 border-t border-border/50">
                  <p className="text-xs text-muted-foreground">
                    To add collaborators, share the project ID with them. Full invite system coming soon.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
