import { useNostr } from '@nostrify/react';
import { useQuery } from '@tanstack/react-query';
import { nip57 } from 'nostr-tools';
import type { NostrEvent } from '@nostrify/nostrify';

export interface PostEngagement {
  /** Total like/reaction count (kind 7) */
  reactionCount: number;
  /** Total zap receipts (kind 9735) */
  zapCount: number;
  /** Total sats received from zaps */
  totalSats: number;
  /** Unique reactors (by pubkey) */
  uniqueReactors: number;
  /** Unique zappers */
  uniqueZappers: number;
  /** Top emoji reactions (emoji → count) */
  reactions: Record<string, number>;
  /** Raw zap events for the ZapButton */
  zapEvents: NostrEvent[];
  /** Raw reaction events */
  reactionEvents: NostrEvent[];
}

const EMPTY: PostEngagement = {
  reactionCount: 0,
  zapCount: 0,
  totalSats: 0,
  uniqueReactors: 0,
  uniqueZappers: 0,
  reactions: {},
  zapEvents: [],
  reactionEvents: [],
};

/**
 * Fetch engagement (reactions + zaps) for a single published event.
 * Pass the published Nostr event ID (hex).
 */
export function usePostEngagement(eventId: string | null | undefined) {
  const { nostr } = useNostr();

  return useQuery({
    queryKey: ['post-engagement', eventId],
    queryFn: async () => {
      if (!eventId) return EMPTY;

      // Fetch reactions (kind 7) and zap receipts (kind 9735) in one query
      const events = await nostr.query([{
        kinds: [7, 9735],
        '#e': [eventId],
        limit: 500,
      }], { signal: AbortSignal.timeout(10000) });

      const reactionEvents = events.filter(e => e.kind === 7);
      const zapEvents = events.filter(e => e.kind === 9735);

      // Count reactions by emoji
      const reactions: Record<string, number> = {};
      const reactorPubkeys = new Set<string>();
      for (const event of reactionEvents) {
        reactorPubkeys.add(event.pubkey);
        const emoji = event.content === '' || event.content === '+' ? '❤️' : event.content;
        reactions[emoji] = (reactions[emoji] || 0) + 1;
      }

      // Sum zap amounts
      let totalSats = 0;
      const zapperPubkeys = new Set<string>();
      for (const zap of zapEvents) {
        // Extract zapper pubkey from description tag (zap request)
        const descriptionTag = zap.tags.find(([name]) => name === 'description')?.[1];
        if (descriptionTag) {
          try {
            const zapRequest = JSON.parse(descriptionTag);
            if (zapRequest.pubkey) {
              zapperPubkeys.add(zapRequest.pubkey);
            }
          } catch { /* ignore */ }
        }

        // Extract amount — try amount tag first, then bolt11
        const amountTag = zap.tags.find(([name]) => name === 'amount')?.[1];
        if (amountTag) {
          totalSats += Math.floor(parseInt(amountTag) / 1000);
          continue;
        }
        const bolt11Tag = zap.tags.find(([name]) => name === 'bolt11')?.[1];
        if (bolt11Tag) {
          try {
            totalSats += nip57.getSatoshisAmountFromBolt11(bolt11Tag);
          } catch { /* ignore */ }
        }
      }

      return {
        reactionCount: reactionEvents.length,
        zapCount: zapEvents.length,
        totalSats,
        uniqueReactors: reactorPubkeys.size,
        uniqueZappers: zapperPubkeys.size,
        reactions,
        zapEvents,
        reactionEvents,
      } satisfies PostEngagement;
    },
    enabled: !!eventId,
    staleTime: 60_000, // 1 minute
    refetchInterval: 120_000, // 2 minutes
  });
}

/**
 * Fetch engagement for multiple published event IDs at once.
 * Returns a map from eventId → PostEngagement.
 */
export function useBatchEngagement(eventIds: string[]) {
  const { nostr } = useNostr();

  return useQuery({
    queryKey: ['batch-engagement', ...eventIds.sort()],
    queryFn: async () => {
      if (eventIds.length === 0) return new Map<string, PostEngagement>();

      // Single query for all event IDs — high limit to capture all engagement
      const events = await nostr.query([{
        kinds: [7, 9735],
        '#e': eventIds,
        limit: 2000,
      }], { signal: AbortSignal.timeout(15000) });

      // Group by referenced event ID
      const byEventId = new Map<string, { reactions: NostrEvent[]; zaps: NostrEvent[] }>();
      for (const id of eventIds) {
        byEventId.set(id, { reactions: [], zaps: [] });
      }

      for (const event of events) {
        // Find which event this relates to
        const eTag = event.tags.find(([name]) => name === 'e')?.[1];
        if (!eTag || !byEventId.has(eTag)) continue;

        const bucket = byEventId.get(eTag)!;
        if (event.kind === 7) bucket.reactions.push(event);
        else if (event.kind === 9735) bucket.zaps.push(event);
      }

      // Process each
      const result = new Map<string, PostEngagement>();
      for (const [id, { reactions: reactionEvents, zaps: zapEvents }] of byEventId) {
        const reactions: Record<string, number> = {};
        const reactorPubkeys = new Set<string>();
        for (const event of reactionEvents) {
          reactorPubkeys.add(event.pubkey);
          const emoji = event.content === '' || event.content === '+' ? '❤️' : event.content;
          reactions[emoji] = (reactions[emoji] || 0) + 1;
        }

        let totalSats = 0;
        const zapperPubkeys = new Set<string>();
        for (const zap of zapEvents) {
          const descriptionTag = zap.tags.find(([name]) => name === 'description')?.[1];
          if (descriptionTag) {
            try {
              const zapRequest = JSON.parse(descriptionTag);
              if (zapRequest.pubkey) zapperPubkeys.add(zapRequest.pubkey);
            } catch { /* ignore */ }
          }
          const amountTag = zap.tags.find(([name]) => name === 'amount')?.[1];
          if (amountTag) {
            totalSats += Math.floor(parseInt(amountTag) / 1000);
            continue;
          }
          const bolt11Tag = zap.tags.find(([name]) => name === 'bolt11')?.[1];
          if (bolt11Tag) {
            try { totalSats += nip57.getSatoshisAmountFromBolt11(bolt11Tag); } catch { /* ignore */ }
          }
        }

        result.set(id, {
          reactionCount: reactionEvents.length,
          zapCount: zapEvents.length,
          totalSats,
          uniqueReactors: reactorPubkeys.size,
          uniqueZappers: zapperPubkeys.size,
          reactions,
          zapEvents,
          reactionEvents,
        });
      }

      return result;
    },
    enabled: eventIds.length > 0,
    staleTime: 60_000,
    refetchInterval: 120_000,
  });
}
