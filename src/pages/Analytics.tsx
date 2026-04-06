import { useState, useMemo } from 'react';
import { useSeoMeta } from '@unhead/react';
import { nip19 } from 'nostr-tools';
import { Link } from 'react-router-dom';
import {
  BarChart3, TrendingUp, Heart, Zap, Users, Clock, CalendarDays,
  MessageSquare, ShoppingBag, Newspaper, Globe, ChevronDown, ChevronUp,
  Crown, Target, Activity, Flame, Award, Eye, X, ArrowLeft,
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  ResponsiveContainer, Cell, PieChart, Pie,
  Tooltip as RechartsTooltip,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useScheduler } from '@/contexts/SchedulerContext';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useBatchEngagement, type PostEngagement } from '@/hooks/usePostEngagement';
import { useAuthor } from '@/hooks/useAuthor';
import { cn } from '@/lib/utils';
import { format, subDays, startOfDay, startOfWeek, isAfter } from 'date-fns';
import type { SchedulerPost } from '@/lib/types';

// --- Helpers ---

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const CHART_COLORS = {
  reactions: 'hsl(347, 77%, 60%)',
  zaps: 'hsl(38, 92%, 50%)',
  posts: 'hsl(221, 83%, 53%)',
  promo: 'hsl(334, 100%, 58%)',
  short: 'hsl(221, 83%, 53%)',
  long: 'hsl(270, 65%, 55%)',
};

function formatSats(sats: number): string {
  if (sats >= 1_000_000) return (sats / 1_000_000).toFixed(1) + 'M';
  if (sats >= 1_000) return (sats / 1_000).toFixed(1) + 'k';
  return sats.toLocaleString();
}

function getPostTitle(post: SchedulerPost): string {
  if (post.postType === 'long' && post.title) return post.title;
  if (post.importedListing?.title) return post.importedListing.title;
  return post.content.slice(0, 60) || 'Empty note';
}

function getPostIcon(post: SchedulerPost) {
  if (post.postType === 'long') return Newspaper;
  if (post.postType === 'promo') return ShoppingBag;
  return MessageSquare;
}

// --- Supporter Avatar Component ---

