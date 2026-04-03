import Link from 'next/link';
import { redirect } from 'next/navigation';
import prisma from '@/lib/prisma';
import { JVP_FORM_CODE, JVP_REQUEST_TITLE } from '@/lib/validations/jvp';
import { PBL_FORM_CODE, PBL_REQUEST_TITLE } from '@/lib/validations/pbl';
import { RTP_FORM_CODE, RTP_REQUEST_TITLE } from '@/lib/validations/rtp';
import { getCurrentUser } from '@/src/lib/auth/get-current-user';
import JvpMultiStepForm from './_components/jvp-multi-step-form';
import PblMultiStepForm from './_components/pbl-multi-step-form';
import RtpMultiStepForm from './_components/rtp-multi-step-form';
export const runtime = 'nodejs';

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
  const isPblForm = normalizedChannel === 'gcpc' && formCode === PBL_FORM_CODE;
  const isJvpForm = normalizedChannel === 'gcpc' && formCode === JVP_FORM_CODE;
  const isImplementedForm = isRtpForm || isPblForm || isJvpForm;

  if (isImplementedForm) {
    const user = await getCurrentUser();
    if (!user) {
      redirect('/login');
    }

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
            <h1 className="page-title">{isRtpForm ? 'RTP Form' : isPblForm ? 'PBL Form' : 'JVP Form'}</h1>
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
    if (isRtpForm) {
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
    if (isPblForm) {
      const projects = await prisma.project.findMany({
        where: {
          companyId: fallbackCompany.id,
        },
        orderBy: {
          projectName: 'asc',
        },
        select: {
          id: true,
          projectName: true,
          projectCode: true,
          companyId: true,
          companyCode: true,
          companyName: true,
        },
      });

      return (
        <div className="space-y-6">
          <header className="page-header">
            <h1 className="page-title">GCPC / PBL</h1>
            <p className="page-subtitle">
              Multi-step PBL workflow: create base request, choose project details, maintain bidders list, upload documents, then submit with acknowledgement.
            </p>
          </header>

          <PblMultiStepForm
            channel={normalizedChannel}
            requestTitle={PBL_REQUEST_TITLE}
            requestor={{
              id: user.id,
              name: user.name,
              email: user.email,
              companyId: fallbackCompany.id,
              companyCode: fallbackCompany.companyCode,
              companyName: fallbackCompany.companyName,
            }}
            projects={projects.map((project) => ({
              ...project,
              projectCode: project.projectCode ?? '',
            }))}
          />
        </div>
      );
    }

    const projects = await prisma.project.findMany({
      where: {
        companyId: fallbackCompany.id,
      },
      orderBy: {
        projectName: 'asc',
      },
      select: {
        id: true,
        projectName: true,
        projectCode: true,
        companyId: true,
        companyCode: true,
        companyName: true,
      },
    });

    return (
      <div className="space-y-6">
        <header className="page-header">
          <h1 className="page-title">GCPC / JVP</h1>
          <p className="page-subtitle">
            7-step JVP workflow: create base request, select project, fill PIC and collaboration sections, attach supporting files, then submit with acknowledgement.
          </p>
        </header>

        <JvpMultiStepForm
          channel={normalizedChannel}
          requestTitle={JVP_REQUEST_TITLE}
          requestor={{
            id: user.id,
            name: user.name,
            email: user.email,
            companyId: fallbackCompany.id,
            companyCode: fallbackCompany.companyCode,
            companyName: fallbackCompany.companyName,
          }}
          projects={projects.map((project) => ({
            ...project,
            projectCode: project.projectCode ?? '',
          }))}
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
