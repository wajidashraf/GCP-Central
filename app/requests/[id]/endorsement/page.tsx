import { notFound, redirect } from 'next/navigation';
import Button from '@/src/components/ui/button';
import { getCurrentUser } from '@/src/lib/auth/get-current-user';
import { loadEndorsement } from '@/src/lib/requests/endorsement-load';
import EndorsementClient from './endorsement-client';

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function EndorsementPage({ params }: PageProps) {
  const { id } = await params;
  const user = await getCurrentUser();
  const result = await loadEndorsement(id, user);

  if (!result.ok) {
    if (result.status === 401) {
      redirect(`/login?callbackUrl=${encodeURIComponent(`/requests/${id}/endorsement`)}`);
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

  return <EndorsementClient data={result.data} />;
}
