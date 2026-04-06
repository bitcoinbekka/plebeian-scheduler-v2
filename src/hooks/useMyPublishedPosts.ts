import { useNostr } from '@nostrify/react';
import { useQuery } from '@tanstack/react-query';
import { useCurrentUser } from './useCurrentUser';
import type { NostrEvent } from '@nostrify/nostrify';

/**
 * Fetch all published posts (kind 1 + kind 30023) by the current user
 * directly from Nostr relays. This gives us the full picture of the
 * user's posting history regardless of which client they used.
 */
export function useMyPublishedPosts() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();

  return useQuery({
    queryKey: ['my-published-posts', user?.pubkey],
    queryFn: async () => {
      if (!user) return [];

      // Fetch kind 1 (short notes) and kind 30023 (long-form articles) in one query
      const events = await nostr.query([{
        kinds: [1, 30023],
        authors: [user.pubkey],
        limit: 500,
      }], { signal: AbortSignal.timeout(15000) });

      // Sort by created_at descending (most recent first)
      return events.sort((a, b) => b.created_at - a.created_at);
    },
    enabled: !!user,
    staleTime: 2 * 60_000, // 2 minutes
    refetchInterval: 5 * 60_000, // 5 minutes
  });
}

/** Minimal post info derived from a NostrEvent for the analytics page */
export interface AnalyticsPost {
  id: string;
  eventId: string;
  kind: number;
  content: string;
  title: string;
  postType: 'short' | 'long' | 'promo';
  publishedAt: number;
  tags: string[][];
  /** If this post was also tracked by the scheduler, include the listing info */
  listingTitle?: string;
}

/** Convert a NostrEvent into an AnalyticsPost */
export function eventToAnalyticsPost(event: NostrEvent, listingTitle?: string): AnalyticsPost {
  const isLong = event.kind === 30023;
  const title = isLong
    ? (event.tags.find(([n]) => n === 'title')?.[1] || '')
    : '';

  return {
    id: event.id,
    eventId: event.id,
    kind: event.kind,
    content: event.content,
    title,
    postType: isLong ? 'long' : listingTitle ? 'promo' : 'short',
    publishedAt: event.created_at,
    tags: event.tags,
    listingTitle,
  };
}
