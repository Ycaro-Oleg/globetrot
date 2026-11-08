import { ComingSoon, sectionTitle } from '../_components/coming-soon';

export async function generateMetadata() {
  return { title: await sectionTitle('trips') };
}

export default function TripsPage() {
  return <ComingSoon section="trips" />;
}
