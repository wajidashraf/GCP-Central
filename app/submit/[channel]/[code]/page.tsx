import Link from 'next/link';
import prisma from '@/lib/prisma';
import { RTP_FORM_CODE, RTP_REQUEST_TITLE } from '@/lib/validations/rtp';
import { getCurrentUser } from '@/src/lib/auth/get-current-user';
import RtpMultiStepForm from './_components/rtp-multi-step-form';

type SubmitFormPageProps = {
  params: Promise<{
    channel: string;
    code: string;
  }>;
};

export default async function SubmitFormPage({ params }: SubmitFormPageProps) {
  const { channel, code } = await params;
  const normalizedChannel = channel.toLowerCase() as 'gcpc' | 'gcp';
  const channelLabel = normalizedChannel.toUpperCase();
  const formCode = decodeURIComponent(code).toUpperCase();
  const isRtpForm = normalizedChannel === 'gcpc' && formCode === RTP_FORM_CODE;

  if (isRtpForm) {
    const user = await getCurrentUser();

    const preferredCompany = user.companyCode
      ? await prisma.company.findUnique({
          where: { companyCode: user.companyCode },
        })
      : null;

    const fallbackCompany =
      preferredCompany ??
      (await prisma.company.findFirst({
        orderBy: { companyCode: 'asc' },
      }));

    if (!fallbackCompany) {
      return (
        <div className="space-y-6">
          <header className="page-header">
            <h1 className="page-title">RTP Form</h1>
            <p className="page-subtitle">
              No company records are available yet. Seed or create at least one company record first.
            </p>
          </header>
          <Link
            href="/submit"
            className="inline-flex items-center rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm font-medium text-[var(--text)] transition hover:border-[var(--border-strong)]"
          >
            Back to form list
          </Link>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <header className="page-header">
          <h1 className="page-title">GCPC / RTP</h1>
          <p className="page-subtitle">
            Multi-step RTP workflow: create base request, save project details, upload document, then submit with acknowledgement.
          </p>
        </header>

        <RtpMultiStepForm
          channel={normalizedChannel}
          requestTitle={RTP_REQUEST_TITLE}
          requestor={{
            id: user.id,
            name: user.name,
            email: user.email,
            companyId: fallbackCompany.id,
            companyCode: fallbackCompany.companyCode,
            companyName: fallbackCompany.companyName,
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="page-header">
        <h1 className="page-title">
          {channelLabel} / {decodeURIComponent(code)}
        </h1>
        <p className="page-subtitle">Form page under development.</p>
      </header>

      <div className="alert alert--info">
        <p className="alert__title">Under development</p>
        <p className="alert__body">
          This form route is available now, but the full form UI and workflow are still being built.
        </p>
      </div>

      <Link
        href="/submit"
        className="inline-flex items-center rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm font-medium text-[var(--text)] transition hover:border-[var(--border-strong)]"
      >
        Back to form list
      </Link>
    </div>
  );
}
