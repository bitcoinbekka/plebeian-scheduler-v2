import { useState, useMemo, useCallback } from 'react';
import { useSeoMeta } from '@unhead/react';
import { Link } from 'react-router-dom';
import { nip19 } from 'nostr-tools';
import {
  Users, Heart, Zap, TrendingUp, TrendingDown, Minus, Star,
  Clock, ArrowLeft, Search, Filter, X, Bell, MessageSquare,
  ChevronRight, Flame, Snowflake, Crown, CheckCircle2, Sparkles,
  Tag, StickyNote, CalendarClock, ExternalLink, Repeat2, Eye,
  ArrowUpRight, ArrowDownRight, AlertTriangle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useLeadTracker } from '@/hooks/useLeadTracker';
import { useAuthor } from '@/hooks/useAuthor';
import { cn } from '@/lib/utils';
import { formatDistanceToNow, format } from 'date-fns';
import type { Lead, LeadTag, LeadMeta } from '@/lib/leadTypes';
import { LEAD_TAG_CONFIG, getLeadMeta, updateLeadMeta, loadLeadMetas } from '@/lib/leadTypes';

function formatSats(sats: number): string {
  if (sats >= 1_000_000) return (sats / 1_000_000).toFixed(1) + 'M';
  if (sats >= 1_000) return (sats / 1_000).toFixed(1) + 'k';
  return sats.toLocaleString();
}

function getTrendIcon(trend: Lead['trend']) {
  if (trend === 'rising') return ArrowUpRight;
  if (trend === 'cooling') return ArrowDownRight;
  return Minus;
}

function getTrendColor(trend: Lead['trend']) {
  if (trend === 'rising') return 'text-emerald-500';
  if (trend === 'cooling') return 'text-red-400';
  return 'text-muted-foreground';
}

const ALL_TAGS: LeadTag[] = ['hot', 'warm', 'cold', 'customer', 'vip', 'new'];
// --- Lead Row Component ---

