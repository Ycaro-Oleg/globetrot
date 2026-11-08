import { ComingSoon, sectionTitle } from '../_components/coming-soon';

export async function generateMetadata() {
  return { title: await sectionTitle('passport') };
}

export default function PassportPage() {
  return <ComingSoon section="passport" />;
}
