import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { IssueCard } from "@/components/IssueCard";
import { useToast } from "@/hooks/use-toast";
import { getAuthToken, getCurrentUser, issueAPI } from "@/lib/api";
import { Pencil, Trash2, AlertTriangle, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

const Profile = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get("tab") === "flagged" ? "flagged" : "active";
  const [tab, setTab] = useState<"active" | "flagged">(initialTab);
  const [loading, setLoading] = useState(true);
  const [issues, setIssues] = useState<any[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  useEffect(() => {
    if (!getAuthToken()) {
      navigate("/login");
      return;
    }
    loadData();
  }, []);

  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    if (tab === "flagged") next.set("tab", "flagged");
    else next.delete("tab");
    setSearchParams(next, { replace: true });
  }, [tab]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [me, mine] = await Promise.all([
        getCurrentUser(),
        issueAPI.getMine(),
      ]);
      setProfile(me);
      setIssues(Array.isArray(mine?.results) ? mine.results : []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to load your profile",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (issueId: number) => {
    const confirmed = window.confirm("Delete this issue permanently?");
    if (!confirmed) return;
    setDeletingId(issueId);
    try {
      await issueAPI.delete(issueId);
      setIssues((prev) => prev.filter((i) => i.id !== issueId));
      toast({
        title: "Issue deleted",
        description: "Your issue has been removed.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete issue",
        variant: "destructive",
      });
    } finally {
      setDeletingId(null);
    }
  };

  const { activeIssues, flaggedIssues } = useMemo(() => {
    const active: any[] = [];
    const flagged: any[] = [];
    for (const i of issues) {
      if (i.spam_status === "flagged") flagged.push(i);
      else active.push(i);
    }
    return { activeIssues: active, flaggedIssues: flagged };
  }, [issues]);

  const visibleIssues = tab === "flagged" ? flaggedIssues : activeIssues;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container px-4 py-8">
        <div className="mx-auto max-w-5xl">
          <Card className="mb-6 border-border/80 p-5 shadow-card">
            <h1 className="text-2xl font-bold text-foreground">My Profile</h1>
            <p className="mt-1 text-muted-foreground">
              {profile ? `Signed in as ${profile.username} (${profile.email})` : "Manage your issues"}
            </p>
          </Card>

          {/* Tabs */}
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <Button
              variant={tab === "active" ? "default" : "outline"}
              size="sm"
              onClick={() => setTab("active")}
              className="gap-2"
            >
              <ShieldCheck className="h-4 w-4" />
              Active ({activeIssues.length})
            </Button>
            <Button
              variant={tab === "flagged" ? "default" : "outline"}
              size="sm"
              onClick={() => setTab("flagged")}
              className={cn(
                "gap-2",
                flaggedIssues.length > 0 && tab !== "flagged" && "border-amber-500/60 text-amber-600 hover:bg-amber-500/10"
              )}
            >
              <AlertTriangle className="h-4 w-4" />
              Flagged ({flaggedIssues.length})
            </Button>
          </div>

          {tab === "flagged" && flaggedIssues.length > 0 && (
            <Card className="mb-4 border-amber-500/40 bg-amber-500/5 p-4 text-sm text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
                <div>
                  <p className="font-medium">These posts were flagged as possible spam</p>
                  <p className="mt-1 text-xs leading-relaxed text-amber-900/80 dark:text-amber-200/80">
                    They are hidden from the public feed. Please review the reason
                    on each card and retry with a genuine civic issue. You can
                    delete the flagged ones from here at any time.
                  </p>
                </div>
              </div>
            </Card>
          )}

          {loading ? (
            <div className="py-12 text-center text-muted-foreground">Loading your issues...</div>
          ) : visibleIssues.length === 0 ? (
            <Card className="border-dashed p-10 text-center text-muted-foreground">
              {tab === "flagged" ? (
                <>You have no flagged posts. </>
              ) : (
                <>You have not posted any issues yet.</>
              )}
              <div className="mt-4">
                <Button onClick={() => navigate("/create")}>Create New Issue</Button>
              </div>
            </Card>
          ) : (
            <div className="space-y-6">
              {visibleIssues.map((issue) => (
                <div key={issue.id}>
                  {issue.spam_status === "flagged" && (
                    <div className="mb-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs leading-relaxed text-amber-900 dark:text-amber-200">
                      <div className="font-semibold">Flagged as spam, retry with something genuine.</div>
                      {issue.spam_reason && (
                        <div className="mt-1 opacity-90">Reason: {issue.spam_reason}</div>
                      )}
                    </div>
                  )}
                  <IssueCard issue={issue} />
                  <div className="mt-2 flex justify-end gap-2">
                    {issue.spam_status !== "flagged" && (
                      <Button variant="outline" size="sm" onClick={() => navigate(`/issue/${issue.id}/edit`)}>
                        <Pencil className="mr-2 h-4 w-4" />
                        Edit
                      </Button>
                    )}
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDelete(issue.id)}
                      disabled={deletingId === issue.id}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      {deletingId === issue.id ? "Deleting..." : "Delete"}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Profile;
