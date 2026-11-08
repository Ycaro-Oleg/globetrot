import { ComingSoon, sectionTitle } from '../_components/coming-soon';

export async function generateMetadata() {
  return { title: await sectionTitle('budget') };
}

export default function BudgetPage() {
  return <ComingSoon section="budget" />;
}
