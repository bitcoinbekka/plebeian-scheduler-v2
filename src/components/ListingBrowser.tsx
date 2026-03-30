import { useState, useCallback } from 'react';
import {
  Search,
  Image as ImageIcon,
  Tag,
  MapPin,
  Clock,
  User,
  ShoppingBag,
  Download,
  ChevronDown,
  ChevronUp,
  Globe,
  Loader2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useMyListings, useAllListings, type ExistingListing } from '@/hooks/useMyListings';
import { useAuthor } from '@/hooks/useAuthor';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import type { NostrMetadata } from '@nostrify/nostrify';
import type { SchedulerPost, Currency, PriceFrequency, ListingStatus } from '@/lib/types';

interface ListingBrowserProps {
  onImport: (data: Partial<SchedulerPost>) => void;
}

type BrowseMode = 'mine' | 'all';

/** Small inline author badge */
function AuthorBadge({ pubkey }: { pubkey: string }) {
  const author = useAuthor(pubkey);
  const metadata: NostrMetadata | undefined = author.data?.metadata;
  const name = metadata?.display_name || metadata?.name || pubkey.slice(0, 10) + '...';

  return (
    <div className="flex items-center gap-1.5">
      <Avatar className="w-4 h-4">
        <AvatarImage src={metadata?.picture} alt={name} />
        <AvatarFallback className="text-[8px]">
          <User className="w-2.5 h-2.5" />
        </AvatarFallback>
      </Avatar>
      <span className="text-xs text-muted-foreground truncate max-w-[100px]">{name}</span>
    </div>
  );
}

