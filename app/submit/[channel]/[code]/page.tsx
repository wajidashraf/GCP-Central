import Link from 'next/link';
import prisma from '@/lib/prisma';
import { JVP_FORM_CODE, JVP_REQUEST_TITLE } from '@/lib/validations/jvp';
import { PBL_FORM_CODE, PBL_REQUEST_TITLE } from '@/lib/validations/pbl';
import { RPP_FORM_CODE, RPP_REQUEST_TITLE } from '@/lib/validations/rpp';
import { RTP_FORM_CODE, RTP_REQUEST_TITLE } from '@/lib/validations/rtp';
import { getCurrentUser } from '@/src/lib/auth/get-current-user';
import { hasRole } from '@/src/lib/auth/has-role';
import JvpMultiStepForm from './_components/jvp-multi-step-form';
import PblMultiStepForm from './_components/pbl-multi-step-form';
import RppMultiStepForm from './_components/rpp-multi-step-form';
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
  const isRppForm = normalizedChannel === 'gcp' && formCode === RPP_FORM_CODE;
  const isImplementedForm = isRtpForm || isPblForm || isJvpForm || isRppForm;

  if (isImplementedForm) {
    const user = await getCurrentUser();
    if (!user) {
      return (
        <div className="space-y-6">
          <header className="page-header">
            <h1 className="page-title">Sign in required</h1>
            <p className="page-subtitle">Please sign in to create and submit requests.</p>
          </header>
          <Link
            href={`/login?callbackUrl=${encodeURIComponent(`/submit/${normalizedChannel}/${encodeURIComponent(formCode)}`)}`}
            className="inline-flex items-center rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm font-medium text-[var(--text)] transition hover:border-[var(--border-strong)]"
          >
            Go to login
          </Link>
        </div>
      );
    }

    if (!hasRole(user, 'requestor')) {
      return (
        <div className="space-y-6">
          <header className="page-header">
            <h1 className="page-title">Not authorised</h1>
            <p className="page-subtitle">Only requestors can create requests.</p>
          </header>
          <Link
            href="/requests"
            className="inline-flex items-center rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm font-medium text-[var(--text)] transition hover:border-[var(--border-strong)]"
          >
            Back to requests
          </Link>
        </div>
      );
    }
    const canSubmitRequest = hasRole(user, 'requestor') || hasRole(user, 'admin');

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
            <h1 className="page-title">{isRtpForm ? 'RTP Form' : isPblForm ? 'PBL Form' : isJvpForm ? 'JVP Form' : 'RPP Form'}</h1>
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
            canSubmitRequest={canSubmitRequest}
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
      const companies = await prisma.company.findMany({
        orderBy: {
          companyName: 'asc',
        },
        select: {
          id: true,
          companyName: true,
          companyCode: true,
          sector: true,
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
            canSubmitRequest={canSubmitRequest}
            requestor={{
              id: user.id,
              name: user.name,
              email: user.email,
              companyId: fallbackCompany.id,
              companyCode: fallbackCompany.companyCode,
              companyName: fallbackCompany.companyName,
            }}
            companies={companies.map((company: typeof companies[number]) => ({
              ...company,
              companyCode: company.companyCode ?? '',
              sector: company.sector ?? '',
            }))}
            projects={projects.map((project: typeof projects[number]) => ({
              ...project,
              projectCode: project.projectCode ?? '',
            }))}
          />
        </div>
      );
    }
    if (isRppForm) {
      const projects = await prisma.project.findMany({
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
            <h1 className="page-title">GCP / RPP</h1>
            <p className="page-subtitle">
              Multi-step RPP workflow: create base request, select project details, upload document, then submit with acknowledgement.
            </p>
          </header>

          <RppMultiStepForm
            channel={normalizedChannel}
            requestTitle={RPP_REQUEST_TITLE}
            canSubmitRequest={canSubmitRequest}
            requestor={{
              id: user.id,
              name: user.name,
              email: user.email,
              companyId: fallbackCompany.id,
              companyCode: fallbackCompany.companyCode,
              companyName: fallbackCompany.companyName,
            }}
            projects={projects.map((project: typeof projects[number]) => ({
              ...project,
              projectCode: project.projectCode ?? '',
            }))}
          />
        </div>
      );
    }

    const projects = await prisma.project.findMany({
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
          canSubmitRequest={canSubmitRequest}
          requestor={{
            id: user.id,
            name: user.name,
            email: user.email,
            companyId: fallbackCompany.id,
            companyCode: fallbackCompany.companyCode,
            companyName: fallbackCompany.companyName,
          }}
          projects={projects.map((project: typeof projects[number]) => ({
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
