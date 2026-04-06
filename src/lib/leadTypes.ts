/** Lead tag categories for manual classification */
export type LeadTag = 'hot' | 'warm' | 'cold' | 'customer' | 'vip' | 'new';

export const LEAD_TAG_CONFIG: Record<LeadTag, { label: string; color: string; emoji: string }> = {
  hot: { label: 'Hot Lead', color: 'text-red-500 bg-red-500/10 border-red-500/20', emoji: '🔥' },
  warm: { label: 'Warm Lead', color: 'text-orange-500 bg-orange-500/10 border-orange-500/20', emoji: '☀️' },
  cold: { label: 'Cold Lead', color: 'text-blue-400 bg-blue-400/10 border-blue-400/20', emoji: '❄️' },
  customer: { label: 'Customer', color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20', emoji: '✅' },
  vip: { label: 'VIP', color: 'text-amber-500 bg-amber-500/10 border-amber-500/20', emoji: '⭐' },
  new: { label: 'New', color: 'text-violet-500 bg-violet-500/10 border-violet-500/20', emoji: '✨' },
};

/** A single interaction event from a lead */
export interface LeadInteraction {
  /** Event ID */
  eventId: string;
  /** Type of interaction */
  type: 'reaction' | 'zap' | 'reply' | 'repost';
  /** Sats amount (zaps only) */
  sats?: number;
  /** Emoji content (reactions only) */
  emoji?: string;
  /** Which of your posts they interacted with */
  targetEventId: string;
  /** Timestamp */
  timestamp: number;
}

/** Computed lead profile from relay data + local metadata */
export interface Lead {
  /** Nostr pubkey (hex) */
  pubkey: string;
  /** Engagement score (computed from interactions) */
  score: number;
  /** Total reactions across all your posts */
  totalReactions: number;
  /** Total zaps */
  totalZaps: number;
  /** Total sats sent */
  totalSats: number;
  /** Number of unique posts they interacted with */
  postsInteracted: number;
  /** First interaction timestamp */
  firstSeen: number;
  /** Most recent interaction timestamp */
  lastSeen: number;
  /** All individual interactions */
  interactions: LeadInteraction[];
  /** Days since last interaction */
  daysSinceLastSeen: number;
  /** Is this a repeat engager (interacted with 3+ posts) */
  isRepeatEngager: boolean;
  /** Engagement trend: are they engaging more or less recently */
  trend: 'rising' | 'stable' | 'cooling';
}

/** User-managed metadata for a lead (stored in localStorage) */
export interface LeadMeta {
  /** Nostr pubkey */
  pubkey: string;
  /** Manual tags */
  tags: LeadTag[];
  /** Personal notes about this lead */
  notes: string;
  /** When a follow-up is due (unix timestamp, null if none) */
  followUpAt: number | null;
  /** Whether this lead is starred/pinned */
  starred: boolean;
  /** Last time the user acknowledged/viewed this lead */
  lastViewedAt: number;
}

const STORAGE_KEY = 'plebeian-scheduler:leads';

/** Load lead metadata from localStorage */
export function loadLeadMetas(): Record<string, LeadMeta> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

/** Save lead metadata to localStorage */
export function saveLeadMetas(metas: Record<string, LeadMeta>): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(metas));
}

/** Get or create metadata for a specific lead */
export function getLeadMeta(pubkey: string): LeadMeta {
  const all = loadLeadMetas();
  if (all[pubkey]) return all[pubkey];
  return {
    pubkey,
    tags: [],
    notes: '',
    followUpAt: null,
    starred: false,
    lastViewedAt: 0,
  };
}

/** Update metadata for a specific lead */
export function updateLeadMeta(pubkey: string, updates: Partial<LeadMeta>): void {
  const all = loadLeadMetas();
  const existing = all[pubkey] || {
    pubkey,
    tags: [],
    notes: '',
    followUpAt: null,
    starred: false,
    lastViewedAt: 0,
  };
  all[pubkey] = { ...existing, ...updates, pubkey };
  saveLeadMetas(all);
}

/** Scoring weights */
const SCORE_WEIGHTS = {
  reaction: 1,
  zap: 5,
  satsPerK: 2,
  reply: 3,
  repost: 2,
  recencyBonus: 10,
  repeatBonus: 15,
};

/** Calculate engagement score for a lead */
export function calculateLeadScore(lead: Pick<Lead, 'totalReactions' | 'totalZaps' | 'totalSats' | 'postsInteracted' | 'lastSeen'>): number {
  let score = 0;
  score += lead.totalReactions * SCORE_WEIGHTS.reaction;
  score += lead.totalZaps * SCORE_WEIGHTS.zap;
  score += Math.floor(lead.totalSats / 1000) * SCORE_WEIGHTS.satsPerK;

  // Repeat engager bonus
  if (lead.postsInteracted >= 3) {
    score += SCORE_WEIGHTS.repeatBonus;
  }

  // Recency bonus: if they interacted in the last 7 days
  const weekAgo = Math.floor(Date.now() / 1000) - (7 * 86400);
  if (lead.lastSeen > weekAgo) {
    score += SCORE_WEIGHTS.recencyBonus;
  }

  return score;
}
