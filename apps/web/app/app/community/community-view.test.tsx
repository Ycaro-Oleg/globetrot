import { catalogs, SUPPORTED_LOCALES, type SupportedLocale } from '@globetrot/i18n';
import { NextIntlClientProvider } from 'next-intl';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('./actions', () => ({}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

import type { FeedData, PostData } from '../../../lib/community';
import { CommunityView } from './community-view';

const LOOK = { hat: 'cap', outfit: 'none', bag: 'trolley', bagColor: 'pink' } as const;
const ANA = { handle: 'ana.ribeiro', name: 'Ana Ribeiro', pipLook: LOOK };
const post = (n: number, extra: Partial<PostData>): PostData => ({
  id: `0193c0a8-7b1e-7c4a-9e2f-3d5a6b7c9a0${n}`,
  kind: 'tip',
  body: '',
  place: null,
  audience: 'everyone',
  attachment: null,
  photos: [],
  createdAt: '2026-11-13T10:00:00.000Z',
  editedAt: null,
  author: ANA,
  mine: false,
  following: false,
  likes: 0,
  liked: false,
  saved: false,
  comments: 0,
  likedBy: null,
  ...extra,
});

const FEED: FeedData = {
  nextBefore: null,
  posts: [
    post(1, {
      body: 'Get to Fushimi Inari before 7am.',
      place: { name: 'Fushimi Inari', countryCode: 'JP' },
      likes: 3,
      liked: true,
      photos: [{ mediaId: '0193c0a8-7b1e-7c4a-9e2f-3d5a6b7c9f01', alt: 'Torii gates at dawn' }],
    }),
    post(2, {
      kind: 'route',
      attachment: {
        kind: 'route',
        title: 'Portugal',
        nights: 9,
        stops: [
          { name: 'Lisbon', countryCode: 'PT', nights: 4 },
          { name: 'Porto', countryCode: 'PT', nights: 5 },
        ],
        total: null,
      },
    }),
    post(3, {
      kind: 'visa',
      mine: true,
      attachment: {
        kind: 'visa',
        countryCode: 'PE',
        city: 'Cusco',
        stampedAt: '2026-11-09T10:00:00.000Z',
        ordinal: 23,
      },
    }),
    post(4, {
      kind: 'goal',
      following: true,
      attachment: { kind: 'goal', tripTitle: 'Patagonia', readyMonth: '2027-01', reached: true },
    }),
  ],
};

function render(locale: SupportedLocale, props: Partial<Parameters<typeof CommunityView>[0]> = {}) {
  return renderToStaticMarkup(
    <NextIntlClientProvider locale={locale} messages={catalogs[locale]} timeZone="UTC">
      <CommunityView
        feedName="all"
        feed={FEED}
        discover={{
          suggestions: [{ person: ANA, posts: 4 }],
          trending: [{ countryCode: 'JP', posts: 2 }],
        }}
        me={{ handle: 'qa.pip', suggestedHandle: 'qa.pip', posts: 1, followers: 0, following: 0 }}
        trips={[]}
        currentTrip={null}
        visas={[]}
        places={[]}
        {...props}
      />
    </NextIntlClientProvider>,
  );
}
const text = (html: string) =>
  html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();

describe.each(SUPPORTED_LOCALES)('community (%s)', (locale) => {
  const copy = catalogs[locale].communityPage;

  it('shows the feed tabs, the composer prompt and the discover column', () => {
    const html = render(locale);
    const plain = text(html);
    expect(plain).toContain(copy.forYou);
    expect(plain).toContain(copy.following);
    expect(html).toContain(`placeholder="${copy.composer.prompt}"`);
    expect(plain).toContain(copy.aside.whoFollow);
    expect(plain).toContain(copy.aside.trending);
    expect(plain).toContain('@qa.pip');
  });

  it('draws every kind of post, with likes as a glyph and a word', () => {
    const html = render(locale);
    const plain = text(html);
    expect(plain).toContain('Get to Fushimi Inari before 7am.');
    expect(plain).toContain('Lisbon');
    expect(plain).toContain('Porto');
    expect(plain).toContain(copy.post.copyRoute);
    expect(plain).toContain(copy.post.visaNote);
    expect(plain).toContain(copy.post.goalNote);
    expect(html).toMatch(/aria-pressed="true"[^>]*><span aria-hidden="true"[^>]*>♥/);
    expect(html).toContain('src="/v1/media/0193c0a8-7b1e-7c4a-9e2f-3d5a6b7c9f01"');
    expect(html).toContain('alt="Torii gates at dawn"');
    // A place on someone else's tip can be saved to the trip.
    expect(plain).toContain(copy.post.savePlace);
  });

  it('offers to follow only people not followed yet, never oneself', () => {
    const articles = render(locale)
      .split('<article')
      .slice(1)
      .map((chunk) => chunk.split('</article>')[0]!);
    const withChip = articles.map((article) => article.includes(`>${copy.post.follow}</button>`));
    // Posts 1 and 2 (not followed); the own visa post and the followed goal post have none.
    expect(withChip).toEqual([true, true, false, false]);
  });

  it('shows the quiet state on an empty following feed', () => {
    const plain = text(
      render(locale, { feedName: 'following', feed: { posts: [], nextBefore: null } }),
    );
    expect(plain).toContain(copy.empty.followingTitle);
    expect(plain).toContain(copy.empty.discover);
  });
});
