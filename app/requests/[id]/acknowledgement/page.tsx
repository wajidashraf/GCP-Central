import { notFound, redirect } from 'next/navigation';
import Button from '@/src/components/ui/button';
import { getCurrentUser } from '@/src/lib/auth/get-current-user';
import { loadAcknowledgement } from '@/src/lib/requests/acknowledgement-load';
import AcknowledgementClient from './acknowledgement-client';

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function AcknowledgementPage({ params }: PageProps) {
  const { id } = await params;
  const user = await getCurrentUser();
  const result = await loadAcknowledgement(id, user);

  if (!result.ok) {
    if (result.status === 401) {
      redirect(`/login?callbackUrl=${encodeURIComponent(`/requests/${id}/acknowledgement`)}`);
    }
    if (result.status === 404) {
      notFound();
    }
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <p className="text-red-700">{result.error}</p>
        <Button href={`/requests/${id}`} variant="secondary" className="mt-4">
          Back to request
        </Button>
      </div>
    );
  }

  return <AcknowledgementClient data={result.data} />;
}
