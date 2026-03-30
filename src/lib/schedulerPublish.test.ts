import { describe, it, expect } from 'vitest';
import { createNewPost } from './types';
import { buildEvent } from './eventBuilder';
import type { SchedulerPost } from './types';

/**
 * These tests simulate the core filtering logic from useSchedulerPublish:
 *
 *   posts.filter(p =>
 *     p.status === 'scheduled' &&
 *     p.scheduledAt !== null &&
 *     p.scheduledAt <= now
 *   )
 *
 * This is the exact code path that determines which posts get auto-published
 * when the user has the app open. We test it as a pure function here.
 */
function getDuePosts(posts: SchedulerPost[], now: number): SchedulerPost[] {
  return posts.filter(
    p => p.status === 'scheduled' &&
      p.scheduledAt !== null &&
      p.scheduledAt <= now
  );
}

describe('Scheduler publish — due post detection', () => {
  const now = 1743264000; // Fixed timestamp for deterministic tests

  it('finds a post scheduled in the past', () => {
    const post: SchedulerPost = {
      ...createNewPost('pk'),
      status: 'scheduled',
      scheduledAt: now - 60, // 1 minute ago
    };
    post.content = 'Past Due Promo';
    post.importedListing = {
      title: 'Past Due Listing',
      summary: '',
      price: '',
      currency: 'SAT',
      location: '',
      categories: [],
      images: [],
    };

    const due = getDuePosts([post], now);
    expect(due.length).toBe(1);
    expect(due[0].importedListing?.title).toBe('Past Due Listing');
  });

  it('finds a post scheduled at exactly now', () => {
    const post: SchedulerPost = {
      ...createNewPost('pk'),
      status: 'scheduled',
      scheduledAt: now,
    };
    const due = getDuePosts([post], now);
    expect(due.length).toBe(1);
  });

  it('skips a post scheduled in the future', () => {
    const post: SchedulerPost = {
      ...createNewPost('pk'),
      status: 'scheduled',
      scheduledAt: now + 3600,
    };
    const due = getDuePosts([post], now);
    expect(due.length).toBe(0);
  });

  it('skips draft posts even if scheduledAt is in the past', () => {
    const post: SchedulerPost = {
      ...createNewPost('pk'),
      status: 'draft',
      scheduledAt: now - 600,
    };
    const due = getDuePosts([post], now);
    expect(due.length).toBe(0);
  });

  it('skips published posts', () => {
    const post: SchedulerPost = {
      ...createNewPost('pk'),
      status: 'published',
      scheduledAt: now - 600,
      publishedAt: now - 300,
      publishedEventId: 'evt123',
    };
    const due = getDuePosts([post], now);
    expect(due.length).toBe(0);
  });

  it('skips failed posts', () => {
    const post: SchedulerPost = {
      ...createNewPost('pk'),
      status: 'failed',
      scheduledAt: now - 60,
      errorMessage: 'something broke',
    };
    const due = getDuePosts([post], now);
    expect(due.length).toBe(0);
  });

  it('handles mixed batch: returns only due scheduled posts', () => {
    const posts: SchedulerPost[] = [
      // Should be published: due, scheduled
      { ...createNewPost('pk'), status: 'scheduled', scheduledAt: now - 120 },
      // Should be published: due, scheduled
      { ...createNewPost('pk'), status: 'scheduled', scheduledAt: now },
      // Should NOT: future
      { ...createNewPost('pk'), status: 'scheduled', scheduledAt: now + 600 },
      // Should NOT: draft
      { ...createNewPost('pk'), status: 'draft', scheduledAt: null },
      // Should NOT: already published
      { ...createNewPost('pk'), status: 'published', scheduledAt: now - 300, publishedAt: now - 200, publishedEventId: 'x' },
      // Should NOT: failed
      { ...createNewPost('pk'), status: 'failed', scheduledAt: now - 60, errorMessage: 'oops' },
    ];

    const due = getDuePosts(posts, now);
    expect(due.length).toBe(2);
    expect(due.every(p => p.status === 'scheduled')).toBe(true);
    expect(due.every(p => p.scheduledAt !== null && p.scheduledAt <= now)).toBe(true);
  });
});

describe('Scheduler publish — event output for scheduled promo note', () => {
  it('builds a correct kind 1 event for a promo note that is due', () => {
    const post: SchedulerPost = {
      ...createNewPost('merchant-pubkey-hex'),
      status: 'scheduled',
      scheduledAt: 1743264000,
      content: 'Check out my Organic Handmade Soap! 5,000 sats\n\nAll-natural soap, Bitcoin only\n📍 Portland, OR',
    };
    post.media = [
      { url: 'https://example.com/soap.jpg', mimeType: 'image/jpeg', dimensions: '800x600' },
    ];
    post.importedListing = {
      title: 'Organic Handmade Soap',
      summary: 'All-natural soap, Bitcoin only',
      price: '5000',
      currency: 'SAT',
      location: 'Portland, OR',
      categories: ['soap', 'handmade', 'organic'],
      images: [{ url: 'https://example.com/soap.jpg', dimensions: '800x600' }],
    };

    const event = buildEvent(post);

    // Always kind 1
    expect(event.kind).toBe(1);
    expect(event.content).toContain('Organic Handmade Soap');
    expect(event.content).toContain('https://example.com/soap.jpg');

    // NIP-92 imeta tag
    const imetaTags = event.tags.filter(t => t[0] === 'imeta');
    expect(imetaTags.length).toBe(1);
    expect(imetaTags[0]).toContain('url https://example.com/soap.jpg');
    expect(imetaTags[0]).toContain('m image/jpeg');

    // No NIP-99 specific tags (d, title, price, etc.)
    expect(event.tags.find(t => t[0] === 'd')).toBeUndefined();
    expect(event.tags.find(t => t[0] === 'title')).toBeUndefined();
    expect(event.tags.find(t => t[0] === 'price')).toBeUndefined();
  });
});
