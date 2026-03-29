/** Event types that can be composed in the scheduler */
export type PostKind = 'note' | 'listing' | 'article';

/** Status of a scheduled item in the pipeline */
export type PostStatus = 'draft' | 'queued' | 'scheduled' | 'published' | 'failed';

/** Currency codes for NIP-99 price tags */
export type Currency = 'BTC' | 'SAT' | 'USD' | 'EUR' | 'GBP' | 'AUD' | 'CAD' | 'CHF' | 'JPY';

/** Price frequency for recurring pricing */
export type PriceFrequency = '' | 'hour' | 'day' | 'week' | 'month' | 'year';

/** Listing status per NIP-99 */
export type ListingStatus = 'active' | 'sold';

/** An uploaded image with metadata for NIP-92 imeta tags */
export interface UploadedImage {
  url: string;
  mimeType?: string;
  dimensions?: string;
  sha256?: string;
  blurhash?: string;
  alt?: string;
  size?: number;
}

/** NIP-99 classified listing specific fields */
export interface ListingFields {
  title: string;
  summary: string;
  price: string;
  currency: Currency;
  priceFrequency: PriceFrequency;
  location: string;
  status: ListingStatus;
  categories: string[];
  images: UploadedImage[];
  shippingInfo: string;
}

/** NIP-23 long-form article specific fields */
export interface ArticleFields {
  title: string;
  summary: string;
  image: string;
  categories: string[];
}

/** A draft/scheduled/queued post in the system */
export interface SchedulerPost {
  /** Unique local ID (UUID) */
  id: string;
  /** The type of Nostr event */
  kind: PostKind;
  /** Current status in the pipeline */
  status: PostStatus;
  /** Markdown content body */
  content: string;
  /** The d-tag identifier for addressable events */
  dTag: string;
  /** Which npub (hex) this should be published as */
  authorPubkey: string;
  /** Scheduled publish time (unix timestamp in seconds), null if draft */
  scheduledAt: number | null;
  /** When this was created locally */
  createdAt: number;
  /** When this was last modified locally */
  updatedAt: number;
  /** When this was actually published (if published) */
  publishedAt: number | null;
  /** The published event ID (if published) */
  publishedEventId: string | null;
  /** NIP-99 listing fields (only for kind=listing) */
  listingFields?: ListingFields;
  /** NIP-23 article fields (only for kind=article) */
  articleFields?: ArticleFields;
  /** Attached media for NIP-92 imeta tags */
  media: UploadedImage[];
  /** Queue name this belongs to (optional) */
  queueName: string;
  /** Position in queue for ordering */
  queuePosition: number;
  /** NIP-40 expiration timestamp (optional) */
  expiresAt: number | null;
  /** Whether to use DVM (NIP-90) for publishing */
  useDvm: boolean;
  /** DVM-specific: relay URLs where the DVM should publish */
  dvmRelays: string[];
  /** Error message if publishing failed */
  errorMessage: string | null;
}

/** Queue grouping */
export interface Queue {
  name: string;
  description: string;
  createdAt: number;
}

/** Default listing fields */
export function defaultListingFields(): ListingFields {
  return {
    title: '',
    summary: '',
    price: '',
    currency: 'SAT',
    priceFrequency: '',
    location: '',
    status: 'active',
    categories: [],
    images: [],
    shippingInfo: '',
  };
}

/** Default article fields */
export function defaultArticleFields(): ArticleFields {
  return {
    title: '',
    summary: '',
    image: '',
    categories: [],
  };
}

/** Create a new empty post */
export function createNewPost(kind: PostKind, authorPubkey: string): SchedulerPost {
  const now = Math.floor(Date.now() / 1000);
  return {
    id: crypto.randomUUID(),
    kind,
    status: 'draft',
    content: '',
    dTag: crypto.randomUUID().replace(/-/g, '').slice(0, 16),
    authorPubkey,
    scheduledAt: null,
    createdAt: now,
    updatedAt: now,
    publishedAt: null,
    publishedEventId: null,
    listingFields: kind === 'listing' ? defaultListingFields() : undefined,
    articleFields: kind === 'article' ? defaultArticleFields() : undefined,
    media: [],
    queueName: '',
    queuePosition: 0,
    expiresAt: null,
    useDvm: false,
    dvmRelays: [],
    errorMessage: null,
  };
}

/** All currencies with labels */
export const CURRENCIES: { value: Currency; label: string; symbol: string }[] = [
  { value: 'SAT', label: 'Satoshis', symbol: 'sats' },
  { value: 'BTC', label: 'Bitcoin', symbol: 'BTC' },
  { value: 'USD', label: 'US Dollar', symbol: '$' },
  { value: 'EUR', label: 'Euro', symbol: '\u20AC' },
  { value: 'GBP', label: 'British Pound', symbol: '\u00A3' },
  { value: 'AUD', label: 'Australian Dollar', symbol: 'A$' },
  { value: 'CAD', label: 'Canadian Dollar', symbol: 'C$' },
  { value: 'CHF', label: 'Swiss Franc', symbol: 'CHF' },
  { value: 'JPY', label: 'Japanese Yen', symbol: '\u00A5' },
];

export const PRICE_FREQUENCIES: { value: PriceFrequency; label: string }[] = [
  { value: '', label: 'One-time' },
  { value: 'hour', label: 'Per hour' },
  { value: 'day', label: 'Per day' },
  { value: 'week', label: 'Per week' },
  { value: 'month', label: 'Per month' },
  { value: 'year', label: 'Per year' },
];
