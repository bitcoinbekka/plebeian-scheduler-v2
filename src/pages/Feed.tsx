import { useState, useMemo, useCallback } from 'react';
import { useSeoMeta } from '@unhead/react';
import { Link } from 'react-router-dom';
import { useNostr } from '@nostrify/react';
import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import { nip19 } from 'nostr-tools';
import type { NostrEvent, NostrMetadata } from '@nostrify/nostrify';
import {
  Loader2,
  Heart,
  Repeat2,
  MessageSquare,
  Globe,
  Zap,
  Clock,
  RefreshCw,
  Users,
  ImageIcon,
  ExternalLink,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { NoteContent } from '@/components/NoteContent';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useAuthor } from '@/hooks/useAuthor';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import { useToast } from '@/hooks/useToast';
import { genUserName } from '@/lib/genUserName';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

const FEED_LIMIT = 20;

/** Individual post card with author info */
function FeedPost({ event }: { event: NostrEvent }) {
  const author = useAuthor(event.pubkey);
  const metadata: NostrMetadata | undefined = author.data?.metadata;
  const displayName = metadata?.display_name || metadata?.name || genUserName(event.pubkey);
  const npub = useMemo(() => nip19.npubEncode(event.pubkey), [event.pubkey]);
  const noteId = useMemo(() => nip19.noteEncode(event.id), [event.id]);
  const { mutateAsync: publishEvent } = useNostrPublish();
  const { user } = useCurrentUser();
  const { toast } = useToast();
  const [isReacting, setIsReacting] = useState(false);
  const [isReposting, setIsReposting] = useState(false);

  // Get images from content (URLs ending in image extensions)
  const images = useMemo(() => {
    const urlRegex = /https?:\/\/[^\s]+\.(jpg|jpeg|png|gif|webp|svg)(\?[^\s]*)?/gi;
    return [...event.content.matchAll(urlRegex)].map(m => m[0]);
  }, [event.content]);

  const handleReaction = useCallback(async () => {
    if (!user) return;
    setIsReacting(true);
    try {
      await publishEvent({
        kind: 7,
        content: '+',
        tags: [
          ['e', event.id],
          ['p', event.pubkey],
        ],
      });
      toast({ title: 'Liked!' });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    } finally {
      setIsReacting(false);
    }
  }, [user, publishEvent, event, toast]);

  const handleRepost = useCallback(async () => {
    if (!user) return;
    setIsReposting(true);
    try {
      await publishEvent({
        kind: 6,
        content: '',
        tags: [
          ['e', event.id, '', 'mention'],
          ['p', event.pubkey],
        ],
      });
      toast({ title: 'Reposted!' });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    } finally {
      setIsReposting(false);
    }
  }, [user, publishEvent, event, toast]);

  return (
    <Card className="group hover:shadow-md transition-all duration-200 hover:border-primary/10 overflow-hidden">
      <CardContent className="p-4 space-y-3">
        {/* Author row */}
        <div className="flex items-center gap-3">
          <Link to={`/${npub}`}>
            <Avatar className="w-10 h-10 ring-2 ring-transparent hover:ring-primary/20 transition-all">
              <AvatarImage src={metadata?.picture} alt={displayName} />
              <AvatarFallback className="text-xs bg-primary/10 text-primary">
                {displayName.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          </Link>
          <div className="flex-1 min-w-0">
            <Link to={`/${npub}`} className="hover:underline">
              <p className="text-sm font-semibold truncate">{displayName}</p>
            </Link>
            {metadata?.nip05 && (
              <p className="text-[11px] text-muted-foreground truncate">{metadata.nip05}</p>
            )}
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="text-xs text-muted-foreground flex items-center gap-1 shrink-0">
                <Clock className="w-3 h-3" />
                {formatDistanceToNow(new Date(event.created_at * 1000), { addSuffix: true })}
              </span>
            </TooltipTrigger>
            <TooltipContent className="text-xs">
              {new Date(event.created_at * 1000).toLocaleString()}
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Content */}
        <div className="whitespace-pre-wrap break-words">
          <NoteContent event={event} className="text-sm leading-relaxed" />
        </div>

        {/* Image gallery */}
        {images.length > 0 && (
          <div className={cn(
            'grid gap-2 mt-2',
            images.length === 1 && 'grid-cols-1',
            images.length === 2 && 'grid-cols-2',
            images.length >= 3 && 'grid-cols-2 sm:grid-cols-3',
          )}>
            {images.slice(0, 4).map((url, idx) => (
              <a
                key={idx}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  'relative rounded-lg overflow-hidden border bg-muted block',
                  images.length === 1 ? 'aspect-video' : 'aspect-square',
                )}
              >
                <img src={url} alt="" className="w-full h-full object-cover hover:scale-105 transition-transform duration-300" />
                {idx === 3 && images.length > 4 && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <span className="text-white font-bold text-lg">+{images.length - 4}</span>
                  </div>
                )}
              </a>
            ))}
          </div>
        )}

        {/* Actions bar */}
        <div className="flex items-center gap-1 pt-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 text-xs h-8 text-muted-foreground hover:text-rose-500"
                onClick={handleReaction}
                disabled={!user || isReacting}
              >
                {isReacting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Heart className="w-3.5 h-3.5" />}
                Like
              </Button>
            </TooltipTrigger>
            {!user && <TooltipContent className="text-xs">Log in to like</TooltipContent>}
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 text-xs h-8 text-muted-foreground hover:text-emerald-500"
                onClick={handleRepost}
                disabled={!user || isReposting}
              >
                {isReposting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Repeat2 className="w-3.5 h-3.5" />}
                Repost
              </Button>
            </TooltipTrigger>
            {!user && <TooltipContent className="text-xs">Log in to repost</TooltipContent>}
          </Tooltip>

          <div className="flex-1" />

          <Tooltip>
            <TooltipTrigger asChild>
              <a
                href={`https://njump.me/${noteId}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button variant="ghost" size="icon" className="w-8 h-8 text-muted-foreground hover:text-foreground">
                  <ExternalLink className="w-3.5 h-3.5" />
                </Button>
              </a>
            </TooltipTrigger>
            <TooltipContent className="text-xs">View on Nostr</TooltipContent>
          </Tooltip>
        </div>
      </CardContent>
    </Card>
  );
}

/** Loading skeleton for feed posts */
function FeedPostSkeleton() {
  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-3">
          <Skeleton className="w-10 h-10 rounded-full" />
          <div className="space-y-1.5 flex-1">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-20" />
          </div>
          <Skeleton className="h-3 w-16" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-4/5" />
          <Skeleton className="h-4 w-3/5" />
        </div>
      </CardContent>
    </Card>
  );
}

export default function Feed() {
  useSeoMeta({
    title: 'Feed - Plebeian Scheduler',
    description: 'See what people you follow are posting on Nostr.',
  });

  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const { toast } = useToast();
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Step 1: Fetch the user's follow list (kind 3)
  const { data: followPubkeys, isLoading: followsLoading } = useQuery({
    queryKey: ['follow-list', user?.pubkey],
    queryFn: async () => {
      if (!user?.pubkey) return [];
      const events = await nostr.query([{
        kinds: [3],
        authors: [user.pubkey],
        limit: 1,
      }]);
      if (events.length === 0) return [];
      // Extract p-tag pubkeys
      const pubkeys = events[0].tags
        .filter(([name]) => name === 'p')
        .map(([, pubkey]) => pubkey)
        .filter(Boolean);
      return pubkeys;
    },
    enabled: !!user?.pubkey,
  });

  // Step 2: Fetch posts from followed accounts
  const {
    data: feedPages,
    isLoading: feedLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    refetch,
  } = useInfiniteQuery({
    queryKey: ['feed', followPubkeys?.slice(0, 20)?.join(',')],
    queryFn: async ({ pageParam }) => {
      if (!followPubkeys || followPubkeys.length === 0) return [];
      // Limit authors per query to avoid relay overload
      const authors = followPubkeys.slice(0, 150);
      const filter: Record<string, unknown> = {
        kinds: [1],
        authors,
        limit: FEED_LIMIT,
      };
      if (pageParam) {
        filter.until = pageParam;
      }
      const events = await nostr.query([filter as Parameters<typeof nostr.query>[0][0]]);
      return events;
    },
    initialPageParam: undefined as number | undefined,
    getNextPageParam: (lastPage) => {
      if (!lastPage || lastPage.length < FEED_LIMIT) return undefined;
      const oldest = lastPage[lastPage.length - 1];
      return oldest ? oldest.created_at - 1 : undefined;
    },
    enabled: !!followPubkeys && followPubkeys.length > 0,
  });

  // Flatten all pages into a single sorted array, deduplicated
  const feedEvents = useMemo(() => {
    if (!feedPages?.pages) return [];
    const all = feedPages.pages.flat();
    const seen = new Set<string>();
    const deduped: NostrEvent[] = [];
    for (const e of all) {
      if (!seen.has(e.id)) {
        seen.add(e.id);
        deduped.push(e);
      }
    }
    return deduped.sort((a, b) => b.created_at - a.created_at);
  }, [feedPages]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await refetch();
    setIsRefreshing(false);
    toast({ title: 'Feed refreshed' });
  }, [refetch, toast]);

  const isLoading = followsLoading || feedLoading;

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Feed</h1>
          <p className="text-muted-foreground mt-1">
            Latest notes from people you follow
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={handleRefresh}
          disabled={isRefreshing || isLoading}
        >
          <RefreshCw className={cn('w-4 h-4', isRefreshing && 'animate-spin')} />
          Refresh
        </Button>
      </div>

      {followPubkeys && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Users className="w-3.5 h-3.5" />
          Following {followPubkeys.length} account{followPubkeys.length !== 1 ? 's' : ''}
        </div>
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="space-y-4">
          <FeedPostSkeleton />
          <FeedPostSkeleton />
          <FeedPostSkeleton />
        </div>
      )}

      {/* Empty: no follows */}
      {!isLoading && followPubkeys && followPubkeys.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center space-y-3">
            <Users className="w-10 h-10 mx-auto text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">
              You&apos;re not following anyone yet.
            </p>
            <p className="text-xs text-muted-foreground">
              Follow people on Nostr to see their posts here. You can discover people on{' '}
              <a href="https://njump.me" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                njump.me
              </a>{' '}
              or{' '}
              <a href="https://primal.net" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                primal.net
              </a>
            </p>
          </CardContent>
        </Card>
      )}

      {/* Empty: has follows but no posts */}
      {!isLoading && followPubkeys && followPubkeys.length > 0 && feedEvents.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center space-y-3">
            <MessageSquare className="w-10 h-10 mx-auto text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">
              No recent posts from your follows.
            </p>
            <p className="text-xs text-muted-foreground">
              Try refreshing or check your relay connections in Settings.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Feed posts */}
      {feedEvents.length > 0 && (
        <div className="space-y-4">
          {feedEvents.map(event => (
            <FeedPost key={event.id} event={event} />
          ))}

          {/* Load more */}
          {hasNextPage && (
            <div className="text-center py-4">
              <Button
                variant="outline"
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
                className="gap-2"
              >
                {isFetchingNextPage ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Clock className="w-4 h-4" />
                )}
                Load older posts
              </Button>
            </div>
          )}

          {!hasNextPage && feedEvents.length > 0 && (
            <p className="text-center text-xs text-muted-foreground py-4">
              You&apos;ve reached the end
            </p>
          )}
        </div>
      )}
    </div>
  );
}
