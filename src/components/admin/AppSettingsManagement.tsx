import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Save, PlayCircle, RefreshCw, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";

type CleanupRun = {
  id: string;
  started_at: string;
  finished_at: string | null;
  success: boolean;
  ref_ttl_days: number | null;
  img_ttl_days: number | null;
  refs_scanned: number;
  imgs_scanned: number;
  refs_deleted: number;
  imgs_deleted: number;
  live_imgs: number;
  error_message: string | null;
  triggered_by: string;
};

type SettingRow = { key: string; value: any; description: string | null; updated_at: string };

const KEYS = [
  { key: "storyboard_ref_ttl_days",   label: "Reference image TTL (days)", min: 1, max: 365 },
  { key: "storyboard_image_ttl_days", label: "Orphan scene image TTL (days)", min: 1, max: 365 },
] as const;

export function AppSettingsManagement() {
  const [rows, setRows] = useState<Record<string, SettingRow>>({});
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [runningCleanup, setRunningCleanup] = useState(false);
  const [runs, setRuns] = useState<CleanupRun[]>([]);
  const [runsLoading, setRunsLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("app_settings").select("*");
    if (error) { toast.error(error.message); setLoading(false); return; }
    const byKey: Record<string, SettingRow> = {};
    const d: Record<string, string> = {};
    for (const r of (data ?? []) as SettingRow[]) {
      byKey[r.key] = r;
      d[r.key] = String(typeof r.value === "string" ? JSON.parse(r.value) : r.value);
    }
    setRows(byKey);
    setDrafts(d);
    setLoading(false);
  };

  const loadRuns = async () => {
    setRunsLoading(true);
    const { data, error } = await supabase
      .from("cleanup_runs" as any)
      .select("*")
      .order("started_at", { ascending: false })
      .limit(20);
    setRunsLoading(false);
    if (error) { toast.error(error.message); return; }
    setRuns((data ?? []) as unknown as CleanupRun[]);
  };

  useEffect(() => { load(); loadRuns(); }, []);

  const save = async (key: string, min: number, max: number) => {
    const n = parseInt(drafts[key] ?? "", 10);
    if (!Number.isFinite(n) || n < min || n > max) {
      toast.error(`Value must be between ${min} and ${max}`);
      return;
    }
    setSaving(key);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("app_settings").upsert({
      key, value: n, updated_by: user?.id ?? null,
      description: rows[key]?.description ?? null,
    });
    setSaving(null);
    if (error) { toast.error(error.message); return; }
    toast.success("Saved");
    load();
  };

  const runCleanup = async () => {
    setRunningCleanup(true);
    try {
      const { data, error } = await supabase.functions.invoke("cleanup-storyboard-assets", {
        body: { triggeredBy: "admin-ui" },
      });
      if (error) throw error;
      toast.success(`Cleanup ran — deleted ${data?.deleted?.refs ?? 0} refs, ${data?.deleted?.imgs ?? 0} scene images.`);
      loadRuns();
    } catch (e: any) {
      toast.error(e?.message ?? "Cleanup failed");
      loadRuns();
    } finally { setRunningCleanup(false); }
  };

  const formatDuration = (start: string, finish: string | null) => {
    if (!finish) return "—";
    const ms = new Date(finish).getTime() - new Date(start).getTime();
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };



  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Storyboard cleanup settings</CardTitle>
          <CardDescription>
            Configurable TTLs read by the daily <code>cleanup-storyboard-assets</code> cron.
            Changes apply on the next run — no redeploy needed.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {loading ? (
            <div className="flex items-center text-sm text-muted-foreground"><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Loading…</div>
          ) : (
            <>
              {KEYS.map(({ key, label, min, max }) => {
                const row = rows[key];
                return (
                  <div key={key} className="space-y-2">
                    <Label htmlFor={key}>{label}</Label>
                    <div className="flex gap-2">
                      <Input
                        id={key} type="number" min={min} max={max}
                        value={drafts[key] ?? ""}
                        onChange={(e) => setDrafts({ ...drafts, [key]: e.target.value })}
                        className="max-w-[140px]"
                      />
                      <Button onClick={() => save(key, min, max)} disabled={saving === key} size="sm">
                        {saving === key ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
                        Save
                      </Button>
                    </div>
                    {row?.description && <p className="text-xs text-muted-foreground">{row.description}</p>}
                    {row?.updated_at && <p className="text-[10px] text-muted-foreground">Last updated {new Date(row.updated_at).toLocaleString()}</p>}
                  </div>
                );
              })}

              <div className="pt-4 border-t">
                <Button variant="secondary" size="sm" onClick={runCleanup} disabled={runningCleanup}>
                  {runningCleanup ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <PlayCircle className="w-4 h-4 mr-1" />}
                  Run cleanup now
                </Button>
                <p className="text-xs text-muted-foreground mt-2">Triggers the cleanup edge function immediately for testing.</p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
          <div>
            <CardTitle>Cleanup history</CardTitle>
            <CardDescription>
              Last 20 runs of <code>cleanup-storyboard-assets</code> — successes, deletion counts, and any errors.
            </CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={loadRuns} disabled={runsLoading}>
            {runsLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          </Button>
        </CardHeader>
        <CardContent>
          {runs.length === 0 ? (
            <div className="text-sm text-muted-foreground py-6 text-center">
              {runsLoading ? "Loading…" : "No cleanup runs recorded yet."}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground border-b border-border">
                    <th className="py-2 pr-4 font-medium">Status</th>
                    <th className="py-2 pr-4 font-medium">Started</th>
                    <th className="py-2 pr-4 font-medium">Duration</th>
                    <th className="py-2 pr-4 font-medium">Trigger</th>
                    <th className="py-2 pr-4 font-medium">Refs (deleted / scanned)</th>
                    <th className="py-2 pr-4 font-medium">Images (deleted / scanned)</th>
                    <th className="py-2 pr-4 font-medium">TTLs</th>
                    <th className="py-2 font-medium">Error</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.map((r) => (
                    <tr key={r.id} className="border-b border-border/50 align-top">
                      <td className="py-2 pr-4">
                        {r.finished_at == null ? (
                          <Badge variant="outline" className="text-xs"><Loader2 className="w-3 h-3 mr-1 animate-spin" />Running</Badge>
                        ) : r.success ? (
                          <Badge variant="outline" className="text-xs text-green-600 border-green-600/30"><CheckCircle2 className="w-3 h-3 mr-1" />Success</Badge>
                        ) : (
                          <Badge variant="destructive" className="text-xs"><AlertCircle className="w-3 h-3 mr-1" />Failed</Badge>
                        )}
                      </td>
                      <td className="py-2 pr-4 whitespace-nowrap text-xs">{new Date(r.started_at).toLocaleString()}</td>
                      <td className="py-2 pr-4 text-xs">{formatDuration(r.started_at, r.finished_at)}</td>
                      <td className="py-2 pr-4 text-xs text-muted-foreground">{r.triggered_by}</td>
                      <td className="py-2 pr-4 text-xs">{r.refs_deleted} / {r.refs_scanned}</td>
                      <td className="py-2 pr-4 text-xs">{r.imgs_deleted} / {r.imgs_scanned} <span className="text-muted-foreground">({r.live_imgs} live)</span></td>
                      <td className="py-2 pr-4 text-xs text-muted-foreground">{r.ref_ttl_days ?? "—"}d / {r.img_ttl_days ?? "—"}d</td>
                      <td className="py-2 text-xs text-destructive max-w-[260px] break-words">{r.error_message ?? ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

