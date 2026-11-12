import { CHECKLIST_GROUPS, MILESTONES } from '@globetrot/domain';
import { Banner } from '@globetrot/ui';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import type { ChecklistData } from '../../../lib/trips';
import { addItem, addSuggestions, removeItem, setItemDone } from './actions';
import styles from './lists.module.css';

const FLASH: Record<string, { tone: 'success' | 'error'; key: string }> = {
  suggested: { tone: 'success', key: 'suggested' },
  error: { tone: 'error', key: 'error' },
};

/**
 * The checklists of the current trip and its visa page. Items are plain forms (they work without a script): a
 * row is a toggle that saves when pressed. The stamps come from the domain's milestone rules on the server.
 */
export function ListsView({
  trip,
  checklist,
  status,
}: {
  trip: { id: string; title: string } | null;
  checklist: ChecklistData | null;
  status: string | undefined;
}) {
  const t = useTranslations('listsPage');
  const milestones = useTranslations('milestones');

  if (trip === null) {
    return (
      <section className={styles.page}>
        <h1>{t('title')}</h1>
        <p className={styles.lead}>{t('noTrip')}</p>
        <Link className={styles.action} href="/app/trips">
          {t('goTrips')}
        </Link>
      </section>
    );
  }
  if (checklist === null) {
    return (
      <section className={styles.page}>
        <h1>{t('title')}</h1>
        <Banner tone="error" role="alert">
          {t('loadError')}
        </Banner>
      </section>
    );
  }

  const flash = status ? FLASH[status] : undefined;
  const left = MILESTONES.filter((key) => !checklist.readiness[key]).length;

  return (
    <section className={styles.page}>
      <p className={styles.eyebrow}>{trip.title}</p>
      <h1>{t('title')}</h1>

      {flash ? (
        <Banner tone={flash.tone} role={flash.tone === 'error' ? 'alert' : 'status'}>
          {t(`flash.${flash.key}`)}
        </Banner>
      ) : null}

      <div className={styles.grid}>
        <section className={styles.passport} aria-labelledby="visa-title">
          <h2 id="visa-title">{t('visaTitle')}</h2>
          <p className={styles.count}>
            {left === 0 ? t('allEarned') : t('stampsToGo', { count: left })}
          </p>
          <ul className={styles.stamps}>
            {MILESTONES.map((key) => {
              const on = checklist.readiness[key];
              return (
                <li key={key} className={on ? styles.stampOn : styles.stampOff}>
                  <span className={styles.stampMark} aria-hidden="true">
                    {on ? '✓' : ''}
                  </span>
                  <span>
                    {milestones(key)}
                    <small>{on ? t('stampEarned') : t('stampNotYet')}</small>
                  </span>
                </li>
              );
            })}
          </ul>
          <p className={styles.note}>{t('visaNote')}</p>
        </section>

        <div className={styles.lists}>
          <h2 className={styles.listsTitle}>{t('groupsTitle')}</h2>
          {checklist.items.length === 0 ? (
            <section className={styles.card} aria-labelledby="start-title">
              <h3 id="start-title">{t('startTitle')}</h3>
              <p className={styles.note}>{t('startBody')}</p>
              <form action={addSuggestions}>
                <input type="hidden" name="tripId" value={trip.id} />
                <button type="submit" className={styles.primary}>
                  {t('startButton')}
                </button>
              </form>
            </section>
          ) : null}
          {CHECKLIST_GROUPS.map((group) => {
            const items = checklist.items.filter((item) => item.group === group);
            const done = items.filter((item) => item.done).length;
            const name = t(`groups.${group}`);
            return (
              <section key={group} className={styles.card} aria-labelledby={`group-${group}`}>
                <header className={styles.groupHead}>
                  <h3 id={`group-${group}`}>{name}</h3>
                  <span className={styles.progress}>
                    {t('progress', { done, total: items.length })}
                  </span>
                </header>
                {items.length === 0 ? (
                  <p className={styles.note}>{t('emptyGroup')}</p>
                ) : (
                  <ul className={styles.items}>
                    {items.map((item) => (
                      <li key={item.id}>
                        <form action={setItemDone} className={styles.toggleForm}>
                          <input type="hidden" name="tripId" value={trip.id} />
                          <input type="hidden" name="itemId" value={item.id} />
                          <input type="hidden" name="done" value={item.done ? 'false' : 'true'} />
                          <button
                            type="submit"
                            role="checkbox"
                            aria-checked={item.done}
                            className={item.done ? styles.toggleDone : styles.toggle}
                          >
                            <span className={styles.box} aria-hidden="true">
                              {item.done ? '✓' : ''}
                            </span>
                            <span className={styles.itemLabel}>{item.label}</span>
                          </button>
                        </form>
                        <form action={removeItem}>
                          <input type="hidden" name="tripId" value={trip.id} />
                          <input type="hidden" name="itemId" value={item.id} />
                          <button
                            type="submit"
                            className={styles.remove}
                            aria-label={t('removeItem', { label: item.label })}
                          >
                            <span aria-hidden="true">×</span>
                          </button>
                        </form>
                      </li>
                    ))}
                  </ul>
                )}
                <form action={addItem} className={styles.addForm}>
                  <input type="hidden" name="tripId" value={trip.id} />
                  <input type="hidden" name="group" value={group} />
                  <input
                    name="label"
                    required
                    maxLength={120}
                    autoComplete="off"
                    placeholder={t('addPlaceholder')}
                    aria-label={t('addLabel', { group: name })}
                    className={styles.field}
                  />
                  <button type="submit" className={styles.secondary}>
                    {t('add')}
                  </button>
                </form>
              </section>
            );
          })}
        </div>
      </div>
    </section>
  );
}