function LeadRow({ lead, meta, rank, onClick }: {
  lead: Lead;
  meta: LeadMeta;
  rank: number;
  onClick: () => void;
}) {
  const { data: author } = useAuthor(lead.pubkey);
  const metadata = author?.metadata;
  const displayName = metadata?.name || metadata?.display_name || lead.pubkey.slice(0, 12) + '...';
  const TrendIcon = getTrendIcon(lead.trend);
  const hasDueFollowUp = meta.followUpAt && meta.followUpAt <= Math.floor(Date.now() / 1000);

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-secondary/50 transition-all group text-left border border-transparent hover:border-border"
    >
      {/* Rank */}
      <span className={cn(
        'text-xs font-bold w-6 text-center shrink-0',
        rank === 1 ? 'text-amber-500' : rank === 2 ? 'text-gray-400' : rank === 3 ? 'text-amber-700' : 'text-muted-foreground/50'
      )}>
        {rank}
      </span>

      {/* Avatar */}
      <div className="relative">
        <Avatar className="w-10 h-10 border">
          <AvatarImage src={metadata?.picture} alt={displayName} />
          <AvatarFallback className="text-xs font-medium">{displayName.slice(0, 2).toUpperCase()}</AvatarFallback>
        </Avatar>
        {meta.starred && (
          <Star className="absolute -top-1 -right-1 w-3.5 h-3.5 text-amber-500 fill-amber-500" />
        )}
        {hasDueFollowUp && (
          <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-red-500 border-2 border-background animate-pulse" />
        )}
      </div>

      {/* Name + tags */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium truncate group-hover:text-primary transition-colors">
            {displayName}
          </span>
          {lead.isRepeatEngager && (
            <Tooltip>
              <TooltipTrigger>
                <Flame className="w-3.5 h-3.5 text-orange-500 shrink-0" />
              </TooltipTrigger>
              <TooltipContent className="text-xs">Repeat engager - interacted with {lead.postsInteracted} posts</TooltipContent>
            </Tooltip>
          )}
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          {meta.tags.slice(0, 2).map(tag => (
            <span key={tag} className={cn('text-[9px] px-1.5 py-0.5 rounded-full border font-medium', LEAD_TAG_CONFIG[tag].color)}>
              {LEAD_TAG_CONFIG[tag].emoji} {LEAD_TAG_CONFIG[tag].label}
            </span>
          ))}
          <span className="text-[10px] text-muted-foreground">
            {formatDistanceToNow(new Date(lead.lastSeen * 1000), { addSuffix: true })}
          </span>
        </div>
      </div>

      {/* Stats */}
      <div className="hidden sm:flex items-center gap-4 shrink-0">
        {lead.totalReactions > 0 && (
          <span className="flex items-center gap-1 text-xs text-rose-500">
            <Heart className="w-3 h-3" /> {lead.totalReactions}
          </span>
        )}
        {lead.totalSats > 0 && (
          <span className="flex items-center gap-1 text-xs text-amber-500 font-medium">
            <Zap className="w-3 h-3" /> {formatSats(lead.totalSats)}
          </span>
        )}
        <Tooltip>
          <TooltipTrigger>
            <TrendIcon className={cn('w-4 h-4', getTrendColor(lead.trend))} />
          </TooltipTrigger>
          <TooltipContent className="text-xs">
            {lead.trend === 'rising' ? 'Engagement increasing' : lead.trend === 'cooling' ? 'Engagement decreasing' : 'Stable engagement'}
          </TooltipContent>
        </Tooltip>
      </div>

      {/* Score */}
      <div className="w-12 text-right shrink-0">
        <span className="text-sm font-bold tabular-nums">{lead.score}</span>
        <p className="text-[9px] text-muted-foreground">score</p>
      </div>

      <ChevronRight className="w-4 h-4 text-muted-foreground/30 group-hover:text-primary transition-colors shrink-0" />
    </button>
  );
}

// --- Lead Profile Detail ---

