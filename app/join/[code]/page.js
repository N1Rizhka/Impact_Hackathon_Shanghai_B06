import BrainAidApp from '@/components/BrainAidApp';

export default async function JoinPage({ params }) {
  const { code } = await params;
  return <BrainAidApp initialInvite={code || ''} />;
}
