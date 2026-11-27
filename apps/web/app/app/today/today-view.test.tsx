import { catalogs, SUPPORTED_LOCALES } from '@globetrot/i18n';
import { NextIntlClientProvider } from 'next-intl';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('./actions', () => ({ checkIn: vi.fn(), addPhaseTask: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

import { TodayView, type HabitData } from './today-view';

const habit: HabitData = {
  week: '2026-W48',
  checkedIn: null,
  streak: 3,
  suggested: { amount: '200.00', currency: 'BRL' },
  countdown: { daysLeft: 49, phase: 'three-months', tasks: ['insurance', 'stays', 'vaccines'] },
};
const trip = { id: 't1', title: 'Lisboa', canEdit: true };

describe.each(SUPPORTED_LOCALES)('today (%s)', (locale) => {
  const copy = catalogs[locale].todayPage;
  const render = (props: Parameters<typeof TodayView>[0]) =>
    renderToStaticMarkup(
      <NextIntlClientProvider locale={locale} messages={catalogs[locale]} timeZone="UTC">
        <TodayView {...props} />
      </NextIntlClientProvider>,
    );

  it('counts down, keeps the streak and offers a week of the monthly amount', () => {
    const html = render({ trip, habit });
    expect(html).toMatch(/49/);
    expect(html).toContain(copy.phase['three-months']);
    expect(html).toContain(copy.tasks.insurance);
    expect(html).toContain('value="200"');
    expect(html).toContain(copy.checkIn);
    expect(html).not.toMatch(/todayPage\./);
  });

  it('says what was checked in this week, and invites a date when the trip has none', () => {
    const done = render({
      trip,
      habit: {
        ...habit,
        checkedIn: { amount: '250.00', currency: 'BRL' },
        countdown: { daysLeft: null, phase: null, tasks: [] },
      },
    });
    expect(done).toContain(copy.changeCheckIn);
    expect(done).toContain(copy.noDate);
    expect(render({ trip: null, habit: null })).toContain(copy.noTrip);
  });
});
