import { catalogs } from '@globetrot/i18n';
import { NextIntlClientProvider } from 'next-intl';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../lib/upload', () => ({
  ACCEPTED_TYPES: 'image/jpeg',
  mediaUrl: (id: string) => `/v1/media/${id}`,
  uploadPhoto: vi.fn(),
}));

import { PhotoPicker } from './photo-picker';

const render = (readOnly: boolean) =>
  renderToStaticMarkup(
    <NextIntlClientProvider locale="en" messages={catalogs.en} timeZone="UTC">
      <PhotoPicker
        readOnly={readOnly}
        label="Photos"
        max={6}
        onChange={() => {}}
        photos={[
          { mediaId: 'upload-1', alt: 'A temple' },
          {
            mediaId: 'demo-torii',
            alt: 'A torii in a lake',
            src: '/demo/hakone-torii.webp',
            credit: 'Guilhem Vellut · CC BY 2.0',
          },
        ]}
      />
    </NextIntlClientProvider>,
  );

describe('PhotoPicker', () => {
  it('shows static demo photos with their description and credit, and nothing to edit', () => {
    const html = render(true);
    expect(html).toContain('src="/demo/hakone-torii.webp"');
    expect(html).toContain('alt="A torii in a lake"');
    expect(html).toContain('Guilhem Vellut · CC BY 2.0');
    expect(html).toContain('src="/v1/media/upload-1"');
    expect(html).not.toContain('<input');
    expect(html).not.toContain(catalogs.en.photos.add);
  });

  it('keeps uploads, descriptions and removal when editable', () => {
    const html = render(false);
    expect(html).toContain('<input');
    expect(html).toContain(catalogs.en.photos.add);
  });
});
