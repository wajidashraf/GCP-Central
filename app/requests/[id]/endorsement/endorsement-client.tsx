'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import Button from '@/src/components/ui/button';
import type { EndorsementPayload } from '@/src/lib/requests/endorsement-load';

function formatGbDate(iso: string | null | undefined) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return '—';
  }
}

function EndorsementBody({ data }: { data: EndorsementPayload }) {
  const endorsement = data.endorsement;
  const companyName = data.request.companyName || 'Company Name';
  const acceptanceDate = formatGbDate(endorsement.acceptanceDate);

  if (endorsement.kind === 'PBL') {
    return (
      <>
        <p>
          Dear <span className="font-semibold">{companyName}</span>,
        </p>
        <p>
          Based on company&apos;s business decision, at the point of review we record that this
          package was reviewed with {endorsement.bidderCount ?? 0} potential bidders through{' '}
          <span className="font-semibold">{endorsement.procurementMethod || 'Procurement Method'}</span>.
        </p>
        <p>
          From the guidelines and checklist, we are pleased to endorse your Prospective Bidder&apos;s
          List based on your Review Acceptance dated <span className="font-semibold">{acceptanceDate}</span>{' '}
          of our final review via GCPC Summary Review for Prospective Bidders List.
        </p>
        <p>Please use this Endorsement No. for related matters to this PBL.</p>
      </>
    );
  }

  if (endorsement.kind === 'JVP') {
    return (
      <>
        <p>
          Dear <span className="font-semibold">{companyName}</span>,
        </p>
        <p>
          Based on the company&apos;s business decision, we note that the proposed collaboration for{' '}
          <span className="font-semibold">{endorsement.projectName || endorsement.projectCode}</span> was
          reviewed by GCPC.
        </p>
        <p>
          Referring to the information submitted and discussions held, we are pleased to ENDORSE the
          JV / Partnership submission based on your Review Acceptance dated{' '}
          <span className="font-semibold">{acceptanceDate}</span>, following our final review via the
          GCPC Summary Review.
        </p>
        <p>Please use this Endorsement No. for related matters to this JV / Partnership formation.</p>
      </>
    );
  }

  if (endorsement.kind === 'RTP') {
    return (
      <>
        <p>
          Dear <span className="font-semibold">{companyName}</span>,
        </p>
        <p>
          Based on company&apos;s business decision, we note that{' '}
          <span className="font-semibold">{endorsement.projectName || data.request.requestTitle}</span>{' '}
          was reviewed for registration of tender / proposal list.
        </p>
        <p>
          From the guidelines and checklist, we are pleased to ENDORSE your submission based on your
          Review Acceptance dated <span className="font-semibold">{acceptanceDate}</span> of our final
          review via GCPC Summary Review.
        </p>
        <p>Please use this Endorsement No. for related matters to this tender / proposal list.</p>
      </>
    );
  }

  return (
    <>
      <p>
        Dear <span className="font-semibold">{companyName}</span>,
      </p>
      <p>
        From the guidelines and checklist, we are pleased to ENDORSE your request based on your Review
        Acceptance dated <span className="font-semibold">{acceptanceDate}</span> of our final review via
        GCPC Summary Review.
      </p>
      <p>Please use this Endorsement No. for related matters to this request.</p>
    </>
  );
}

interface EndorsementClientProps {
  data: EndorsementPayload;
}

export default function EndorsementClient({ data }: EndorsementClientProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    setError('');
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/requests/${data.request.id}/endorsement`, {
        method: 'POST',
        credentials: 'include',
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) throw new Error(payload?.error || 'Failed to submit endorsement');

      router.push(`/requests/${data.request.id}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to submit endorsement');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 print:max-w-none">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Button href={`/requests/${data.request.id}`} variant="secondary" size="sm">
          Back
        </Button>
        <Button type="button" variant="primary" size="sm" onClick={() => window.print()}>
          Print
        </Button>
      </div>

      <div className="rounded-lg border border-[var(--border)] bg-white shadow-sm">
        <div className="border-b border-[var(--border)] px-5 py-4 text-center">
          <h1 className="text-lg font-bold tracking-wide text-[var(--text)]">{data.endorsement.title}</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">{data.endorsement.subtitle}</p>
          <div className="mt-4 rounded-md bg-[var(--surface-muted)] px-3 py-2 text-sm font-semibold text-[var(--text)]">
            ENDORSEMENT NO.: <span className="ml-2">{data.endorsement.no}</span>
          </div>
        </div>

        <div className="space-y-5 p-5">
          <div className="overflow-hidden rounded-lg border border-[var(--border)]">
            <table className="w-full text-sm">
              <tbody>
                <tr className="border-b border-[var(--border)]">
                  <td className="w-44 bg-[var(--surface-muted)] px-3 py-2 font-medium">Project Code</td>
                  <td className="px-3 py-2">{data.endorsement.projectCode}</td>
                </tr>
                <tr className="border-b border-[var(--border)]">
                  <td className="bg-[var(--surface-muted)] px-3 py-2 font-medium">Review No.</td>
                  <td className="px-3 py-2">{data.endorsement.reviewNo}</td>
                </tr>
                <tr className="border-b border-[var(--border)]">
                  <td className="bg-[var(--surface-muted)] px-3 py-2 font-medium">Date of Review</td>
                  <td className="px-3 py-2">{formatGbDate(data.endorsement.reviewDate)}</td>
                </tr>
                <tr>
                  <td className="bg-[var(--surface-muted)] px-3 py-2 font-medium">Review Acceptance Date</td>
                  <td className="px-3 py-2">{formatGbDate(data.endorsement.acceptanceDate)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="space-y-4 text-sm leading-6 text-[var(--text)]">
            <EndorsementBody data={data} />
          </div>

          <div className="pt-8">
            <div className="mb-3 h-px w-64 bg-[var(--border-strong)]" />
            <p className="mb-1 text-sm text-[var(--text-muted)]">On behalf of</p>
            <p className="font-semibold text-[var(--text)]">Group Contracts and Procurement Committee</p>
          </div>

          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-4 text-sm">
            <h2 className="mb-2 font-semibold text-[var(--text)]">Attachments:</h2>
            <ol className="list-decimal space-y-1 pl-5 text-[var(--text)]">
              <li>Company Review Acceptance</li>
              <li>GCPC Summary Review signed by Members</li>
            </ol>
          </div>

          <div className="space-y-1 text-sm italic text-[var(--text-muted)]">
            <p className="font-bold">cc.</p>
            <p>GEXCO</p>
            <p>GCPC Chairman- Dato Rosli b Husin</p>
            <p>GCPC Member- Mohammad Nadzif b Bustari</p>
            <p>GCPC Member- Hafitz b Khalid</p>
            <p>GCPC Member- Ivy Lau</p>
            <p>GCPC Member- Foong Pak Chee</p>
            <p>OEC</p>
            <p>Company Team Leader</p>
          </div>
        </div>
      </div>

      {error ? <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700 print:hidden">{error}</div> : null}

      <div className="mt-6 flex justify-end print:hidden">
        <Button type="button" variant="primary" size="sm" disabled={isSubmitting} onClick={() => void handleSubmit()}>
          {isSubmitting ? 'Submitting…' : 'Submit'}
        </Button>
      </div>
    </div>
  );
}