function LeadProfile({ lead, onClose }: { lead: Lead; onClose: () => void }) {
  const { data: author } = useAuthor(lead.pubkey);
  const metadata = author?.metadata;
  const displayName = metadata?.name || metadata?.display_name || lead.pubkey.slice(0, 12) + '...';
  const npub = nip19.npubEncode(lead.pubkey);
  const TrendIcon = getTrendIcon(lead.trend);

  const [meta, setMeta] = useState<LeadMeta>(() => getLeadMeta(lead.pubkey));
  const [notes, setNotes] = useState(meta.notes);
  const [showFollowUp, setShowFollowUp] = useState(false);

  const saveMeta = useCallback((updates: Partial<LeadMeta>) => {
    updateLeadMeta(lead.pubkey, updates);
    setMeta(prev => ({ ...prev, ...updates }));
  }, [lead.pubkey]);

  const toggleTag = useCallback((tag: LeadTag) => {
    const newTags = meta.tags.includes(tag)
      ? meta.tags.filter(t => t !== tag)
      : [...meta.tags, tag];
    saveMeta({ tags: newTags });
  }, [meta.tags, saveMeta]);

  const saveNotes = useCallback(() => {
    saveMeta({ notes });
  }, [notes, saveMeta]);

  const toggleStar = useCallback(() => {
    saveMeta({ starred: !meta.starred });
  }, [meta.starred, saveMeta]);

  const setFollowUp = useCallback((days: number) => {
    const at = Math.floor(Date.now() / 1000) + (days * 86400);
    saveMeta({ followUpAt: at });
    setShowFollowUp(false);
  }, [saveMeta]);

  const clearFollowUp = useCallback(() => {
    saveMeta({ followUpAt: null });
    setShowFollowUp(false);
  }, [saveMeta]);

  // Mark as viewed
  useState(() => {
    updateLeadMeta(lead.pubkey, { lastViewedAt: Math.floor(Date.now() / 1000) });
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <Card className="w-full max-w-lg max-h-[90vh] overflow-hidden" onClick={e => e.stopPropagation()}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <Avatar className="w-12 h-12 border-2">
                <AvatarImage src={metadata?.picture} alt={displayName} />
                <AvatarFallback className="text-sm font-medium">{displayName.slice(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-base truncate">{displayName}</CardTitle>
                  <button type="button" onClick={toggleStar}>
                    <Star className={cn('w-4 h-4 transition-colors', meta.starred ? 'text-amber-500 fill-amber-500' : 'text-muted-foreground/30 hover:text-amber-500')} />
                  </button>
                </div>
                <a
                  href={'https://njump.me/' + npub}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"
                >
                  {npub.slice(0, 20)}... <ExternalLink className="w-2.5 h-2.5" />
                </a>
              </div>
            </div>
            <Button variant="ghost" size="icon" className="shrink-0 w-8 h-8" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>

        <ScrollArea className="max-h-[75vh]">
          <CardContent className="space-y-5 pb-6">
            {/* Score + Quick Stats */}
            <div className="grid grid-cols-4 gap-2">
              <div className="text-center p-2.5 rounded-lg bg-primary/5 border border-primary/10">
                <p className="text-2xl font-bold text-primary">{lead.score}</p>
                <p className="text-[9px] text-muted-foreground font-medium">SCORE</p>
              </div>
              <div className="text-center p-2.5 rounded-lg bg-rose-500/5 border border-rose-500/10">
                <p className="text-xl font-bold">{lead.totalReactions}</p>
                <p className="text-[9px] text-muted-foreground">Reactions</p>
              </div>
              <div className="text-center p-2.5 rounded-lg bg-amber-500/5 border border-amber-500/10">
                <p className="text-xl font-bold">{formatSats(lead.totalSats)}</p>
                <p className="text-[9px] text-muted-foreground">Sats</p>
              </div>
              <div className="text-center p-2.5 rounded-lg bg-blue-500/5 border border-blue-500/10">
                <p className="text-xl font-bold">{lead.postsInteracted}</p>
                <p className="text-[9px] text-muted-foreground">Posts</p>
              </div>
            </div>

            {/* Trend + Timing */}
            <div className="flex items-center gap-4 text-xs">
              <span className={cn('flex items-center gap-1 font-medium', getTrendColor(lead.trend))}>
                <TrendIcon className="w-3.5 h-3.5" />
                {lead.trend === 'rising' ? 'Rising' : lead.trend === 'cooling' ? 'Cooling off' : 'Stable'}
              </span>
              <span className="text-muted-foreground">
                First seen {formatDistanceToNow(new Date(lead.firstSeen * 1000), { addSuffix: true })}
              </span>
              <span className="text-muted-foreground">
                Last active {formatDistanceToNow(new Date(lead.lastSeen * 1000), { addSuffix: true })}
              </span>
            </div>

            <Separator />

            {/* Tags */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Tag className="w-3 h-3" /> Tags
              </p>
              <div className="flex flex-wrap gap-1.5">
                {ALL_TAGS.map(tag => {
                  const config = LEAD_TAG_CONFIG[tag];
                  const isActive = meta.tags.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleTag(tag)}
                      className={cn(
                        'text-xs px-2.5 py-1 rounded-full border font-medium transition-all',
                        isActive ? config.color : 'text-muted-foreground bg-muted/50 border-transparent hover:border-border'
                      )}
                    >
                      {config.emoji} {config.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Follow-up Reminder */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Bell className="w-3 h-3" /> Follow-up Reminder
              </p>
              {meta.followUpAt ? (
                <div className={cn(
                  'flex items-center justify-between p-2.5 rounded-lg border text-sm',
                  meta.followUpAt <= Math.floor(Date.now() / 1000)
                    ? 'bg-red-500/5 border-red-500/20 text-red-600 dark:text-red-400'
                    : 'bg-muted/50 border-border'
                )}>
                  <div className="flex items-center gap-2">
                    <CalendarClock className="w-4 h-4" />
                    <span className="font-medium">
                      {meta.followUpAt <= Math.floor(Date.now() / 1000) ? 'Follow-up overdue!' : 'Follow up'}
                    </span>
                    <span className="text-muted-foreground text-xs">
                      {format(new Date(meta.followUpAt * 1000), 'MMM d, yyyy')}
                    </span>
                  </div>
                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={clearFollowUp}>Clear</Button>
                </div>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { label: 'Tomorrow', days: 1 },
                    { label: '3 days', days: 3 },
                    { label: '1 week', days: 7 },
                    { label: '2 weeks', days: 14 },
                    { label: '1 month', days: 30 },
                  ].map(opt => (
                    <Button
                      key={opt.days}
                      variant="outline"
                      size="sm"
                      className="text-xs h-7"
                      onClick={() => setFollowUp(opt.days)}
                    >
                      {opt.label}
                    </Button>
                  ))}
                </div>
              )}
            </div>

            {/* Notes */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <StickyNote className="w-3 h-3" /> Notes
              </p>
              <Textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                onBlur={saveNotes}
                placeholder="Add private notes about this lead..."
                className="min-h-[60px] text-sm resize-none"
                rows={3}
              />
            </div>

            <Separator />

            {/* Interaction History */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Clock className="w-3 h-3" /> Interaction History ({lead.interactions.length})
              </p>
              <div className="space-y-1.5 max-h-60 overflow-y-auto">
                {lead.interactions.slice(0, 30).map((interaction, i) => (
                  <div key={interaction.eventId + i} className="flex items-center gap-2.5 p-2 rounded-lg bg-muted/30 text-xs">
                    <div className={cn(
                      'w-6 h-6 rounded-full flex items-center justify-center shrink-0',
                      interaction.type === 'reaction' ? 'bg-rose-500/10' :
                      interaction.type === 'zap' ? 'bg-amber-500/10' :
                      interaction.type === 'repost' ? 'bg-blue-500/10' :
                      'bg-violet-500/10'
                    )}>
                      {interaction.type === 'reaction' && <span className="text-xs">{interaction.emoji || '❤️'}</span>}
                      {interaction.type === 'zap' && <Zap className="w-3 h-3 text-amber-500" />}
                      {interaction.type === 'repost' && <Repeat2 className="w-3 h-3 text-blue-500" />}
                      {interaction.type === 'reply' && <MessageSquare className="w-3 h-3 text-violet-500" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="font-medium">
                        {interaction.type === 'reaction' && 'Reacted'}
                        {interaction.type === 'zap' && ('Zapped ' + formatSats(interaction.sats || 0) + ' sats')}
                        {interaction.type === 'repost' && 'Reposted'}
                        {interaction.type === 'reply' && 'Replied'}
                      </span>
                    </div>
                    <span className="text-muted-foreground shrink-0">
                      {formatDistanceToNow(new Date(interaction.timestamp * 1000), { addSuffix: true })}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick actions */}
            <div className="flex gap-2">
              <a
                href={'https://njump.me/' + npub}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1"
              >
                <Button variant="outline" size="sm" className="w-full gap-2 text-xs">
                  <ExternalLink className="w-3.5 h-3.5" />
                  View Profile
                </Button>
              </a>
            </div>
          </CardContent>
        </ScrollArea>
      </Card>
    </div>
  );
}
function Leads() {
  useSeoMeta({
    title: 'Lead Tracker - Plebeian Scheduler',
    description: 'Track your most engaged audience members and manage customer relationships.',
  });

  const { user } = useCurrentUser();
  const { leads, isLoading, postCount } = useLeadTracker();
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTag, setFilterTag] = useState<LeadTag | 'all' | 'starred' | 'follow-up'>('all');
  const [allMetas] = useState(() => loadLeadMetas());

  // Summary stats
  const stats = useMemo(() => {
    const now = Math.floor(Date.now() / 1000);
    const weekAgo = now - 7 * 86400;
    const newThisWeek = leads.filter(l => l.firstSeen > weekAgo).length;
    const repeatEngagers = leads.filter(l => l.isRepeatEngager).length;
    const totalSats = leads.reduce((sum, l) => sum + l.totalSats, 0);
    const rising = leads.filter(l => l.trend === 'rising').length;
    const dueFollowUps = Object.values(allMetas).filter(m => m.followUpAt && m.followUpAt <= now).length;
    return { total: leads.length, newThisWeek, repeatEngagers, totalSats, rising, dueFollowUps };
  }, [leads, allMetas]);

  // Filter + search
  const filteredLeads = useMemo(() => {
    let result = leads;

    if (filterTag === 'starred') {
      result = result.filter(l => allMetas[l.pubkey]?.starred);
    } else if (filterTag === 'follow-up') {
      const now = Math.floor(Date.now() / 1000);
      result = result.filter(l => allMetas[l.pubkey]?.followUpAt && allMetas[l.pubkey].followUpAt! <= now);
    } else if (filterTag !== 'all') {
      result = result.filter(l => allMetas[l.pubkey]?.tags?.includes(filterTag));
    }

    if (searchQuery.trim()) {
      // We can't search by name here since we don't have metadata loaded for all
      // But we can filter by pubkey prefix
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(l => l.pubkey.startsWith(q));
    }

    return result;
  }, [leads, filterTag, searchQuery, allMetas]);

  if (!user) return null;

  return (
    <div className="space-y-6 animate-fade-in max-w-5xl mx-auto">
      {/* Lead Profile Modal */}
      {selectedLead && (
        <LeadProfile lead={selectedLead} onClose={() => setSelectedLead(null)} />
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
              <Users className="w-7 h-7 text-primary" />
              Lead Tracker
            </h1>
            <p className="text-muted-foreground mt-1">
              Your audience, ranked by engagement across {postCount} posts
            </p>
          </div>
        </div>
        {stats.dueFollowUps > 0 && (
          <Button
            variant="destructive"
            size="sm"
            className="gap-2"
            onClick={() => setFilterTag('follow-up')}
          >
            <Bell className="w-4 h-4" />
            {stats.dueFollowUps} follow-up{stats.dueFollowUps !== 1 ? 's' : ''} due
          </Button>
        )}
      </div>

      {/* Hero Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="group hover:shadow-md transition-all hover:border-primary/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Total Leads</p>
                <p className="text-3xl font-bold font-display mt-1">
                  {isLoading ? <Skeleton className="h-9 w-12 inline-block" /> : stats.total}
                </p>
              </div>
              <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Users className="w-5 h-5 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="group hover:shadow-md transition-all hover:border-emerald-500/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">New This Week</p>
                <p className="text-3xl font-bold font-display mt-1">
                  {isLoading ? <Skeleton className="h-9 w-10 inline-block" /> : stats.newThisWeek}
                </p>
              </div>
              <div className="w-11 h-11 rounded-xl bg-emerald-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Sparkles className="w-5 h-5 text-emerald-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="group hover:shadow-md transition-all hover:border-orange-500/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Repeat Engagers</p>
                <p className="text-3xl font-bold font-display mt-1">
                  {isLoading ? <Skeleton className="h-9 w-10 inline-block" /> : stats.repeatEngagers}
                </p>
              </div>
              <div className="w-11 h-11 rounded-xl bg-orange-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Flame className="w-5 h-5 text-orange-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="group hover:shadow-md transition-all hover:border-amber-500/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Total Sats</p>
                <p className="text-3xl font-bold font-display mt-1">
                  {isLoading ? <Skeleton className="h-9 w-16 inline-block" /> : formatSats(stats.totalSats)}
                </p>
              </div>
              <div className="w-11 h-11 rounded-xl bg-amber-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Zap className="w-5 h-5 text-amber-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by pubkey..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Button
            variant={filterTag === 'all' ? 'default' : 'outline'}
            size="sm"
            className="text-xs h-8"
            onClick={() => setFilterTag('all')}
          >
            All
          </Button>
          <Button
            variant={filterTag === 'starred' ? 'default' : 'outline'}
            size="sm"
            className="text-xs h-8 gap-1"
            onClick={() => setFilterTag('starred')}
          >
            <Star className="w-3 h-3" /> Starred
          </Button>
          <Button
            variant={filterTag === 'follow-up' ? 'default' : 'outline'}
            size="sm"
            className={cn('text-xs h-8 gap-1', stats.dueFollowUps > 0 && filterTag !== 'follow-up' && 'border-red-500/30 text-red-500')}
            onClick={() => setFilterTag('follow-up')}
          >
            <Bell className="w-3 h-3" /> Follow-ups
            {stats.dueFollowUps > 0 && <Badge variant="destructive" className="text-[9px] h-4 px-1 ml-0.5">{stats.dueFollowUps}</Badge>}
          </Button>
          {ALL_TAGS.map(tag => (
            <Button
              key={tag}
              variant={filterTag === tag ? 'default' : 'outline'}
              size="sm"
              className="text-xs h-8"
              onClick={() => setFilterTag(filterTag === tag ? 'all' : tag)}
            >
              {LEAD_TAG_CONFIG[tag].emoji} {LEAD_TAG_CONFIG[tag].label}
            </Button>
          ))}
        </div>
      </div>

      {/* Lead List */}
      <Card>
        <CardContent className="p-2">
          {isLoading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 p-3">
                  <Skeleton className="w-6 h-6 rounded" />
                  <Skeleton className="w-10 h-10 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                  <Skeleton className="h-4 w-16" />
                </div>
              ))}
            </div>
          ) : filteredLeads.length === 0 ? (
            <div className="py-16 text-center">
              <Users className="w-12 h-12 mx-auto text-muted-foreground/20 mb-4" />
              {leads.length === 0 ? (
                <>
                  <h3 className="font-display font-semibold text-lg">No leads yet</h3>
                  <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
                    As people react to and zap your posts, they will appear here ranked by engagement. Start posting to build your audience!
                  </p>
                  <Link to="/compose">
                    <Button className="mt-4 gap-2">
                      <MessageSquare className="w-4 h-4" />
                      Create a post
                    </Button>
                  </Link>
                </>
              ) : (
                <>
                  <h3 className="font-display font-semibold text-lg">No leads match this filter</h3>
                  <p className="text-sm text-muted-foreground mt-2">
                    Try a different filter or clear your search.
                  </p>
                  <Button variant="outline" className="mt-4" onClick={() => { setFilterTag('all'); setSearchQuery(''); }}>
                    Clear filters
                  </Button>
                </>
              )}
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {filteredLeads.map((lead, i) => (
                <LeadRow
                  key={lead.pubkey}
                  lead={lead}
                  meta={allMetas[lead.pubkey] || getLeadMeta(lead.pubkey)}
                  rank={i + 1}
                  onClick={() => setSelectedLead(lead)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Rising leads callout */}
      {stats.rising > 0 && !isLoading && (
        <Card className="bg-gradient-to-r from-emerald-500/5 to-primary/5 border-emerald-500/15">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
              <TrendingUp className="w-5 h-5 text-emerald-500" />
            </div>
            <div>
              <p className="text-sm font-medium">
                {stats.rising} lead{stats.rising !== 1 ? 's' : ''} with rising engagement
              </p>
              <p className="text-xs text-muted-foreground">
                These people are engaging more than usual. Great time to connect!
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default Leads;