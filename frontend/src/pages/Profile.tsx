import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { IssueCard } from "@/components/IssueCard";
import { useToast } from "@/hooks/use-toast";
import { getAuthToken, getCurrentUser, issueAPI } from "@/lib/api";
import { Pencil, Trash2 } from "lucide-react";

const Profile = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
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

          {loading ? (
            <div className="py-12 text-center text-muted-foreground">Loading your issues...</div>
          ) : issues.length === 0 ? (
            <Card className="border-dashed p-10 text-center text-muted-foreground">
              You have not posted any issues yet.
              <div className="mt-4">
                <Button onClick={() => navigate("/create")}>Create First Issue</Button>
              </div>
            </Card>
          ) : (
            <div className="space-y-6">
              {issues.map((issue) => (
                <div key={issue.id}>
                  <IssueCard issue={issue} />
                  <div className="mt-2 flex justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={() => navigate(`/issue/${issue.id}/edit`)}>
                      <Pencil className="mr-2 h-4 w-4" />
                      Edit
                    </Button>
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