/** Individual listing card */
function ListingCard({
  listing,
  onImport,
  showAuthor = false,
}: {
  listing: ExistingListing;
  onImport: () => void;
  showAuthor?: boolean;
}) {
  return (
    <div
      className={cn(
        'group relative rounded-xl border bg-card overflow-hidden transition-all duration-200',
        'hover:shadow-lg hover:border-primary/30 hover:-translate-y-0.5'
      )}
    >
      {/* Image */}
      {listing.images.length > 0 ? (
        <div className="relative aspect-[4/3] overflow-hidden bg-muted">
          <img
            src={listing.images[0].url}
            alt={listing.title}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
          {listing.images.length > 1 && (
            <Badge
              variant="secondary"
              className="absolute bottom-2 right-2 text-[10px] gap-1 bg-black/60 text-white border-0 backdrop-blur-sm"
            >
              <ImageIcon className="w-2.5 h-2.5" />
              {listing.images.length}
            </Badge>
          )}
          {listing.price && (
            <Badge className="absolute top-2 left-2 font-mono text-xs shadow-lg">
              {listing.price} {listing.currency}
            </Badge>
          )}
        </div>
      ) : (
        <div className="aspect-[4/3] bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center">
          <ShoppingBag className="w-8 h-8 text-muted-foreground/25" />
          {listing.price && (
            <Badge className="absolute top-2 left-2 font-mono text-xs">
              {listing.price} {listing.currency}
            </Badge>
          )}
        </div>
      )}

      {/* Info */}
      <div className="p-3 space-y-2">
        <h3 className="text-sm font-semibold leading-tight line-clamp-2">
          {listing.title || 'Untitled Listing'}
        </h3>

        {listing.summary && (
          <p className="text-xs text-muted-foreground line-clamp-2">{listing.summary}</p>
        )}

        <div className="flex items-center gap-2 flex-wrap">
          {listing.location && (
            <span className="text-[11px] text-muted-foreground flex items-center gap-0.5">
              <MapPin className="w-3 h-3" />
              {listing.location}
            </span>
          )}
          {listing.categories.length > 0 && (
            <span className="text-[11px] text-muted-foreground flex items-center gap-0.5">
              <Tag className="w-3 h-3" />
              {listing.categories.slice(0, 2).join(', ')}
            </span>
          )}
        </div>

        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-2">
            {showAuthor && <AuthorBadge pubkey={listing.event.pubkey} />}
            {!showAuthor && (
              <span className="text-[11px] text-muted-foreground flex items-center gap-0.5">
                <Clock className="w-3 h-3" />
                {formatDistanceToNow(new Date(listing.event.created_at * 1000), { addSuffix: true })}
              </span>
            )}
          </div>

          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => {
              e.stopPropagation();
              onImport();
            }}
          >
            <Download className="w-3 h-3" />
            Import
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Loading skeleton grid */
function ListingSkeletons() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
      {[1, 2, 3, 4, 5, 6].map(i => (
        <div key={i} className="rounded-xl border overflow-hidden">
          <Skeleton className="aspect-[4/3] w-full" />
          <div className="p-3 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ListingBrowser({ onImport }: ListingBrowserProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<BrowseMode>('mine');
  const [searchTerm, setSearchTerm] = useState('');
  const [allSearchInput, setAllSearchInput] = useState('');
  const { user } = useCurrentUser();

  const { data: myListings, isLoading: myLoading } = useMyListings();
  const { data: allListings, isLoading: allLoading, isFetching: allFetching } = useAllListings(
    searchTerm,
    mode === 'all' && isOpen,
  );

  const handleImportListing = useCallback((listing: ExistingListing) => {
    onImport({
      content: listing.content,
      dTag: listing.dTag,
      listingFields: {
        title: listing.title,
        summary: listing.summary,
        price: listing.price,
        currency: (listing.currency || 'SAT') as Currency,
        priceFrequency: (listing.priceFrequency || '') as PriceFrequency,
        location: listing.location,
        status: (listing.status || 'active') as ListingStatus,
        categories: listing.categories,
        images: listing.images.map(img => ({
          url: img.url,
          dimensions: img.dimensions,
        })),
        shippingInfo: '',
      },
    });
  }, [onImport]);

  const handleAllSearch = useCallback(() => {
    setSearchTerm(allSearchInput);
  }, [allSearchInput]);

  // Filter "My Listings" client-side
  const filteredMyListings = (myListings ?? []).filter(l => {
    if (!allSearchInput.trim() || mode !== 'mine') return true;
    const q = allSearchInput.toLowerCase();
    return (
      l.title.toLowerCase().includes(q) ||
      l.summary.toLowerCase().includes(q) ||
      l.content.toLowerCase().includes(q) ||
      l.categories.some(c => c.includes(q)) ||
      l.location.toLowerCase().includes(q)
    );
  });

  const currentListings = mode === 'mine' ? filteredMyListings : (allListings ?? []);
  const isLoading = mode === 'mine' ? myLoading : allLoading;

  return (
    <Card className={cn('transition-all duration-300', isOpen && 'ring-1 ring-primary/20')}>
      <CardHeader className="pb-0">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center justify-between w-full text-left group"
        >
          <CardTitle className="text-base flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
              <ShoppingBag className="w-4 h-4 text-primary" />
            </div>
            Import Existing Listing
          </CardTitle>
          <div className="flex items-center gap-2">
            {!isOpen && myListings && myListings.length > 0 && (
              <Badge variant="secondary" className="text-xs">
                {myListings.length} listing{myListings.length !== 1 ? 's' : ''}
              </Badge>
            )}
            {isOpen ? (
              <ChevronUp className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
            ) : (
              <ChevronDown className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
            )}
          </div>
        </button>
      </CardHeader>

      {isOpen && (
        <CardContent className="pt-4 space-y-4">
          {/* Mode toggle */}
          <div className="flex items-center gap-1 p-1 bg-muted rounded-lg">
            <button
              type="button"
              onClick={() => setMode('mine')}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all duration-200',
                mode === 'mine'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <User className="w-3.5 h-3.5" />
              My Listings
            </button>
            <button
              type="button"
              onClick={() => setMode('all')}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all duration-200',
                mode === 'all'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Globe className="w-3.5 h-3.5" />
              All Listings
            </button>
          </div>

          {/* Search bar */}
          <div className="relative flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder={mode === 'mine' ? 'Filter your listings...' : 'Search all NIP-99 listings on relays...'}
                value={allSearchInput}
                onChange={e => {
                  setAllSearchInput(e.target.value);
                  // For "my" mode, filter instantly (client-side)
                  // For "all" mode, user needs to press Search
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter' && mode === 'all') {
                    handleAllSearch();
                  }
                }}
                className="pl-9"
              />
            </div>
            {mode === 'all' && (
              <Button
                onClick={handleAllSearch}
                disabled={allFetching}
                className="gap-2 shrink-0"
              >
                {allFetching ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Search className="w-4 h-4" />
                )}
                Search
              </Button>
            )}
          </div>

          {/* Info text */}
          {mode === 'all' && (
            <p className="text-xs text-muted-foreground">
              Search all NIP-99 classified listings published on your connected relays.
              {user && ' Results from all merchants, not just yours.'}
            </p>
          )}

          {/* Results */}
          <ScrollArea className="max-h-[480px]">
            {isLoading ? (
              <ListingSkeletons />
            ) : currentListings.length === 0 ? (
              <div className="py-10 text-center">
                <ShoppingBag className="w-10 h-10 mx-auto text-muted-foreground/20 mb-3" />
                <p className="text-sm text-muted-foreground">
                  {mode === 'mine'
                    ? allSearchInput ? 'No listings match your filter' : 'No published listings found'
                    : searchTerm ? 'No listings found for that search' : 'Search for listings or browse recent ones'
                  }
                </p>
                {mode === 'mine' && !allSearchInput && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Publish a listing on Plebeian Market first, then import it here.
                  </p>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                {currentListings.map(listing => (
                  <ListingCard
                    key={listing.event.id}
                    listing={listing}
                    onImport={() => handleImportListing(listing)}
                    showAuthor={mode === 'all'}
                  />
                ))}
              </div>
            )}
          </ScrollArea>

          {/* Results count */}
          {!isLoading && currentListings.length > 0 && (
            <p className="text-xs text-muted-foreground text-center">
              Showing {currentListings.length} listing{currentListings.length !== 1 ? 's' : ''}
              {mode === 'mine' && ' from your account'}
              {mode === 'all' && ' from relays'}
            </p>
          )}
        </CardContent>
      )}
    </Card>
  );
}
