'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Button from '@/src/components/ui/button';
import type { AcknowledgementPayload } from '@/src/lib/requests/acknowledgement-load';

function defaultAckText(data: AcknowledgementPayload) {
  return `We acknowledge the endorsement issued for ${data.request.requestTitle} and confirm receipt of the related GCPC review documents.`;
}

interface AcknowledgementClientProps {
  data: AcknowledgementPayload;
}

export default function AcknowledgementClient({ data }: AcknowledgementClientProps) {
  const router = useRouter();
  const initialText = useMemo(
    () => data.request.ackLetterTextContent || defaultAckText(data),
    [data]
  );
  const [text, setText] = useState(initialText);
  const [savedText, setSavedText] = useState(data.request.ackLetterTextContent || '');
  const [isEditing, setIsEditing] = useState(!data.request.ackLetterTextContent);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSave = () => {
    const next = text.trim();
    if (!next) {
      setError('Please enter the letter text before saving.');
      return;
    }
    setSavedText(next);
    setText(next);
    setIsEditing(false);
    setError('');
  };

  const handleSubmit = async () => {
    const ackLetterTextContent = (isEditing ? text : savedText || text).trim();
    if (!ackLetterTextContent) {
      setError('Please enter the letter text before submitting.');
      return;
    }

    setError('');
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/requests/${data.request.id}/acknowledgement`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ ackLetterTextContent }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) throw new Error(payload?.error || 'Failed to submit acknowledgement');

      router.push(`/requests/${data.request.id}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to submit acknowledgement');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 print:max-w-none">
      <div className="rounded-lg border border-[var(--border)] bg-white shadow-sm">
        <div className="border-b border-[var(--border)] px-5 py-4 text-center">
          <h1 className="text-lg font-bold tracking-wide text-[var(--text)]">REVIEW AND ACKNOWLEDGEMENT</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">{data.acknowledgement.subtitle}</p>
          <div className="mt-4 rounded-md bg-[var(--surface-muted)] px-3 py-2 text-sm font-semibold text-[var(--text)]">
            ACKNOWLEDGEMENT NO.: <span className="ml-2">{data.acknowledgement.no}</span>
          </div>
        </div>

        <div className="space-y-5 p-5">
          <div className="overflow-hidden rounded-lg border border-[var(--border)]">
            <table className="w-full text-sm">
              <tbody>
                <tr className="border-b border-[var(--border)]">
                  <td className="w-44 bg-[var(--surface-muted)] px-3 py-2 font-medium">Project Name</td>
                  <td className="px-3 py-2">{data.acknowledgement.projectName}</td>
                </tr>
                <tr className="border-b border-[var(--border)]">
                  <td className="bg-[var(--surface-muted)] px-3 py-2 font-medium">Project Code</td>
                  <td className="px-3 py-2">{data.acknowledgement.projectCode}</td>
                </tr>
                <tr>
                  <td className="bg-[var(--surface-muted)] px-3 py-2 font-medium">Company Name</td>
                  <td className="px-3 py-2">{data.request.companyName}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="space-y-4 text-sm leading-6 text-[var(--text)]">
            <p>
              Dear <strong>{data.request.companyName}</strong>,
            </p>

            {isEditing ? (
              <textarea
                className="min-h-40 w-full rounded-lg border border-[var(--border)] p-3 text-sm outline-none focus:border-[var(--brand-500)]"
                value={text}
                placeholder="Enter acknowledgement letter text here..."
                onChange={(e) => setText(e.target.value)}
              />
            ) : (
              <div className="whitespace-pre-wrap rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-4">
                {savedText}
              </div>
            )}
          </div>

          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-4 text-sm">
            <h2 className="mb-2 font-semibold text-[var(--text)]">Attachments:</h2>
            <ol className="list-decimal space-y-1 pl-5 text-[var(--text)]">
              <li>Company Review Acceptance</li>
              <li>GCP Summary Review signed by Members</li>
            </ol>
          </div>

          <div className="space-y-1 text-sm text-[var(--text-muted)]">
            <p className="font-semibold text-[var(--text)]">cc.</p>
            <p>GEXCO</p>
            <p>GCPC Chairman - Dato Rosli b Husin</p>
            <p>GCPC Member - Mohammad Nadzif b Bustari</p>
            <p>GCPC Member - Hafitz b Khalid</p>
            <p>GCPC Member - Ivy Lau</p>
            <p>GCPC Member - Foong Pak Chee</p>
            <p>OEC</p>
            <p>Company Team Leader</p>
          </div>
        </div>
      </div>

      {error ? <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700 print:hidden">{error}</div> : null}

      <div className="mt-6 flex flex-wrap justify-between gap-2 print:hidden">
        <Button href={`/requests/${data.request.id}`} variant="secondary" size="sm">
          Back to Request
        </Button>
        <div className="flex gap-2">
          {isEditing ? (
            <Button type="button" variant="secondary" size="sm" onClick={handleSave}>
              Save
            </Button>
          ) : (
            <Button type="button" variant="secondary" size="sm" onClick={() => setIsEditing(true)}>
              Edit
            </Button>
          )}
          <Button type="button" variant="primary" size="sm" disabled={isSubmitting} onClick={() => void handleSubmit()}>
            {isSubmitting ? 'Submitting…' : 'Submit'}
          </Button>
        </div>
      </div>
    </div>
  );
}
