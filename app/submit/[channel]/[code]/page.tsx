import Link from 'next/link';
import { JVP_FORM_CODE, JVP_REQUEST_TITLE } from '@/lib/validations/jvp';
import { PBL_FORM_CODE, PBL_REQUEST_TITLE } from '@/lib/validations/pbl';
import { RPP_FORM_CODE, RPP_REQUEST_TITLE } from '@/lib/validations/rpp';
import { RTP_FORM_CODE, RTP_REQUEST_TITLE } from '@/lib/validations/rtp';
import { STSP_FORM_CODE, STSP_REQUEST_TITLE } from '@/lib/validations/stsp';
import { CAA_FORM_CODE, CAA_REQUEST_TITLE } from '@/lib/validations/caa';
import { getCurrentUser } from '@/src/lib/auth/get-current-user';
import { hasRole } from '@/src/lib/auth/has-role';
import { PCCA_FORM_CODE, REVISED_PCCA_FORM_CODE } from '@/lib/validations/pcca';
import { PP_FORM_CODE } from '@/lib/validations/pp';
import { VAP_FORM_CODE } from '@/lib/validations/vap';
import { OTHERS_ROUTE_CODE } from '@/lib/validations/others';
import { CI_FORM_CODE } from '@/lib/validations/ci';
import { CPR_FORM_CODE } from '@/lib/validations/cpr';
import { listCompanies, listItems } from '@/lib/sharepoint/lists';
import JvpMultiStepForm from './_components/jvp-multi-step-form';
import PblMultiStepForm from './_components/pbl-multi-step-form';
import RppMultiStepForm from './_components/rpp-multi-step-form';
import RtpMultiStepForm from './_components/rtp-multi-step-form';
import StspMultiStepForm from './_components/stsp-multi-step-form';
import CaaMultiStepForm from './_components/caa-multi-step-form';
import PccaMultiStepForm from './_components/pcca-multi-step-form';
import RpccaMultiStepForm from './_components/rpcca-multi-step-form';
import PpMultiStepForm from './_components/pp-multi-step-form';
import VapMultiStepForm from './_components/vap-multi-step-form';
import OthersMultiStepForm from './_components/others-multi-step-form';
import CiMultiStepForm from './_components/ci-multi-step-form';
import CprMultiStepForm from './_components/cpr-multi-step-form';
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
  const isStspForm = normalizedChannel === 'gcpc' && formCode === STSP_FORM_CODE;
  const isCaaForm = normalizedChannel === 'gcpc' && formCode === CAA_FORM_CODE;
  const isPccaForm = normalizedChannel === 'gcpc' && formCode === PCCA_FORM_CODE;
  const isRpccaForm = normalizedChannel === 'gcp' && formCode === REVISED_PCCA_FORM_CODE;
  const isPpForm = normalizedChannel === 'gcpc' && formCode === PP_FORM_CODE;
  const isVapForm = normalizedChannel === 'gcpc' && formCode === VAP_FORM_CODE;
  const isOthersForm = formCode === OTHERS_ROUTE_CODE;
  const isCiForm = normalizedChannel === 'gcp' && formCode === CI_FORM_CODE;
  const isCprForm = normalizedChannel === 'gcp' && formCode === CPR_FORM_CODE;
  const isRppForm = normalizedChannel === 'gcp' && formCode === RPP_FORM_CODE;
  const isImplementedForm = isRtpForm || isPblForm || isJvpForm || isStspForm || isCaaForm || isPccaForm || isRpccaForm || isPpForm || isVapForm || isOthersForm || isCiForm || isCprForm || isRppForm;

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
    const projectsListId = process.env.PROJECTS_LIST_ID;
    if (!projectsListId) {
      throw new Error('PROJECTS_LIST_ID is not set in .env.local');
    }

    const loadSharePointProjects = async () =>
      listItems<{
        id: string;
        uuid?: string;
        Title?: string;
        projectName?: string;
        projectCode?: string;
        companyCode?: string;
        companyName?: string;
      }>(projectsListId);

    const toFormProjectOption = (project: {
      id: string;
      uuid?: string;
      Title?: string;
      projectName?: string;
      projectCode?: string;
      companyCode?: string;
      companyName?: string;
    }) => ({
      id: project.uuid ?? project.id,
      projectName: project.projectName ?? project.Title ?? '',
      projectCode: project.projectCode ?? '',
      companyId: '',
      companyCode: project.companyCode ?? '',
      companyName: project.companyName ?? '',
    });

    const companies = await listCompanies();
    const preferredCompany = user.companyCode
      ? companies.find(
          (company) =>
            (company.companyCode ?? '').trim().toUpperCase() ===
            user.companyCode!.trim().toUpperCase()
        ) ?? null
      : null;

    const fallbackCompany = preferredCompany ?? companies[0] ?? null;

    if (!fallbackCompany) {
      return (
        <div className="space-y-6">
          <header className="page-header">
            <h1 className="page-title">{isRtpForm ? 'RTP Form' : isPblForm ? 'PBL Form' : isJvpForm ? 'JVP Form' : isStspForm ? 'STSP Form' : isCaaForm ? 'CAA Form' : isPccaForm ? 'PCCA Form' : isRpccaForm ? 'RPCCA Form' : isPpForm ? 'PP Form' : isVapForm ? 'VAP Form' : isOthersForm ? 'Others Form' : isCiForm ? 'CI Form' : isCprForm ? 'CPR Form' : 'RPP Form'}</h1>
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
              companyName: fallbackCompany.Title,
            }}
          />
        </div>
      );
    }
    if (isPblForm) {
      const [projects, companies] = await Promise.all([
        listItems<{
          id: string;
          uuid?: string;
          Title?: string;
          projectName?: string;
          projectCode?: string;
          companyCode?: string;
          companyName?: string;
        }>(projectsListId),
        listCompanies(),
      ]);

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
              companyName: fallbackCompany.Title,
            }}
            companies={companies.map((company: typeof companies[number]) => ({
              id: company.id,
              companyName: company.Title ?? '',
              companyCode: company.companyCode ?? '',
              sector: company.sector ?? '',
            }))}
            projects={projects.map((project: typeof projects[number]) => ({
              id: project.uuid ?? project.id,
              projectName: project.projectName ?? project.Title ?? '',
              projectCode: project.projectCode ?? '',
              companyId: '',
              companyCode: project.companyCode ?? '',
              companyName: project.companyName ?? '',
            }))}
          />
        </div>
      );
    }
    if (isRppForm) {
      const projects = await loadSharePointProjects();

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
              companyName: fallbackCompany.Title,
            }}
            projects={projects.map(toFormProjectOption)}
          />
        </div>
      );
    }

    if (isStspForm) {
      const projects = await loadSharePointProjects();

      return (
        <div className="space-y-6">
          <header className="page-header">
            <h1 className="page-title">GCPC / STSP</h1>
            <p className="page-subtitle">
              6-step STSP workflow: create base request, select project details, fill PIC and ST/SP particulars, upload documents, then submit with acknowledgement.
            </p>
          </header>

          <StspMultiStepForm
            channel={normalizedChannel}
            requestTitle={STSP_REQUEST_TITLE}
            canSubmitRequest={canSubmitRequest}
            requestor={{
              id: user.id,
              name: user.name,
              email: user.email,
              companyId: fallbackCompany.id,
              companyCode: fallbackCompany.companyCode,
              companyName: fallbackCompany.Title,
            }}
            projects={projects.map(toFormProjectOption)}
          />
        </div>
      );
    }

    if (isCaaForm) {
      const projects = await loadSharePointProjects();

      return (
        <div className="space-y-6">
          <header className="page-header">
            <h1 className="page-title">GCPC / CAA</h1>
            <p className="page-subtitle">
              9-step CAA workflow: create base request, fill project/cost/CAA requirement sections, upload documents, then submit with acknowledgement.
            </p>
          </header>

          <CaaMultiStepForm
            channel={normalizedChannel}
            requestTitle={CAA_REQUEST_TITLE}
            canSubmitRequest={canSubmitRequest}
            requestor={{
              id: user.id,
              name: user.name,
              email: user.email,
              companyId: fallbackCompany.id,
              companyCode: fallbackCompany.companyCode,
              companyName: fallbackCompany.Title,
            }}
            projects={projects.map(toFormProjectOption)}
          />
        </div>
      );
    }
    if (isPccaForm) {
      const projects = await loadSharePointProjects();

      return (
        <div className="space-y-6">
          <header className="page-header">
            <h1 className="page-title">GCPC / PCCA</h1>
            <p className="page-subtitle">
              5-step PCCA workflow: create base request, select project, capture cost detail and summary, upload documents, then submit with acknowledgement.
            </p>
          </header>

          <PccaMultiStepForm
            channel={normalizedChannel}
            requestor={{
              id: user.id,
              name: user.name,
              email: user.email,
              companyId: fallbackCompany.id,
              companyCode: fallbackCompany.companyCode,
              companyName: fallbackCompany.Title,
            }}
            projects={projects.map(toFormProjectOption)}
            canSubmitRequest={canSubmitRequest}
          />
        </div>
      );
    }
    if (isRpccaForm) {
      const projects = await loadSharePointProjects();

      return (
        <div className="space-y-6">
          <header className="page-header">
            <h1 className="page-title">GCP / R-PCCA</h1>
            <p className="page-subtitle">
              4-step Revised PCCA workflow: create base request, select project details, capture work item entry and remarks, upload supporting documents, then submit with acknowledgement.
            </p>
          </header>

          <RpccaMultiStepForm
            channel={normalizedChannel}
            requestor={{
              id: user.id,
              name: user.name,
              email: user.email,
              companyId: fallbackCompany.id,
              companyCode: fallbackCompany.companyCode,
              companyName: fallbackCompany.Title,
            }}
            projects={projects.map(toFormProjectOption)}
            canSubmitRequest={canSubmitRequest}
          />
        </div>
      );
    }
    if (isPpForm) {
      const projects = await loadSharePointProjects();

      return (
        <div className="space-y-6">
          <header className="page-header">
            <h1 className="page-title">GCPC / PP</h1>
            <p className="page-subtitle">
              3-step Procurement Plan workflow: create base request, select project details, upload document, then submit with acknowledgement.
            </p>
          </header>

          <PpMultiStepForm
            channel={normalizedChannel}
            requestor={{
              id: user.id,
              name: user.name,
              email: user.email,
              companyId: fallbackCompany.id,
              companyCode: fallbackCompany.companyCode,
              companyName: fallbackCompany.Title,
            }}
            projects={projects.map(toFormProjectOption)}
            canSubmitRequest={canSubmitRequest}
          />
        </div>
      );
    }
    if (isVapForm) {
      const projects = await loadSharePointProjects();

      return (
        <div className="space-y-6">
          <header className="page-header">
            <h1 className="page-title">GCPC / VAP</h1>
            <p className="page-subtitle">
              3-step Vendor Appointment and Procurement workflow: create base request, select project details, upload document, then submit with acknowledgement.
            </p>
          </header>

          <VapMultiStepForm
            channel={normalizedChannel}
            requestor={{
              id: user.id,
              name: user.name,
              email: user.email,
              companyId: fallbackCompany.id,
              companyCode: fallbackCompany.companyCode,
              companyName: fallbackCompany.Title,
            }}
            projects={projects.map(toFormProjectOption)}
            canSubmitRequest={canSubmitRequest}
          />
        </div>
      );
    }
    if (isOthersForm) {
      const projects = await loadSharePointProjects();

      return (
        <div className="space-y-6">
          <header className="page-header">
            <h1 className="page-title">{channelLabel} / OTHERS</h1>
            <p className="page-subtitle">
              3-step Others workflow: create base request, select project and describe the matter, upload document, then submit with acknowledgement.
            </p>
          </header>

          <OthersMultiStepForm
            channel={normalizedChannel}
            requestor={{
              id: user.id,
              name: user.name,
              email: user.email,
              companyId: fallbackCompany.id,
              companyCode: fallbackCompany.companyCode,
              companyName: fallbackCompany.Title,
            }}
            projects={projects.map(toFormProjectOption)}
            canSubmitRequest={canSubmitRequest}
          />
        </div>
      );
    }
    if (isCiForm) {
      const projects = await loadSharePointProjects();

      return (
        <div className="space-y-6">
          <header className="page-header">
            <h1 className="page-title">GCP / CI</h1>
            <p className="page-subtitle">
              5-step CI workflow: create base request, select project details, fill VO/EOT/L&E and payment sections, upload document, then submit with acknowledgement.
            </p>
          </header>

          <CiMultiStepForm
            channel={normalizedChannel}
            requestor={{
              id: user.id,
              name: user.name,
              email: user.email,
              companyId: fallbackCompany.id,
              companyCode: fallbackCompany.companyCode,
              companyName: fallbackCompany.Title,
            }}
            projects={projects.map(toFormProjectOption)}
            canSubmitRequest={canSubmitRequest}
          />
        </div>
      );
    }
    if (isCprForm) {
      const projects = await loadSharePointProjects();

      return (
        <div className="space-y-6">
          <header className="page-header">
            <h1 className="page-title">GCP / CPR</h1>
            <p className="page-subtitle">
              6-step CPR workflow: create base request, complete project, EOT, VO and claims sections, upload document, then submit with acknowledgement.
            </p>
          </header>

          <CprMultiStepForm
            channel={normalizedChannel}
            requestor={{
              id: user.id,
              name: user.name,
              email: user.email,
              companyId: fallbackCompany.id,
              companyCode: fallbackCompany.companyCode,
              companyName: fallbackCompany.Title,
            }}
            projects={projects.map(toFormProjectOption)}
            canSubmitRequest={canSubmitRequest}
          />
        </div>
      );
    }

    const projects = await loadSharePointProjects();

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
            companyName: fallbackCompany.companyName ?? fallbackCompany.Title,
          }}
          projects={projects.map(toFormProjectOption)}
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
