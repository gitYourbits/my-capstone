import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { adminAPI } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, CheckCircle, Clock, TrendingUp, ShieldAlert } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const statusLabels: Record<string, string> = {
  pending: "Pending",
  under_review: "Under Review",
  in_progress: "In Progress",
  resolved: "Resolved",
  rejected: "Rejected",
};

export default function AdminDashboard() {
  const [stats, setStats] = useState<{
    total_issues: number;
    by_status: Record<string, number>;
    recent_7_days: number;
    pending_count: number;
    spam_total: number;
    spam_recent_7_days: number;
  } | null>(null);
  const [spamPreview, setSpamPreview] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      adminAPI.getStats().then(setStats).catch(() => setStats(null)),
      adminAPI
        .getSpamReports(1)
        .then((r) => setSpamPreview(r.results.slice(0, 5)))
        .catch(() => setSpamPreview([])),
    ]).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <div className="h-4 w-24 animate-pulse rounded bg-muted" />
            </CardHeader>
            <CardContent>
              <div className="h-8 w-16 animate-pulse rounded bg-muted" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Dashboard</h1>
        <p className="text-muted-foreground">Overview of grievances and requests</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-primary/20 bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Grievances
            </CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{stats?.total_issues ?? 0}</div>
          </CardContent>
        </Card>

        <Card className="border-amber-500/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pending Review
            </CardTitle>
            <Clock className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{stats?.pending_count ?? 0}</div>
            <Link to="/admin/grievances?status=pending">
              <Button variant="link" className="h-auto p-0 text-amber-600">
                View all
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Last 7 Days
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{stats?.recent_7_days ?? 0}</div>
            <p className="text-xs text-muted-foreground">New submissions</p>
          </CardContent>
        </Card>

        <Card className="border-green-500/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Resolved
            </CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {stats?.by_status?.resolved ?? 0}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Spam Reports */}
      <Card className="border-amber-500/30 bg-amber-500/5 dark:bg-amber-500/10">
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2 text-foreground">
              <ShieldAlert className="h-5 w-5 text-amber-500" />
              Spam Reports
            </CardTitle>
            <CardDescription>
              Posts auto-flagged by the AI content filter and hidden from the
              public feed. {stats?.spam_recent_7_days ?? 0} new in last 7 days.
            </CardDescription>
          </div>
          <Link to="/admin/spam">
            <Button variant="outline" size="sm">
              View all ({stats?.spam_total ?? 0})
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          {spamPreview.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border bg-background/40 px-4 py-6 text-center text-sm text-muted-foreground">
              No spam reports right now. Things are clean.
            </div>
          ) : (
            <div className="space-y-3">
              {spamPreview.map((row) => (
                <div
                  key={row.id}
                  className="rounded-lg border border-amber-500/25 bg-background/60 p-3 text-sm dark:bg-background/40"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-foreground">
                        <Link to={`/admin/spam`} className="hover:underline">
                          {row.title}
                        </Link>
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">
                        by{" "}
                        <span className="text-foreground">
                          {row.author?.username ?? "(unknown)"}
                        </span>
                        {row.author?.email ? ` · ${row.author.email}` : ""}
                        {typeof row.author?.flagged_posts === "number" && row.author?.total_posts ? (
                          <>
                            {" "}· {row.author.flagged_posts}/{row.author.total_posts} posts flagged
                          </>
                        ) : null}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {row.created_at
                        ? formatDistanceToNow(new Date(row.created_at), { addSuffix: true })
                        : ""}
                    </span>
                  </div>
                  {row.spam_reason && (
                    <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                      Reason: {row.spam_reason}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>By status</CardTitle>
          <CardDescription>Breakdown of grievances by current status</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            {Object.entries(stats?.by_status ?? {}).map(([status, count]) => (
              <div
                key={status}
                className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-4 py-2"
              >
                <span className="font-medium text-foreground">{statusLabels[status] ?? status}</span>
                <span className="text-muted-foreground">({count})</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-4">
        <Link to="/admin/grievances">
          <Button className="gap-2">
            <FileText className="h-4 w-4" />
            Manage all grievances
          </Button>
        </Link>
      </div>
    </div>
  );
}
