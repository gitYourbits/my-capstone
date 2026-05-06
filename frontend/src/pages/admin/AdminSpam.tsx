import { useEffect, useState } from "react";
import { adminAPI } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShieldAlert, ShieldCheck, MapPin, User as UserIcon, Mail, Calendar, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";

type SpamRow = {
  id: number;
  title: string;
  description: string;
  category_name: string | null;
  location: { city: string | null; district: string | null; state: string | null };
  spam_reason: string;
  spam_score: number;
  spam_checked_at: string | null;
  created_at: string;
  is_anonymous: boolean;
  author: {
    id: number | null;
    username: string | null;
    email: string | null;
    full_name: string;
    date_joined: string | null;
    is_staff: boolean;
    total_posts: number;
    flagged_posts: number;
  };
};

export default function AdminSpam() {
  const { toast } = useToast();
  const [rows, setRows] = useState<SpamRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [unflaggingId, setUnflaggingId] = useState<number | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await adminAPI.getSpamReports(1);
      setRows(res.results);
    } catch (error: any) {
      toast({
        title: "Failed to load spam reports",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleUnflag = async (issueId: number) => {
    const ok = window.confirm(
      "Clear the spam flag on this post? It will become visible on the public feed and enter the normal admin workflow."
    );
    if (!ok) return;
    setUnflaggingId(issueId);
    try {
      await adminAPI.unflagSpam(issueId);
      toast({
        title: "Spam flag cleared",
        description: "The post is now public and routed for processing.",
      });
      setRows((prev) => prev.filter((r) => r.id !== issueId));
    } catch (error: any) {
      toast({
        title: "Could not clear flag",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setUnflaggingId(null);
    }
  };

  const fmtJoined = (iso: string | null) =>
    iso ? formatDistanceToNow(new Date(iso), { addSuffix: true }) : "—";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Spam Reports</h1>
        <p className="text-muted-foreground">
          Issues that the AI content filter flagged as spam or noise. They are
          hidden from the public feed and the admin workflow until you clear
          the flag.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-foreground">
            <ShieldAlert className="h-5 w-5 text-amber-500" />
            Flagged posts
          </CardTitle>
          <CardDescription>
            {loading
              ? "Loading flagged reports..."
              : rows.length === 0
              ? "No flagged posts at the moment."
              : `${rows.length} flagged posts shown below.`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!loading && rows.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border bg-muted/30 px-4 py-12 text-center text-sm text-muted-foreground">
              All clear. No spam reports.
            </div>
          ) : (
            <div className="space-y-4">
              {rows.map((row) => {
                const locationStr = [row.location?.city, row.location?.district, row.location?.state]
                  .filter(Boolean)
                  .join(", ");
                return (
                  <Card key={row.id} className="border-amber-500/25 bg-amber-500/5 dark:bg-amber-500/10">
                    <CardContent className="p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            {row.category_name && (
                              <Badge variant="secondary" className="rounded-md">{row.category_name}</Badge>
                            )}
                            {locationStr && (
                              <span className="inline-flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                {locationStr}
                              </span>
                            )}
                            <span>•</span>
                            <span>
                              {row.created_at
                                ? formatDistanceToNow(new Date(row.created_at), { addSuffix: true })
                                : ""}
                            </span>
                            <span>•</span>
                            <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-400">
                              <AlertTriangle className="h-3 w-3" />
                              confidence {(row.spam_score * 100).toFixed(0)}%
                            </span>
                          </div>
                          <h3 className="mt-2 text-base font-semibold text-foreground">
                            {row.title}
                          </h3>
                          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                            {row.description}
                          </p>
                          {row.spam_reason && (
                            <p className="mt-2 rounded-md bg-background/60 px-3 py-2 text-xs text-foreground/80 dark:bg-background/40">
                              <span className="font-medium">Filter reason:</span>{" "}
                              {row.spam_reason}
                            </p>
                          )}
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-2 border-emerald-500/40 text-emerald-700 hover:bg-emerald-500/10 dark:text-emerald-300"
                          disabled={unflaggingId === row.id}
                          onClick={() => handleUnflag(row.id)}
                        >
                          <ShieldCheck className="h-4 w-4" />
                          {unflaggingId === row.id ? "Clearing..." : "Mark legitimate"}
                        </Button>
                      </div>

                      <div className="mt-4 grid gap-3 rounded-lg border border-border/60 bg-background/60 p-3 text-xs dark:bg-background/40 sm:grid-cols-2 lg:grid-cols-4">
                        <div>
                          <p className="text-muted-foreground">Username</p>
                          <p className="mt-0.5 inline-flex items-center gap-1.5 font-medium text-foreground">
                            <UserIcon className="h-3.5 w-3.5" />
                            {row.author?.username ?? "(unknown)"}
                            {row.is_anonymous && (
                              <Badge variant="outline" className="ml-1 rounded-md text-[10px] uppercase">
                                anon
                              </Badge>
                            )}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Email</p>
                          <p className="mt-0.5 inline-flex items-center gap-1.5 font-medium text-foreground">
                            <Mail className="h-3.5 w-3.5" />
                            {row.author?.email || "—"}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Joined</p>
                          <p className="mt-0.5 inline-flex items-center gap-1.5 font-medium text-foreground">
                            <Calendar className="h-3.5 w-3.5" />
                            {fmtJoined(row.author?.date_joined ?? null)}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">User history</p>
                          <p className="mt-0.5 font-medium text-foreground">
                            {row.author?.flagged_posts ?? 0} flagged out of {row.author?.total_posts ?? 0} posts
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
