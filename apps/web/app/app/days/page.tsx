import { ComingSoon, sectionTitle } from '../_components/coming-soon';

export async function generateMetadata() {
  return { title: await sectionTitle('days') };
}

export default function DaysPage() {
  return <ComingSoon section="days" />;
}
