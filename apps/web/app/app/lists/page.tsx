import { ComingSoon, sectionTitle } from '../_components/coming-soon';

export async function generateMetadata() {
  return { title: await sectionTitle('lists') };
}

export default function ListsPage() {
  return <ComingSoon section="lists" />;
}