function SupporterAvatar({ pubkey, score, rank, label }: { pubkey: string; score: string; rank: number; label: string }) {
  const { data: author } = useAuthor(pubkey);
  const metadata = author?.metadata;
  const displayName = metadata?.name || metadata?.display_name || pubkey.slice(0, 8) + '...';
  const npub = nip19.npubEncode(pubkey);

  return (
    <div className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-secondary/50 transition-colors">
      <div className="relative">
        <Avatar className="w-9 h-9 border">
          <AvatarImage src={metadata?.picture} alt={displayName} />
          <AvatarFallback className="text-xs">{displayName.slice(0, 2).toUpperCase()}</AvatarFallback>
        </Avatar>
        {rank <= 3 && (
          <div className={cn(
            'absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold',
            rank === 1 ? 'bg-amber-500 text-white' : rank === 2 ? 'bg-gray-400 text-white' : 'bg-amber-700 text-white'
          )}>
            {rank}
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <a
          href={'https://njump.me/' + npub}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-medium truncate block hover:text-primary transition-colors"
        >
          {displayName}
        </a>
        <p className="text-[10px] text-muted-foreground">{label}</p>
      </div>
      <span className="text-sm font-semibold tabular-nums shrink-0">{score}</span>
    </div>
  );
}

// --- Post Detail Modal ---

function PostDetailView({
  post,
  engagement,
  onClose,
}: {
  post: SchedulerPost;
  engagement?: PostEngagement;
  onClose: () => void;
}) {
  const PostIcon = getPostIcon(post);

  // Top reactors
  const topReactors = useMemo(() => {
    if (!engagement) return [];
    const counts = new Map<string, number>();
    for (const ev of engagement.reactionEvents) {
      counts.set(ev.pubkey, (counts.get(ev.pubkey) || 0) + 1);
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([pubkey, count]) => ({ pubkey, count }));
  }, [engagement]);

  // Top zappers
  const topZappers = useMemo(() => {
    if (!engagement) return [];
    const satsMap = new Map<string, number>();
    for (const zap of engagement.zapEvents) {
      const desc = zap.tags.find(([n]) => n === 'description')?.[1];
      if (!desc) continue;
      try {
        const req = JSON.parse(desc);
        const pk = req.pubkey as string;
        if (!pk) continue;
        const amtTag = zap.tags.find(([n]) => n === 'amount')?.[1];
        const sats = amtTag ? Math.floor(parseInt(amtTag) / 1000) : 0;
        satsMap.set(pk, (satsMap.get(pk) || 0) + sats);
      } catch { /* skip */ }
    }
    return Array.from(satsMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([pubkey, sats]) => ({ pubkey, sats }));
  }, [engagement]);

  // Emoji breakdown
  const emojiBreakdown = useMemo(() => {
    if (!engagement) return [];
    return Object.entries(engagement.reactions)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);
  }, [engagement]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <Card className="w-full max-w-lg max-h-[85vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <PostIcon className="w-5 h-5 text-primary" />
              </div>
              <div className="min-w-0">
                <CardTitle className="text-base truncate">{getPostTitle(post)}</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {post.publishedAt ? format(new Date(post.publishedAt * 1000), 'MMM d, yyyy h:mm a') : 'Not published'}
                </p>
              </div>
            </div>
            <Button variant="ghost" size="icon" className="shrink-0 w-8 h-8" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>
        <ScrollArea className="max-h-[65vh]">
          <CardContent className="space-y-5 pb-6">
            {/* Quick stats */}
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center p-3 rounded-lg bg-rose-500/5 border border-rose-500/10">
                <Heart className="w-4 h-4 mx-auto text-rose-500 mb-1" />
                <p className="text-xl font-bold">{engagement?.reactionCount || 0}</p>
                <p className="text-[10px] text-muted-foreground">Reactions</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-amber-500/5 border border-amber-500/10">
                <Zap className="w-4 h-4 mx-auto text-amber-500 mb-1" />
                <p className="text-xl font-bold">{formatSats(engagement?.totalSats || 0)}</p>
                <p className="text-[10px] text-muted-foreground">Sats earned</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-blue-500/5 border border-blue-500/10">
                <Users className="w-4 h-4 mx-auto text-blue-500 mb-1" />
                <p className="text-xl font-bold">{(engagement?.uniqueReactors || 0) + (engagement?.uniqueZappers || 0)}</p>
                <p className="text-[10px] text-muted-foreground">People</p>
              </div>
            </div>

            {/* Emoji breakdown */}
            {emojiBreakdown.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Reactions</p>
                <div className="flex flex-wrap gap-2">
                  {emojiBreakdown.map(([emoji, count]) => (
                    <div key={emoji} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-secondary text-sm">
                      <span>{emoji}</span>
                      <span className="font-semibold text-xs">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Top reactors */}
            {topReactors.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Top Reactors</p>
                <div className="space-y-0.5">
                  {topReactors.map((r, i) => (
                    <SupporterAvatar key={r.pubkey} pubkey={r.pubkey} score={r.count + ' reactions'} rank={i + 1} label="reactor" />
                  ))}
                </div>
              </div>
            )}

            {/* Top zappers */}
            {topZappers.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Top Zappers</p>
                <div className="space-y-0.5">
                  {topZappers.map((z, i) => (
                    <SupporterAvatar key={z.pubkey} pubkey={z.pubkey} score={formatSats(z.sats) + ' sats'} rank={i + 1} label="zapper" />
                  ))}
                </div>
              </div>
            )}

            {/* Content preview */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Content</p>
              <p className="text-sm text-muted-foreground line-clamp-4 whitespace-pre-wrap">{post.content.slice(0, 300)}</p>
            </div>

            {/* Link to njump */}
            {post.publishedEventId && (
              <a
                href={'https://njump.me/' + nip19.noteEncode(post.publishedEventId)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 text-sm text-primary hover:underline py-2"
              >
                <Globe className="w-4 h-4" />
                View on Nostr
              </a>
            )}
          </CardContent>
        </ScrollArea>
      </Card>
    </div>
  );
}

function Analytics() {
  useSeoMeta({
    title: 'Analytics - Plebeian Scheduler',
    description: 'Track engagement, audience insights, and posting performance.',
  });

  const { posts } = useScheduler();
  const { user } = useCurrentUser();
  const [selectedPost, setSelectedPost] = useState<SchedulerPost | null>(null);
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | 'all'>('30d');

  // Published posts
  const publishedPosts = useMemo(() =>
    posts
      .filter(p => p.status === 'published' && p.publishedEventId)
      .sort((a, b) => (b.publishedAt ?? b.updatedAt) - (a.publishedAt ?? a.updatedAt)),
    [posts],
  );

  // Filter by time range
  const filteredPosts = useMemo(() => {
    if (timeRange === 'all') return publishedPosts;
    const cutoff = timeRange === '7d' ? subDays(new Date(), 7) : subDays(new Date(), 30);
    return publishedPosts.filter(p => {
      const date = p.publishedAt ? new Date(p.publishedAt * 1000) : new Date(p.updatedAt * 1000);
      return isAfter(date, cutoff);
    });
  }, [publishedPosts, timeRange]);

  const eventIds = useMemo(
    () => filteredPosts.map(p => p.publishedEventId!).filter(Boolean),
    [filteredPosts],
  );
  const { data: engagementMap, isLoading } = useBatchEngagement(eventIds);

  // All event IDs for audience analysis (always use all posts)
  const allEventIds = useMemo(
    () => publishedPosts.map(p => p.publishedEventId!).filter(Boolean),
    [publishedPosts],
  );
  const { data: allEngagementMap } = useBatchEngagement(allEventIds);

  // --- Computed analytics data ---

  // Aggregate totals
  const totals = useMemo(() => {
    if (!engagementMap) return { reactions: 0, zaps: 0, sats: 0, uniquePeople: 0 };
    let reactions = 0, zaps = 0, sats = 0;
    const allPubkeys = new Set<string>();
    for (const eng of engagementMap.values()) {
      reactions += eng.reactionCount;
      zaps += eng.zapCount;
      sats += eng.totalSats;
      for (const ev of eng.reactionEvents) allPubkeys.add(ev.pubkey);
      for (const zev of eng.zapEvents) {
        const desc = zev.tags.find(([n]) => n === 'description')?.[1];
        if (desc) { try { const r = JSON.parse(desc); if (r.pubkey) allPubkeys.add(r.pubkey); } catch {} }
      }
    }
    return { reactions, zaps, sats, uniquePeople: allPubkeys.size };
  }, [engagementMap]);

  // Engagement over time (day-by-day)
  const timeSeriesData = useMemo(() => {
    if (!engagementMap || filteredPosts.length === 0) return [];
    const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90;
    const buckets: Record<string, { date: string; reactions: number; sats: number; posts: number }> = {};

    for (let i = days - 1; i >= 0; i--) {
      const d = startOfDay(subDays(new Date(), i));
      const key = format(d, 'yyyy-MM-dd');
      buckets[key] = { date: format(d, 'MMM d'), reactions: 0, sats: 0, posts: 0 };
    }

    for (const post of filteredPosts) {
      const pubDate = post.publishedAt ? new Date(post.publishedAt * 1000) : new Date(post.updatedAt * 1000);
      const key = format(startOfDay(pubDate), 'yyyy-MM-dd');
      if (buckets[key]) {
        buckets[key].posts++;
        const eng = engagementMap.get(post.publishedEventId!);
        if (eng) {
          buckets[key].reactions += eng.reactionCount;
          buckets[key].sats += eng.totalSats;
        }
      }
    }

    return Object.values(buckets);
  }, [filteredPosts, engagementMap, timeRange]);

  // Post type performance
  const typePerformance = useMemo(() => {
    if (!engagementMap) return [];
    const stats: Record<string, { count: number; reactions: number; sats: number; zaps: number }> = {};

    for (const post of filteredPosts) {
      const type = post.postType;
      if (!stats[type]) stats[type] = { count: 0, reactions: 0, sats: 0, zaps: 0 };
      stats[type].count++;
      const eng = engagementMap.get(post.publishedEventId!);
      if (eng) {
        stats[type].reactions += eng.reactionCount;
        stats[type].sats += eng.totalSats;
        stats[type].zaps += eng.zapCount;
      }
    }

    return Object.entries(stats).map(([type, data]) => ({
      type,
      label: type === 'promo' ? 'Promo Notes' : type === 'long' ? 'Articles' : 'Short Notes',
      count: data.count,
      reactions: data.reactions,
      sats: data.sats,
      avgReactions: data.count > 0 ? Math.round((data.reactions / data.count) * 10) / 10 : 0,
      avgSats: data.count > 0 ? Math.round(data.sats / data.count) : 0,
      fill: type === 'promo' ? CHART_COLORS.promo : type === 'long' ? CHART_COLORS.long : CHART_COLORS.short,
    })).sort((a, b) => (b.avgReactions + b.avgSats * 0.01) - (a.avgReactions + a.avgSats * 0.01));
  }, [filteredPosts, engagementMap]);

  // Posting heatmap (day of week x hour)
  const heatmapData = useMemo(() => {
    const grid: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
    const engGrid: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));

    for (const post of publishedPosts) {
      const date = post.publishedAt ? new Date(post.publishedAt * 1000) : new Date(post.updatedAt * 1000);
      const day = date.getDay();
      const hour = date.getHours();
      grid[day][hour]++;
      if (allEngagementMap) {
        const eng = allEngagementMap.get(post.publishedEventId!);
        if (eng) engGrid[day][hour] += eng.reactionCount + (eng.zapCount * 3);
      }
    }

    return { grid, engGrid };
  }, [publishedPosts, allEngagementMap]);

  // Best posting time
  const bestTime = useMemo(() => {
    const { engGrid } = heatmapData;
    let bestDay = 0, bestHour = 0, bestScore = 0;
    for (let d = 0; d < 7; d++) {
      for (let h = 0; h < 24; h++) {
        if (engGrid[d][h] > bestScore) {
          bestScore = engGrid[d][h];
          bestDay = d;
          bestHour = h;
        }
      }
    }
    return { day: DAYS[bestDay], hour: bestHour, score: bestScore };
  }, [heatmapData]);

  // Heatmap max for color scaling
  const heatmapMax = useMemo(() => {
    return Math.max(1, ...heatmapData.engGrid.flat());
  }, [heatmapData]);

  // Top supporters (across all posts)
  const topSupporters = useMemo(() => {
    if (!allEngagementMap) return { reactors: [], zappers: [] };

    const reactorCounts = new Map<string, number>();
    const zapperSats = new Map<string, number>();

    for (const eng of allEngagementMap.values()) {
      for (const ev of eng.reactionEvents) {
        reactorCounts.set(ev.pubkey, (reactorCounts.get(ev.pubkey) || 0) + 1);
      }
      for (const zap of eng.zapEvents) {
        const desc = zap.tags.find(([n]) => n === 'description')?.[1];
        if (!desc) continue;
        try {
          const req = JSON.parse(desc);
          const pk = req.pubkey as string;
          if (!pk) continue;
          const amtTag = zap.tags.find(([n]) => n === 'amount')?.[1];
          const sats = amtTag ? Math.floor(parseInt(amtTag) / 1000) : 0;
          zapperSats.set(pk, (zapperSats.get(pk) || 0) + sats);
        } catch {}
      }
    }

    const reactors = Array.from(reactorCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([pubkey, count]) => ({ pubkey, count }));

    const zappers = Array.from(zapperSats.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([pubkey, sats]) => ({ pubkey, sats }));

    return { reactors, zappers };
  }, [allEngagementMap]);

  // Campaign performance (posts with importedListing grouped by listing title)
  const campaignData = useMemo(() => {
    if (!engagementMap) return [];
    const campaigns = new Map<string, { title: string; posts: SchedulerPost[]; reactions: number; sats: number }>();

    for (const post of filteredPosts) {
      if (!post.importedListing?.title) continue;
      const key = post.importedListing.title;
      if (!campaigns.has(key)) campaigns.set(key, { title: key, posts: [], reactions: 0, sats: 0 });
      const c = campaigns.get(key)!;
      c.posts.push(post);
      const eng = engagementMap.get(post.publishedEventId!);
      if (eng) {
        c.reactions += eng.reactionCount;
        c.sats += eng.totalSats;
      }
    }

    return Array.from(campaigns.values())
      .sort((a, b) => (b.reactions + b.sats * 0.01) - (a.reactions + a.sats * 0.01));
  }, [filteredPosts, engagementMap]);

  // Top posts by engagement
  const topPosts = useMemo(() => {
    if (!engagementMap) return [];
    return filteredPosts
      .map(post => {
        const eng = engagementMap.get(post.publishedEventId!);
        const score = (eng?.reactionCount || 0) + ((eng?.zapCount || 0) * 3);
        return { post, engagement: eng, score };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);
  }, [filteredPosts, engagementMap]);

  if (!user) return null;

  return (
    <div className="space-y-8 animate-fade-in max-w-6xl mx-auto">
      {/* Post detail modal */}
      {selectedPost && (
        <PostDetailView
          post={selectedPost}
          engagement={engagementMap?.get(selectedPost.publishedEventId!)}
          onClose={() => setSelectedPost(null)}
        />
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link to="/">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight flex items-center gap-2">
              <BarChart3 className="w-7 h-7 text-primary" />
              Analytics
            </h1>
            <p className="text-muted-foreground mt-1">
              Track your engagement, audience, and posting performance
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {(['7d', '30d', 'all'] as const).map(range => (
            <Button
              key={range}
              variant={timeRange === range ? 'default' : 'outline'}
              size="sm"
              className="text-xs"
              onClick={() => setTimeRange(range)}
            >
              {range === '7d' ? '7 days' : range === '30d' ? '30 days' : 'All time'}
            </Button>
          ))}
        </div>
      </div>

      {/* Hero Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="group hover:shadow-md transition-all hover:border-blue-500/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Posts</p>
                <p className="text-3xl font-bold font-display mt-1">{filteredPosts.length}</p>
              </div>
              <div className="w-11 h-11 rounded-xl bg-blue-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Activity className="w-5 h-5 text-blue-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="group hover:shadow-md transition-all hover:border-rose-500/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Reactions</p>
                <p className="text-3xl font-bold font-display mt-1">
                  {isLoading ? <Skeleton className="h-9 w-12 inline-block" /> : totals.reactions}
                </p>
              </div>
              <div className="w-11 h-11 rounded-xl bg-rose-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Heart className="w-5 h-5 text-rose-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="group hover:shadow-md transition-all hover:border-amber-500/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Sats Earned</p>
                <p className="text-3xl font-bold font-display mt-1">
                  {isLoading ? <Skeleton className="h-9 w-16 inline-block" /> : formatSats(totals.sats)}
                </p>
              </div>
              <div className="w-11 h-11 rounded-xl bg-amber-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Zap className="w-5 h-5 text-amber-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="group hover:shadow-md transition-all hover:border-violet-500/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Unique People</p>
                <p className="text-3xl font-bold font-display mt-1">
                  {isLoading ? <Skeleton className="h-9 w-10 inline-block" /> : totals.uniquePeople}
                </p>
              </div>
              <div className="w-11 h-11 rounded-xl bg-violet-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Users className="w-5 h-5 text-violet-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Engagement Over Time Chart */}
      {timeSeriesData.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              Engagement Over Time
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={timeSeriesData} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
                  <defs>
                    <linearGradient id="gradReactions" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={CHART_COLORS.reactions} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={CHART_COLORS.reactions} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradSats" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={CHART_COLORS.zaps} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={CHART_COLORS.zaps} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} className="text-muted-foreground" interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 11 }} className="text-muted-foreground" />
                  <RechartsTooltip
                    contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }}
                    labelStyle={{ fontWeight: 600 }}
                  />
                  <Area type="monotone" dataKey="reactions" stroke={CHART_COLORS.reactions} fill="url(#gradReactions)" strokeWidth={2} name="Reactions" />
                  <Area type="monotone" dataKey="sats" stroke={CHART_COLORS.zaps} fill="url(#gradSats)" strokeWidth={2} name="Sats" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Two column: Post type performance + Posting heatmap */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Post Type Performance */}
        {typePerformance.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <Target className="w-4 h-4 text-primary" />
                Post Type Performance
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={typePerformance} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <RechartsTooltip
                      contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }}
                    />
                    <Bar dataKey="avgReactions" name="Avg Reactions" radius={[4, 4, 0, 0]}>
                      {typePerformance.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2">
                {typePerformance.map((entry, i) => (
                  <div key={entry.type} className={cn(
                    'flex items-center justify-between p-2.5 rounded-lg text-xs',
                    i === 0 ? 'bg-primary/5 border border-primary/15' : 'bg-muted/50'
                  )}>
                    <div className="flex items-center gap-2">
                      {i === 0 && <Award className="w-3.5 h-3.5 text-primary" />}
                      <span className={cn('font-medium', i === 0 && 'text-primary')}>{entry.label}</span>
                      <Badge variant="secondary" className="text-[9px] h-4 px-1.5">{entry.count} posts</Badge>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-0.5 text-rose-500">
                        <Heart className="w-3 h-3" /> {entry.avgReactions}/post
                      </span>
                      <span className="flex items-center gap-0.5 text-amber-500 font-medium">
                        <Zap className="w-3 h-3" /> {formatSats(entry.avgSats)}/post
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Posting Heatmap */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <Flame className="w-4 h-4 text-primary" />
                Posting Heatmap
              </CardTitle>
              {bestTime.score > 0 && (
                <Badge variant="outline" className="text-xs gap-1">
                  <Clock className="w-3 h-3" />
                  Best: {bestTime.day} {bestTime.hour % 12 || 12}{bestTime.hour >= 12 ? 'pm' : 'am'}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <div className="min-w-[500px]">
                {/* Hour labels */}
                <div className="flex ml-10 mb-1">
                  {HOURS.filter((_, i) => i % 3 === 0).map(h => (
                    <div key={h} className="text-[9px] text-muted-foreground" style={{ width: `${(3 / 24) * 100}%` }}>
                      {h % 12 || 12}{h >= 12 ? 'p' : 'a'}
                    </div>
                  ))}
                </div>
                {/* Grid rows */}
                {DAYS.map((day, dayIdx) => (
                  <div key={day} className="flex items-center gap-1 mb-0.5">
                    <span className="text-[10px] text-muted-foreground w-9 text-right shrink-0">{day}</span>
                    <div className="flex flex-1 gap-px">
                      {HOURS.map(hour => {
                        const val = heatmapData.engGrid[dayIdx][hour];
                        const intensity = heatmapMax > 0 ? val / heatmapMax : 0;
                        const postCount = heatmapData.grid[dayIdx][hour];
                        return (
                          <Tooltip key={hour}>
                            <TooltipTrigger asChild>
                              <div
                                className="flex-1 aspect-square rounded-[2px] min-w-[12px] transition-colors"
                                style={{
                                  backgroundColor: intensity > 0
                                    ? `hsl(334 100% 58% / ${0.1 + intensity * 0.8})`
                                    : postCount > 0
                                      ? 'hsl(var(--muted))'
                                      : 'hsl(var(--muted) / 0.3)',
                                }}
                              />
                            </TooltipTrigger>
                            <TooltipContent className="text-xs">
                              {day} {hour % 12 || 12}:00{hour >= 12 ? 'pm' : 'am'}: {postCount} post{postCount !== 1 ? 's' : ''}, score {val}
                            </TooltipContent>
                          </Tooltip>
                        );
                      })}
                    </div>
                  </div>
                ))}
                {/* Legend */}
                <div className="flex items-center justify-end gap-2 mt-2">
                  <span className="text-[9px] text-muted-foreground">Less</span>
                  {[0.1, 0.3, 0.5, 0.7, 0.9].map(opacity => (
                    <div key={opacity} className="w-3 h-3 rounded-[2px]" style={{ backgroundColor: `hsl(334 100% 58% / ${opacity})` }} />
                  ))}
                  <span className="text-[9px] text-muted-foreground">More</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Three column: Audience + Top Posts + Campaigns */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Audience Insights */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" />
              Audience Insights
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="reactors" className="w-full">
              <TabsList className="grid w-full grid-cols-2 h-8">
                <TabsTrigger value="reactors" className="text-xs gap-1"><Heart className="w-3 h-3" /> Top Reactors</TabsTrigger>
                <TabsTrigger value="zappers" className="text-xs gap-1"><Zap className="w-3 h-3" /> Top Zappers</TabsTrigger>
              </TabsList>
              <TabsContent value="reactors" className="mt-3">
                {topSupporters.reactors.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">No reactors yet</p>
                ) : (
                  <div className="space-y-0.5">
                    {topSupporters.reactors.map((r, i) => (
                      <SupporterAvatar
                        key={r.pubkey}
                        pubkey={r.pubkey}
                        score={String(r.count)}
                        rank={i + 1}
                        label={r.count + ' reaction' + (r.count !== 1 ? 's' : '') + ' total'}
                      />
                    ))}
                  </div>
                )}
              </TabsContent>
              <TabsContent value="zappers" className="mt-3">
                {topSupporters.zappers.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">No zappers yet</p>
                ) : (
                  <div className="space-y-0.5">
                    {topSupporters.zappers.map((z, i) => (
                      <SupporterAvatar
                        key={z.pubkey}
                        pubkey={z.pubkey}
                        score={formatSats(z.sats)}
                        rank={i + 1}
                        label={formatSats(z.sats) + ' sats total'}
                      />
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Top Posts */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Crown className="w-4 h-4 text-primary" />
              Top Posts
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topPosts.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No posts with engagement yet</p>
            ) : (
              <div className="space-y-1">
                {topPosts.slice(0, 8).map(({ post, engagement, score }, i) => {
                  const PostIcon = getPostIcon(post);
                  return (
                    <button
                      key={post.id}
                      type="button"
                      onClick={() => setSelectedPost(post)}
                      className="w-full flex items-center gap-2.5 p-2 rounded-lg hover:bg-secondary/50 transition-colors text-left group"
                    >
                      <span className={cn(
                        'text-[10px] font-bold w-5 text-center shrink-0',
                        i === 0 ? 'text-amber-500' : i === 1 ? 'text-gray-400' : i === 2 ? 'text-amber-700' : 'text-muted-foreground'
                      )}>
                        #{i + 1}
                      </span>
                      <div className="w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                        <PostIcon className="w-3.5 h-3.5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate group-hover:text-primary transition-colors">
                          {getPostTitle(post)}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {(engagement?.reactionCount ?? 0) > 0 && (
                            <span className="flex items-center gap-0.5 text-[10px] text-rose-500">
                              <Heart className="w-2.5 h-2.5" /> {engagement?.reactionCount}
                            </span>
                          )}
                          {(engagement?.totalSats ?? 0) > 0 && (
                            <span className="flex items-center gap-0.5 text-[10px] text-amber-500">
                              <Zap className="w-2.5 h-2.5" /> {formatSats(engagement?.totalSats ?? 0)}
                            </span>
                          )}
                        </div>
                      </div>
                      <Eye className="w-3.5 h-3.5 text-muted-foreground/30 group-hover:text-primary transition-colors shrink-0" />
                    </button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Campaign Performance */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-primary" />
              Campaign Performance
            </CardTitle>
          </CardHeader>
          <CardContent>
            {campaignData.length === 0 ? (
              <div className="text-center py-6">
                <ShoppingBag className="w-8 h-8 mx-auto text-muted-foreground/20 mb-2" />
                <p className="text-sm text-muted-foreground">No promo campaigns yet</p>
                <p className="text-[10px] text-muted-foreground mt-1">
                  Promote products from your listings to see campaign analytics here.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {campaignData.slice(0, 8).map((campaign, i) => (
                  <div
                    key={campaign.title}
                    className={cn(
                      'p-3 rounded-lg border transition-colors',
                      i === 0 ? 'bg-primary/5 border-primary/15' : 'bg-muted/30 border-transparent'
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className={cn('text-sm font-medium truncate', i === 0 && 'text-primary')}>
                          {i === 0 && <Award className="w-3.5 h-3.5 inline mr-1 text-primary" />}
                          {campaign.title}
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {campaign.posts.length} post{campaign.posts.length !== 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 mt-2">
                      <span className="flex items-center gap-1 text-xs text-rose-500">
                        <Heart className="w-3 h-3" /> {campaign.reactions}
                      </span>
                      <span className="flex items-center gap-1 text-xs text-amber-500 font-medium">
                        <Zap className="w-3 h-3" /> {formatSats(campaign.sats)} sats
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Empty state */}
      {publishedPosts.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="py-16 text-center">
            <BarChart3 className="w-12 h-12 mx-auto text-muted-foreground/20 mb-4" />
            <h3 className="font-display font-semibold text-lg">No analytics yet</h3>
            <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
              Publish some posts first and come back to see your engagement trends, audience insights, and posting performance.
            </p>
            <Link to="/compose">
              <Button className="mt-4 gap-2">
                <MessageSquare className="w-4 h-4" />
                Create a post
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default Analytics;