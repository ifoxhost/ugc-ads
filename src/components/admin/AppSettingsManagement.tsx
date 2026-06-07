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

  useEffect(() => { load(); }, []);

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
      const { data, error } = await supabase.functions.invoke("cleanup-storyboard-assets", { body: {} });
      if (error) throw error;
      toast.success(`Cleanup ran — deleted ${data?.deleted?.refs ?? 0} refs, ${data?.deleted?.imgs ?? 0} scene images.`);
    } catch (e: any) {
      toast.error(e?.message ?? "Cleanup failed");
    } finally { setRunningCleanup(false); }
  };

  return (
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
  );
}
