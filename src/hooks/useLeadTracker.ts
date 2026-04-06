import { useMemo } from 'react';
import { useNostr } from '@nostrify/react';
import { useQuery } from '@tanstack/react-query';
import { useCurrentUser } from './useCurrentUser';
import { useMyPublishedPosts } from './useMyPublishedPosts';
import type { Lead, LeadInteraction } from '@/lib/leadTypes';
import { calculateLeadScore } from '@/lib/leadTypes';

/**
 * Fetch ALL engagement (reactions, zaps, reposts) on the current user's posts
 * from Nostr relays, then build a ranked lead list.
 *
 * This is the core hook that powers the Lead Tracker.
 */
export function useLeadTracker() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const { data: myPosts, isLoading: postsLoading } = useMyPublishedPosts();

  const postIds = useMemo(
    () => (myPosts || []).map(e => e.id),
    [myPosts],
  );

  const { data: leads, isLoading: engagementLoading } = useQuery({
    queryKey: ['lead-tracker', user?.pubkey, ...postIds.slice(0, 20)],
    queryFn: async () => {
      if (!user || postIds.length === 0) return [];

      // Fetch reactions (kind 7), zap receipts (kind 9735), and reposts (kind 6)
      const events = await nostr.query([{
        kinds: [7, 9735, 6],
        '#e': postIds,
        limit: 2000,
      }], { signal: AbortSignal.timeout(15000) });

      // Build a map of pubkey -> interactions
      const leadMap = new Map<string, {
        reactions: number;
        zaps: number;
        sats: number;
        postIds: Set<string>;
        firstSeen: number;
        lastSeen: number;
        interactions: LeadInteraction[];
      }>();

      const ensureLead = (pubkey: string) => {
        if (!leadMap.has(pubkey)) {
          leadMap.set(pubkey, {
            reactions: 0,
            zaps: 0,
            sats: 0,
            postIds: new Set(),
            firstSeen: Infinity,
            lastSeen: 0,
            interactions: [],
          });
        }
        return leadMap.get(pubkey)!;
      };

      for (const event of events) {
        // Skip our own interactions
        if (event.pubkey === user.pubkey) continue;

        const targetEventId = event.tags.find(([n]) => n === 'e')?.[1];
        if (!targetEventId) continue;

        if (event.kind === 7) {
          // Reaction
          const lead = ensureLead(event.pubkey);
          lead.reactions++;
          lead.postIds.add(targetEventId);
          lead.firstSeen = Math.min(lead.firstSeen, event.created_at);
          lead.lastSeen = Math.max(lead.lastSeen, event.created_at);
          lead.interactions.push({
            eventId: event.id,
            type: 'reaction',
            emoji: event.content === '' || event.content === '+' ? '❤️' : event.content,
            targetEventId,
            timestamp: event.created_at,
          });
        } else if (event.kind === 9735) {
          // Zap receipt - extract the actual zapper from the description
          const descTag = event.tags.find(([n]) => n === 'description')?.[1];
          if (!descTag) continue;
          let zapperPubkey: string | null = null;
          try {
            const zapReq = JSON.parse(descTag);
            zapperPubkey = zapReq.pubkey;
          } catch { continue; }
          if (!zapperPubkey || zapperPubkey === user.pubkey) continue;

          // Get sats amount
          let sats = 0;
          const amountTag = event.tags.find(([n]) => n === 'amount')?.[1];
          if (amountTag) {
            sats = Math.floor(parseInt(amountTag) / 1000);
          }

          const lead = ensureLead(zapperPubkey);
          lead.zaps++;
          lead.sats += sats;
          lead.postIds.add(targetEventId);
          lead.firstSeen = Math.min(lead.firstSeen, event.created_at);
          lead.lastSeen = Math.max(lead.lastSeen, event.created_at);
          lead.interactions.push({
            eventId: event.id,
            type: 'zap',
            sats,
            targetEventId,
            timestamp: event.created_at,
          });
        } else if (event.kind === 6) {
          // Repost
          const lead = ensureLead(event.pubkey);
          lead.postIds.add(targetEventId);
          lead.firstSeen = Math.min(lead.firstSeen, event.created_at);
          lead.lastSeen = Math.max(lead.lastSeen, event.created_at);
          lead.interactions.push({
            eventId: event.id,
            type: 'repost',
            targetEventId,
            timestamp: event.created_at,
          });
        }
      }

      // Convert map to sorted Lead array
      const now = Math.floor(Date.now() / 1000);
      const twoWeeksAgo = now - (14 * 86400);
      const fourWeeksAgo = now - (28 * 86400);

      const result: Lead[] = [];
      for (const [pubkey, data] of leadMap) {
        const postsInteracted = data.postIds.size;
        const daysSinceLastSeen = Math.floor((now - data.lastSeen) / 86400);

        // Calculate trend
        const recentInteractions = data.interactions.filter(i => i.timestamp > twoWeeksAgo).length;
        const olderInteractions = data.interactions.filter(i => i.timestamp > fourWeeksAgo && i.timestamp <= twoWeeksAgo).length;
        let trend: Lead['trend'] = 'stable';
        if (recentInteractions > olderInteractions + 1) trend = 'rising';
        else if (recentInteractions < olderInteractions - 1) trend = 'cooling';

        const lead: Lead = {
          pubkey,
          totalReactions: data.reactions,
          totalZaps: data.zaps,
          totalSats: data.sats,
          postsInteracted,
          firstSeen: data.firstSeen === Infinity ? now : data.firstSeen,
          lastSeen: data.lastSeen || now,
          interactions: data.interactions.sort((a, b) => b.timestamp - a.timestamp),
          daysSinceLastSeen,
          isRepeatEngager: postsInteracted >= 3,
          trend,
          score: 0,
        };
        lead.score = calculateLeadScore(lead);
        result.push(lead);
      }

      // Sort by score descending
      result.sort((a, b) => b.score - a.score);
      return result;
    },
    enabled: !!user && postIds.length > 0,
    staleTime: 2 * 60_000,
    refetchInterval: 5 * 60_000,
  });

  return {
    leads: leads || [],
    isLoading: postsLoading || engagementLoading,
    postCount: postIds.length,
  };
}
