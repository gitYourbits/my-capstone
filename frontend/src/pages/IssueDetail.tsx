import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { IssueCard } from "@/components/IssueCard";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ArrowUp, ArrowDown, User, UserCheck, GitBranch, Pencil, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { issueAPI, commentAPI } from "@/lib/api";
import { formatDistanceToNow } from "date-fns";
import { getAuthToken } from "@/lib/api";

const IssueDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [issue, setIssue] = useState<any>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (id) {
      loadIssue();
      loadComments();
    }
  }, [id]);

  const loadIssue = async () => {
    try {
      setLoading(true);
      const issueData = await issueAPI.getById(parseInt(id!));
      setIssue(issueData);
      
      // Track view
      try {
        await issueAPI.view(parseInt(id!));
      } catch (error) {
        // Ignore view tracking errors
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to load issue",
        variant: "destructive",
      });
      navigate("/feed");
    } finally {
      setLoading(false);
    }
  };

  const loadComments = async () => {
    try {
      const commentsData = await issueAPI.getComments(parseInt(id!));
      setComments(commentsData);
    } catch (error: any) {
      console.error("Failed to load comments:", error);
    }
  };

  const handleSubmitComment = async () => {
    if (!commentText.trim()) {
      toast({
        title: "Error",
        description: "Please enter a comment",
        variant: "destructive",
      });
      return;
    }

    if (!getAuthToken()) {
      toast({
        title: "Authentication required",
        description: "Please login to comment",
        variant: "destructive",
      });
      navigate("/login");
      return;
    }

    setIsSubmitting(true);
    try {
      await commentAPI.create({
        issue: parseInt(id!),
        content: commentText,
        is_anonymous: isAnonymous,
      });
      
      setCommentText("");
      setIsAnonymous(false);
      await loadComments();
      await loadIssue(); // Refresh issue to update comment count
      
      toast({
        title: "Success!",
        description: "Your comment has been posted.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to post comment",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCommentVote = async (commentId: number, voteType: 'upvote' | 'downvote') => {
    try {
      await commentAPI.vote(commentId, voteType);
      await loadComments();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to vote",
        variant: "destructive",
      });
    }
  };

  const handleDeleteIssue = async () => {
    if (!issue?.is_owner || isDeleting) return;
    const confirmed = window.confirm("Are you sure you want to delete this issue? This action cannot be undone.");
    if (!confirmed) return;
    setIsDeleting(true);
    try {
      await issueAPI.delete(issue.id);
      toast({
        title: "Issue deleted",
        description: "The issue has been permanently removed.",
      });
      navigate("/profile");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete issue",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container px-4 py-6">
          <div className="text-center py-12">
            <p className="text-muted-foreground">Loading issue...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!issue) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container px-4 py-6">
          <div className="text-center py-12">
            <p className="text-muted-foreground">Issue not found</p>
            <Button onClick={() => navigate("/feed")} className="mt-4">
              Back to Feed
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <div className="container px-4 py-6">
        <div className="mx-auto max-w-4xl">
          {issue?.is_owner && (
            <div className="mb-4 flex justify-end gap-2">
              <Button variant="outline" onClick={() => navigate(`/issue/${issue.id}/edit`)}>
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </Button>
              <Button variant="destructive" onClick={handleDeleteIssue} disabled={isDeleting}>
                <Trash2 className="mr-2 h-4 w-4" />
                {isDeleting ? "Deleting..." : "Delete"}
              </Button>
            </div>
          )}
          <IssueCard issue={issue} isDetail onVoteChange={loadIssue} />

          {/* Media Gallery */}
          {issue.media_files && issue.media_files.length > 0 && (
            <Card className="mt-6 p-6 shadow-card border-border/80">
              <h2 className="mb-4 text-xl font-semibold text-foreground">Evidence</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {issue.media_files.map((media: any) => (
                  <div key={media.id} className="rounded-lg overflow-hidden">
                    {media.media_type === 'image' && (
                      <img
                        src={media.file_url}
                        alt={media.caption || issue.title}
                        className="w-full h-64 object-cover"
                      />
                    )}
                    {media.media_type === 'video' && (
                      <video
                        src={media.file_url}
                        controls
                        className="w-full h-64 object-cover"
                      />
                    )}
                    {media.media_type === 'audio' && (
                      <div className="p-4 bg-muted rounded-lg">
                        <audio src={media.file_url} controls className="w-full" />
                        {media.caption && (
                          <p className="mt-2 text-sm text-muted-foreground">{media.caption}</p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Admin Assignment Status */}
          {(issue.assigned_to_name || issue.workflow_stage_label || (issue.workflow_transitions_public?.length ?? 0) > 0) && (
            <Card className="mt-6 p-6 shadow-card border-primary/30 bg-primary/5 dark:bg-primary/10">
              <h2 className="mb-4 flex items-center gap-2 text-xl font-semibold text-foreground">
                <GitBranch className="h-5 w-5 text-primary" />
                Processing Status
              </h2>
              <div className="space-y-4">
                <div className="flex flex-wrap gap-4">
                  {issue.assigned_to_name && (
                    <div className="flex items-center gap-2">
                      <UserCheck className="h-4 w-4 text-primary" />
                      <span className="text-sm text-muted-foreground">Assigned to</span>
                      <span className="font-medium text-foreground">{issue.assigned_to_name}</span>
                    </div>
                  )}
                  {issue.workflow_stage_label && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">Current stage</span>
                      <span className="rounded-md bg-primary/20 px-2 py-0.5 text-sm font-medium text-primary">{issue.workflow_stage_label}</span>
                    </div>
                  )}
                </div>
                {(issue.workflow_transitions_public?.length ?? 0) > 0 && (
                  <div className="space-y-3">
                    <p className="text-sm font-medium text-muted-foreground">Recent updates</p>
                    <div className="space-y-2">
                      {issue.workflow_transitions_public.slice(0, 5).map((t: any, i: number) => {
                        const stageLabels: Record<string, string> = { pending: 'Pending', acknowledged: 'Acknowledged', assigned_to_team: 'Assigned to Team', resolution_done: 'Resolution Done', validated: 'Validated', remarks: 'Closed' };
                        const label = stageLabels[t.to_stage] ?? t.to_stage?.replace(/_/g, ' ') ?? '';
                        return (
                        <div key={i} className="flex flex-wrap items-center gap-2 rounded-lg bg-muted/50 dark:bg-muted/30 px-3 py-2 text-sm">
                          <span className="font-medium text-foreground">{label}</span>
                          {t.assigned_to_name && <span className="text-muted-foreground">→ <span className="text-foreground">{t.assigned_to_name}</span></span>}
                          <span className="text-muted-foreground">by <span className="text-foreground">{t.performed_by_name}</span></span>
                          <span className="text-xs text-muted-foreground ml-auto">
                            {formatDistanceToNow(new Date(t.created_at), { addSuffix: true })}
                          </span>
                        </div>
                      );})}
                    </div>
                  </div>
                )}
              </div>
            </Card>
          )}

          {/* Comments Section */}
          <Card className="mt-6 p-6 shadow-card border-border/80">
            <h2 className="mb-6 text-2xl font-semibold text-foreground">
              Discussion ({comments.length})
            </h2>

            {/* Add Comment */}
            {getAuthToken() && (
              <div className="mb-8">
                <Textarea
                  placeholder="Share your thoughts or add information..."
                  className="mb-3 min-h-[100px]"
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                />
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={isAnonymous}
                      onChange={(e) => setIsAnonymous(e.target.checked)}
                      className="rounded"
                    />
                    Post Anonymously
                  </label>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={handleSubmitComment}
                      disabled={isSubmitting || !commentText.trim()}
                    >
                      {isSubmitting ? "Posting..." : "Post Comment"}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {!getAuthToken() && (
              <div className="mb-8 p-4 bg-muted rounded-lg text-center">
                <p className="text-muted-foreground mb-2">Please login to comment</p>
                <Button onClick={() => navigate("/login")}>Login</Button>
              </div>
            )}

            {/* Comments List */}
            <div className="space-y-6">
              {comments.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No comments yet. Be the first to comment!
                </p>
              ) : (
                comments.map((comment) => (
                  <CommentItem
                    key={comment.id}
                    comment={comment}
                    onVote={handleCommentVote}
                  />
                ))
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

interface CommentItemProps {
  comment: any;
  onVote: (commentId: number, voteType: 'upvote' | 'downvote') => void;
}

const CommentItem = ({ comment, onVote }: CommentItemProps) => {
  const [voteState, setVoteState] = useState(comment.user_vote);
  const [upvotes, setUpvotes] = useState(comment.upvotes_count);
  const [downvotes, setDownvotes] = useState(comment.downvotes_count);

  const handleVote = (voteType: 'upvote' | 'downvote') => {
    if (voteState === voteType) {
      // Remove vote
      if (voteType === 'upvote') {
        setUpvotes(Math.max(0, upvotes - 1));
      } else {
        setDownvotes(Math.max(0, downvotes - 1));
      }
      setVoteState(null);
    } else {
      // Change or add vote
      if (voteState === 'upvote' && voteType === 'downvote') {
        setUpvotes(Math.max(0, upvotes - 1));
        setDownvotes(downvotes + 1);
      } else if (voteState === 'downvote' && voteType === 'upvote') {
        setDownvotes(Math.max(0, downvotes - 1));
        setUpvotes(upvotes + 1);
      } else if (!voteState) {
        if (voteType === 'upvote') {
          setUpvotes(upvotes + 1);
        } else {
          setDownvotes(downvotes + 1);
        }
      }
      setVoteState(voteType);
    }
    onVote(comment.id, voteType);
  };

  return (
    <div className="flex gap-4 border-b border-border pb-6 last:border-0 last:pb-0">
      <Avatar className="h-10 w-10">
        <AvatarFallback>
          {comment.author_avatar ? (
            <img src={comment.author_avatar} alt={comment.author_name} />
          ) : (
            <User className="h-5 w-5" />
          )}
        </AvatarFallback>
      </Avatar>

      <div className="flex-1">
        <div className="mb-2 flex items-center gap-2">
          <span className="font-medium text-foreground">
            {comment.is_anonymous ? "Anonymous" : comment.author_name}
          </span>
          <span className="text-sm text-muted-foreground">•</span>
          <span className="text-sm text-muted-foreground">
            {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
          </span>
          {comment.is_edited && (
            <>
              <span className="text-sm text-muted-foreground">•</span>
              <span className="text-xs text-muted-foreground italic">edited</span>
            </>
          )}
        </div>

        <p className="mb-3 text-foreground whitespace-pre-wrap">{comment.content}</p>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className={`h-8 gap-1 hover:bg-success/10 hover:text-success ${
                voteState === 'upvote' ? 'bg-success/20 text-success' : ''
              }`}
              onClick={() => handleVote('upvote')}
            >
              <ArrowUp className="h-4 w-4" />
              <span>{upvotes}</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className={`h-8 gap-1 hover:bg-destructive/10 hover:text-destructive ${
                voteState === 'downvote' ? 'bg-destructive/20 text-destructive' : ''
              }`}
              onClick={() => handleVote('downvote')}
            >
              <ArrowDown className="h-4 w-4" />
              <span>{downvotes}</span>
            </Button>
          </div>
        </div>

        {/* Replies */}
        {comment.replies && comment.replies.length > 0 && (
          <div className="mt-4 ml-4 space-y-4 border-l-2 border-border pl-4">
            {comment.replies.map((reply: any) => (
              <CommentItem key={reply.id} comment={reply} onVote={onVote} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default IssueDetail;
