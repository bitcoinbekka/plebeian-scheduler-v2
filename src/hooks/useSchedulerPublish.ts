import { useEffect, useRef, useCallback } from 'react';
import { useNostr } from '@nostrify/react';
import { useCurrentUser } from './useCurrentUser';
import { useScheduler } from '@/contexts/SchedulerContext';
import { useToast } from '@/hooks/useToast';
import { buildEvent } from '@/lib/eventBuilder';
import type { SchedulerPost } from '@/lib/types';

const POLL_INTERVAL = 10_000; // Check every 10 seconds

/**
 * Hook that polls for scheduled posts and publishes them when due.
 *
 * When `scheduledAt <= now` and the post is still in 'scheduled' status,
 * it signs the kind 1 event via the user's signer and publishes it
 * directly to connected relays.
 *
 * **Important**: The browser tab must remain open for scheduled posts
 * to be published. This is a client-side scheduler.
 */
export function useSchedulerPublish() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const { posts, markPublished, markFailed } = useScheduler();
  const { toast } = useToast();
  const publishingRef = useRef(new Set<string>());

  const getLabel = (post: SchedulerPost) => {
    if (post.importedListing?.title) return post.importedListing.title;
    return post.content.slice(0, 40) || 'Note';
  };

  // Publish a post directly — signs and sends the kind 1 event to relays
  const publishPost = useCallback(async (post: SchedulerPost) => {
    if (!user || publishingRef.current.has(post.id)) return;
    publishingRef.current.add(post.id);

    const label = getLabel(post);
    console.log(`[Scheduler] Publishing "${label}" (post ${post.id})...`);

    try {
      const eventData = buildEvent(post);
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
        description: `Event ${signedEvent.id.slice(0, 12)}... published to relays.`,
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

  // Poll for due posts every POLL_INTERVAL
  useEffect(() => {
    if (!user) return;

    const checkDuePosts = () => {
      const now = Math.floor(Date.now() / 1000);

      const duePosts = posts.filter(
        p => p.status === 'scheduled' &&
          p.scheduledAt !== null &&
          p.scheduledAt <= now
      );

      if (duePosts.length > 0) {
        console.log(`[Scheduler] Found ${duePosts.length} due post(s), publishing...`);
      }

      for (const post of duePosts) {
        publishPost(post);
      }
    };

    // Check immediately on mount
    checkDuePosts();

    // Then poll on interval
    const interval = setInterval(checkDuePosts, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [user, posts, publishPost]);
}
