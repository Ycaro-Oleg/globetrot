import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { PipAvatar } from './pip-avatar';
import styles from './ask-pip-link.module.css';

export type PipTopic = 'board' | 'days' | 'budget' | 'lists';

/**
 * "Ask Pip" from inside a trip tool: opens Pip with an idea that fits the screen already written in (nothing is
 * sent until the person presses Ask). Rendered only where the Pip flag is on.
 */
export function AskPipLink({
  topic,
  tone = 'light',
}: {
  topic: PipTopic;
  tone?: 'light' | 'dark';
}) {
  const t = useTranslations('pipPage.askFrom');
  return (
    <Link href={`/app/pip?topic=${topic}`} className={styles.link} data-tone={tone}>
      <PipAvatar size={26} still />
      <span>{t(topic)}</span>
    </Link>
  );
}
