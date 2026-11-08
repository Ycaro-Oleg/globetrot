import { ComingSoon, sectionTitle } from '../_components/coming-soon';

export async function generateMetadata() {
  return { title: await sectionTitle('board') };
}

export default function BoardPage() {
  return <ComingSoon section="board" />;
}
