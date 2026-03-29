import { useEffect, useRef, useCallback } from 'react';
import { useNostr } from '@nostrify/react';
import { useCurrentUser } from './useCurrentUser';
import { useScheduler } from '@/contexts/SchedulerContext';
import { buildEvent } from '@/lib/eventBuilder';
import type { SchedulerPost } from '@/lib/types';

/**
 * Hook that periodically checks for due scheduled posts and publishes them.
 * This runs in the browser while the app is open - for offline scheduling,
 * use DVM (NIP-90) delegation.
 */
export function useSchedulerPublish() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const { posts, markPublished, markFailed } = useScheduler();
  const publishingRef = useRef(new Set<string>());

  const publishPost = useCallback(async (post: SchedulerPost) => {
    if (!user || publishingRef.current.has(post.id)) return;

    publishingRef.current.add(post.id);

    try {
      const eventData = buildEvent(post, false);
      const signedEvent = await user.signer.signEvent({
        kind: eventData.kind,
        content: eventData.content,
        tags: eventData.tags,
        created_at: eventData.created_at,
      });

      await nostr.event(signedEvent, { signal: AbortSignal.timeout(10000) });
      markPublished(post.id, signedEvent.id);
      console.log(`[Scheduler] Published event ${signedEvent.id} for post ${post.id}`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      markFailed(post.id, msg);
      console.error(`[Scheduler] Failed to publish post ${post.id}:`, error);
    } finally {
      publishingRef.current.delete(post.id);
    }
  }, [user, nostr, markPublished, markFailed]);

  // Check every 30 seconds for due posts
  useEffect(() => {
    if (!user) return;

    const checkDuePosts = () => {
      const now = Math.floor(Date.now() / 1000);
      const duePosts = posts.filter(
        p => p.status === 'scheduled' &&
          p.scheduledAt !== null &&
          p.scheduledAt <= now &&
          !p.useDvm // Don't auto-publish DVM posts - they delegate
      );

      for (const post of duePosts) {
        publishPost(post);
      }
    };

    // Check immediately
    checkDuePosts();

    // Then check every 30 seconds
    const interval = setInterval(checkDuePosts, 30000);
    return () => clearInterval(interval);
  }, [user, posts, publishPost]);
}
