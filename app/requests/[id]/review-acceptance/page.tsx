import { notFound, redirect } from 'next/navigation';
import Button from '@/src/components/ui/button';
import { getCurrentUser } from '@/src/lib/auth/get-current-user';
import { loadReviewAcceptance } from '@/src/lib/requests/review-acceptance-load';
import ReviewAcceptanceClient from './review-acceptance-client';

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function ReviewAcceptancePage({ params }: PageProps) {
  const { id } = await params;
  const user = await getCurrentUser();
  const result = await loadReviewAcceptance(id, user);

  if (!result.ok) {
    if (result.status === 401) {
      redirect(`/login?callbackUrl=${encodeURIComponent(`/requests/${id}/review-acceptance`)}`);
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

  return (
    <ReviewAcceptanceClient
      requestId={id.trim()}
      initialData={result.data}
      currentUserName={user?.name ?? null}
    />
  );
}
