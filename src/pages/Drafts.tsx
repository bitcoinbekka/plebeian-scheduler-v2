import { useSeoMeta } from '@unhead/react';
import { Link } from 'react-router-dom';
import {
  FileText,
  ShoppingBag,
  MessageSquare,
  Trash2,
  PenSquare,
  CalendarClock,
  Clock,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useScheduler } from '@/contexts/SchedulerContext';
import { useToast } from '@/hooks/useToast';
import { formatDistanceToNow } from 'date-fns';
import type { SchedulerPost } from '@/lib/types';

/** Get a human-friendly title for a promo note */
function getPostTitle(post: SchedulerPost): string {
  if (post.importedListing?.title) return post.importedListing.title;
  return post.content.slice(0, 80) || 'Empty note';
}

export default function Drafts() {
  useSeoMeta({
    title: 'Drafts - Plebeian Scheduler',
    description: 'Manage your draft promotional posts.',
  });

  const { posts, removePost } = useScheduler();
  const { toast } = useToast();

  const drafts = posts
    .filter(p => p.status === 'draft')
    .sort((a, b) => b.updatedAt - a.updatedAt);

  const handleDelete = (id: string) => {
    removePost(id);
    toast({ title: 'Draft deleted' });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Drafts</h1>
          <p className="text-muted-foreground mt-1">
            {drafts.length} draft{drafts.length !== 1 ? 's' : ''} saved locally
          </p>
        </div>
        <Link to="/compose">
          <Button className="gap-2">
            <PenSquare className="w-4 h-4" />
            New Note
          </Button>
        </Link>
      </div>

      {drafts.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 px-8 text-center">
            <div className="max-w-sm mx-auto space-y-4">
              <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center mx-auto">
                <FileText className="w-6 h-6 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium">No drafts yet</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Start composing a promo note and save it as a draft to come back later.
                </p>
              </div>
              <Link to="/compose">
                <Button variant="outline" className="gap-2">
                  <PenSquare className="w-4 h-4" />
                  Create Your First Draft
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {drafts.map(post => {
            const hasListing = !!post.importedListing;
            const title = getPostTitle(post);
            const preview = post.content.slice(0, 120) || 'No content';

            return (
              <Card key={post.id} className="hover:shadow-md transition-shadow duration-200 group">
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${hasListing ? 'bg-primary/10 text-primary' : 'bg-blue-500/10 text-blue-500'}`}>
                      {hasListing ? <ShoppingBag className="w-5 h-5" /> : <MessageSquare className="w-5 h-5" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          {hasListing && (
                            <h3 className="font-semibold text-sm truncate">{title}</h3>
                          )}
                          <p className="text-sm text-muted-foreground line-clamp-2 mt-0.5">
                            {preview}
                          </p>
                        </div>
                        <Badge variant="outline" className="shrink-0 text-xs">
                          {hasListing ? 'Promo' : 'Note'}
                        </Badge>
                      </div>

                      <div className="flex items-center gap-4 mt-3">
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatDistanceToNow(new Date(post.updatedAt * 1000), { addSuffix: true })}
                        </span>

                        {post.importedListing?.price && (
                          <span className="text-xs font-medium text-primary">
                            {post.importedListing.price} {post.importedListing.currency}
                          </span>
                        )}

                        {post.media.length > 0 && (
                          <span className="text-xs text-muted-foreground">
                            {post.media.length} image{post.media.length !== 1 ? 's' : ''}
                          </span>
                        )}

                        <div className="flex-1" />

                        <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Link to={`/compose?edit=${post.id}`}>
                            <Button variant="ghost" size="sm" className="gap-1.5 h-8">
                              <PenSquare className="w-3.5 h-3.5" />
                              Edit
                            </Button>
                          </Link>
                          <Link to={`/compose?edit=${post.id}`}>
                            <Button variant="ghost" size="sm" className="gap-1.5 h-8">
                              <CalendarClock className="w-3.5 h-3.5" />
                              Schedule
                            </Button>
                          </Link>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete draft?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This draft will be permanently removed.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDelete(post.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
