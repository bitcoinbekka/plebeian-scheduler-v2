import { useEffect, useRef, useCallback } from 'react';
import { useNostr } from '@nostrify/react';
import { useCurrentUser } from './useCurrentUser';
import { useScheduler } from '@/contexts/SchedulerContext';
import { useToast } from '@/hooks/useToast';
import { buildEvent } from '@/lib/eventBuilder';
import type { SchedulerPost } from '@/lib/types';

const POLL_INTERVAL = 10_000; // Check every 10 seconds

/**
 * Hook that periodically checks for due scheduled posts and publishes them.
 * This runs in the browser while the app is open — for offline scheduling,
 * use DVM (NIP-90) delegation instead.
 */
export function useSchedulerPublish() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const { posts, markPublished, markFailed } = useScheduler();
  const { toast } = useToast();
  const publishingRef = useRef(new Set<string>());

  const publishPost = useCallback(async (post: SchedulerPost) => {
    if (!user || publishingRef.current.has(post.id)) return;

    publishingRef.current.add(post.id);

    const label = post.kind === 'listing'
      ? post.listingFields?.title || 'Untitled Listing'
      : post.kind === 'article'
        ? post.articleFields?.title || 'Untitled Article'
        : post.content.slice(0, 40) || 'Note';

    console.log(`[Scheduler] Publishing "${label}" (post ${post.id})...`);

    try {
      const eventData = buildEvent(post, false);
      const signedEvent = await user.signer.signEvent({
        kind: eventData.kind,
        content: eventData.content,
        tags: eventData.tags,
        created_at: eventData.created_at,
      });

      await nostr.event(signedEvent, { signal: AbortSignal.timeout(15000) });
      markPublished(post.id, signedEvent.id);

      console.log(`[Scheduler] Published! Event ID: ${signedEvent.id}`);
      toast({
        title: `Published: ${label}`,
        description: `Event ${signedEvent.id.slice(0, 12)}... published to relays (kind ${signedEvent.kind})`,
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      markFailed(post.id, msg);
      console.error(`[Scheduler] Failed to publish "${label}":`, error);
      toast({
        title: `Failed: ${label}`,
        description: msg,
        variant: 'destructive',
      });
    } finally {
      publishingRef.current.delete(post.id);
    }
  }, [user, nostr, markPublished, markFailed, toast]);

  // Poll for due posts
  useEffect(() => {
    if (!user) return;

    const checkDuePosts = () => {
      const now = Math.floor(Date.now() / 1000);
      const duePosts = posts.filter(
        p => p.status === 'scheduled' &&
          p.scheduledAt !== null &&
          p.scheduledAt <= now &&
          !p.useDvm
      );

      if (duePosts.length > 0) {
        console.log(`[Scheduler] Found ${duePosts.length} due post(s), publishing...`);
      }

      for (const post of duePosts) {
        publishPost(post);
      }
    };

    // Check immediately on mount and whenever posts change
    checkDuePosts();

    // Then poll on interval
    const interval = setInterval(checkDuePosts, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [user, posts, publishPost]);
}
