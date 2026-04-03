import Button from '@/src/components/ui/button';
import prisma from '@/lib/prisma';
import { notFound } from 'next/navigation';

type VerifyRequestPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function VerifyRequestPage({ params }: VerifyRequestPageProps) {
  const { id } = await params;

  const request = await prisma.request.findUnique({
    where: { id },
    select: {
      id: true,
      requestNo: true,
      requestType: true,
      requestTitle: true,
      status: true,
    },
  });

  if (!request) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <header className="page-header sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="page-title">Verify request</h1>
          <p className="page-subtitle">
            {request.requestNo} · {request.requestType} · {request.requestTitle}
          </p>
        </div>
        <Button href={`/requests/${request.id}`} variant="secondary" size="sm">
          Back to request detail
        </Button>
      </header>

      <section className="surface-card p-5">
        <p className="text-sm text-[var(--text)]">
          Verification workflow entry point is ready for this request.
        </p>
        <p className="mt-2 text-sm text-[var(--text-muted)]">Current status: {request.status}</p>
      </section>
    </div>
  );
}
