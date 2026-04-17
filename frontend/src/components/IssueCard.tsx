import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowUp, ArrowDown, MessageSquare, MapPin, Share2, UserCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { issueAPI } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";

interface Issue {
  id: number;
  title: string;
  description: string;
  category_name?: string;
  category?: { name: string };
  location: {
    city: string | null;
    district: string | null;
    state: string | null;
  };
  author_name: string;
  is_anonymous: boolean;
  upvotes_count: number;
  downvotes_count: number;
  comments_count: number;
  created_at: string;
  first_image?: string | null;
  tags: Array<{ name: string; slug: string }> | string[];
  score?: number;
  user_vote?: 'upvote' | 'downvote' | null;
  assigned_to_name?: string | null;
  workflow_stage?: string;
  workflow_stage_label?: string;
  top_comments?: Array<{
    id: number;
    author_name: string;
    content: string;
    upvotes_count: number;
  }>;
}

interface IssueCardProps {
  issue: Issue;
  isDetail?: boolean;
  onVoteChange?: () => void;
}

export const IssueCard = ({ issue, isDetail = false, onVoteChange }: IssueCardProps) => {
  const { toast } = useToast();
  const [isVoting, setIsVoting] = useState(false);
  const [voteState, setVoteState] = useState(issue.user_vote);
  const [upvotes, setUpvotes] = useState(issue.upvotes_count);
  const [downvotes, setDownvotes] = useState(issue.downvotes_count);
  const [imageVisible, setImageVisible] = useState(true);

  const handleVote = async (voteType: 'upvote' | 'downvote') => {
    if (isVoting) return;
    
    setIsVoting(true);
    try {
      const response = await issueAPI.vote(issue.id, voteType);
      
      // Update local state based on response
      if (response.vote_type === null) {
        // Vote was removed
        if (voteState === 'upvote') {
          setUpvotes(Math.max(0, upvotes - 1));
        } else if (voteState === 'downvote') {
          setDownvotes(Math.max(0, downvotes - 1));
        }
        setVoteState(null);
      } else {
        // Vote was added or changed
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
      
      if (onVoteChange) {
        onVoteChange();
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to vote. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsVoting(false);
    }
  };

  const categoryName = issue.category_name || issue.category?.name || 'Uncategorized';
  // Handle both shapes: { city: "Mumbai" } or { city: { id, name } }
  const getLocPart = (v: unknown) =>
    typeof v === 'object' && v !== null && 'name' in v ? (v as { name: string }).name : (typeof v === 'string' ? v : '');
  const locationStr = [
    getLocPart(issue.location?.city),
    getLocPart(issue.location?.district),
    getLocPart(issue.location?.state),
  ].filter(Boolean).join(', ') || 'Location not specified';
  
  const tags = Array.isArray(issue.tags) 
    ? issue.tags.map(tag => typeof tag === 'string' ? tag : tag.name)
    : [];
  
  const score = issue.score !== undefined ? issue.score : (upvotes - downvotes);
  const createdAt = issue.created_at 
    ? formatDistanceToNow(new Date(issue.created_at), { addSuffix: true })
    : 'Recently';

  return (
    <Card className={cn("overflow-hidden border-border/80 shadow-card transition-all hover:border-primary/20 hover:shadow-card-hover md:hover:-translate-y-0.5", isDetail && "border-primary/10 shadow-none hover:shadow-none md:hover:translate-y-0")}>
      <div className="flex flex-col md:flex-row">
        {/* Vote Section */}
        <div className="flex items-center gap-2 border-b border-border bg-muted/40 p-3 dark:bg-muted/30 md:w-14 md:flex-col md:gap-1.5 md:border-b-0 md:border-r md:px-2 md:py-3">
          <Button 
            variant="ghost" 
            size="icon" 
            className={cn(
              "h-8 w-8 hover:bg-success/10 hover:text-success",
              voteState === 'upvote' && "bg-success/20 text-success"
            )}
            onClick={() => handleVote('upvote')}
            disabled={isVoting}
          >
            <ArrowUp className="h-5 w-5" />
          </Button>
          <span className="text-base font-semibold text-foreground md:text-lg">
            {score}
          </span>
          <Button 
            variant="ghost" 
            size="icon" 
            className={cn(
              "h-8 w-8 hover:bg-destructive/10 hover:text-destructive",
              voteState === 'downvote' && "bg-destructive/20 text-destructive"
            )}
            onClick={() => handleVote('downvote')}
            disabled={isVoting}
          >
            <ArrowDown className="h-5 w-5" />
          </Button>
        </div>

        {/* Content Section */}
        <div className="flex-1 p-4 md:p-5">
          <div className="mb-2.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground md:text-sm">
            <Badge variant="secondary" className="rounded-md px-2 py-0.5 text-[11px] md:text-xs">{categoryName}</Badge>
            <div className="inline-flex min-w-0 items-center gap-1">
              <MapPin className="h-3 w-3" />
              <span className="truncate max-w-[26ch] sm:max-w-[34ch] md:max-w-[30ch] lg:max-w-[40ch]">{locationStr}</span>
            </div>
            <span>•</span>
            <span>{createdAt}</span>
          </div>

          <Link to={`/issue/${issue.id}`} className="group">
            <h3 className="mb-2 text-lg font-semibold leading-tight text-foreground transition-colors group-hover:text-primary md:text-[1.35rem]">
              {issue.title}
            </h3>
          </Link>

          <div className="mb-3.5 flex flex-col gap-3 md:flex-row md:items-start md:gap-4">
            <div className="md:flex-1">
              <p className={cn("text-sm leading-relaxed text-muted-foreground md:text-[0.95rem]", !isDetail && "line-clamp-4")}>
                {issue.description}
              </p>

              {!!issue.top_comments?.length && (
                <div className="mt-6 space-y-1 text-xs text-muted-foreground">
                  <p className="font-medium uppercase tracking-wide text-muted-foreground/90">Top comments</p>
                  {issue.top_comments.slice(0, 2).map((comment) => (
                    <p key={comment.id} className="line-clamp-1">
                      <span className="font-medium text-foreground">{comment.author_name}</span>
                      <span className="mx-1">-</span>
                      <span>{comment.content}</span>
                    </p>
                  ))}
                </div>
              )}
            </div>

            {issue.first_image && imageVisible && (
              <div className="overflow-hidden rounded-xl border border-border/60 bg-muted/20 ring-1 ring-black/5 md:w-56 md:shrink-0 lg:w-64">
                <img
                  src={issue.first_image}
                  alt={issue.title}
                  className="aspect-[16/10] w-full object-cover object-center"
                  loading="lazy"
                  decoding="async"
                  onError={() => setImageVisible(false)}
                />
              </div>
            )}
          </div>

          {tags.length > 0 && (
            <div className="mb-3.5 flex flex-wrap gap-1.5">
              {tags.map((tag, index) => (
                <Badge key={index} variant="outline" className="rounded-md px-2 py-0.5 text-[11px]">
                  #{tag}
                </Badge>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between border-t border-border pt-3.5">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <span className="text-xs text-muted-foreground md:text-sm">
                Posted by{" "}
                <span className="font-medium text-foreground">
                  {issue.is_anonymous ? "Anonymous" : issue.author_name}
                </span>
              </span>
              {(issue.assigned_to_name || issue.workflow_stage_label) && (
                <span className="inline-flex items-center gap-1.5 rounded-md bg-primary/10 px-2 py-1 text-[11px] dark:bg-primary/20 md:text-xs">
                  <UserCheck className="h-3.5 w-3.5 text-primary shrink-0" />
                  {issue.assigned_to_name && (
                    <>
                      <span className="text-muted-foreground">Assigned to</span>
                      <span className="font-medium text-foreground">{issue.assigned_to_name}</span>
                      {issue.workflow_stage_label && <span className="text-muted-foreground">·</span>}
                    </>
                  )}
                  {issue.workflow_stage_label && (
                    <span className="font-medium text-primary">{issue.workflow_stage_label}</span>
                  )}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Link to={`/issue/${issue.id}`}>
                <Button variant="ghost" size="sm" className="h-8 gap-1 px-2.5">
                  <MessageSquare className="h-4 w-4" />
                  <span className="text-xs md:text-sm">{issue.comments_count}</span>
                </Button>
              </Link>
              <Button 
                variant="ghost" 
                size="sm"
                className="h-8 px-2.5"
                onClick={() => {
                  navigator.clipboard.writeText(window.location.origin + `/issue/${issue.id}`);
                  toast({
                    title: "Link copied!",
                    description: "Issue link has been copied to clipboard.",
                  });
                }}
              >
                <Share2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
};
