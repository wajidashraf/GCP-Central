'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PenLine } from 'lucide-react';
import SignSignatureModal, { type SignModalMember } from '@/src/components/modals/sign-signature-modal';
import { REQUEST_STATUS_MAP } from '@/src/constants/enums/requestStatus';

export type SignatoryMemberRow = {
  id: string;
  name: string;
  email: string;
  group: 'prepared' | 'confirmed';
  sortOrder: number;
};

export type RequestSignatureRow = {
  id: string;
  signatoryMemberId: string;
  signatoryName: string;
  signatoryEmail: string;
  type: string;
  signUrl: string;
  signedAt: string;
};

interface RequestSignatureSectionProps {
  requestId: string;
  status: string;
  preparedMembers: SignatoryMemberRow[];
  confirmedMembers: SignatoryMemberRow[];
  signatures: RequestSignatureRow[];
  currentUser: { name: string; email: string } | null;
}

function normalize(s: string) {
  return s.trim().toLowerCase();
}

const PENDING_REVIEW_STATUS = normalize(REQUEST_STATUS_MAP.PENDING_REVIEW.label);
const SIGNATURE_VISIBLE_STATUSES = new Set(
  Object.values(REQUEST_STATUS_MAP)
    .filter((status) => status.value >= REQUEST_STATUS_MAP.PENDING_REVIEW.value)
    .map((status) => normalize(status.label)),
);

function findSignature(memberId: string, signatures: RequestSignatureRow[]) {
  return signatures.find((s) => s.signatoryMemberId === memberId) ?? null;
}

function currentUserMatchesMember(
  user: { name: string; email: string } | null,
  member: SignatoryMemberRow
) {
  if (!user) return false;
  return (
    normalize(user.name) === normalize(member.name) ||
    normalize(user.email) === normalize(member.email)
  );
}

function formatSignatureDate(iso: string) {
  try {
    return new Intl.DateTimeFormat('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(new Date(iso));
  } catch {
    return '—';
  }
}

function SignatureBox({
  member,
  signatures,
  currentUser,
  canSign,
  onSignClick,
}: {
  member: SignatoryMemberRow;
  signatures: RequestSignatureRow[];
  currentUser: { name: string; email: string } | null;
  canSign: boolean;
  onSignClick: (m: SignModalMember) => void;
}) {
  const sig = findSignature(member.id, signatures);
  const hasSig = Boolean(sig);
  const showSign =
    canSign && currentUserMatchesMember(currentUser, member) && !hasSig;

  return (
    <div
      className={`flex flex-col items-center border border-[var(--border)] bg-white text-center ${
        hasSig ? 'ring-1 ring-[var(--brand-200)]' : ''
      }`}
      data-email={member.email}
      data-name={member.name}
      data-member-id={member.id}
      data-group={member.group}
      data-signed={hasSig ? 'true' : 'false'}
    >
      <div
        className={`flex h-[100px] w-full items-center justify-center ${
          hasSig ? '' : 'bg-[var(--surface-muted)] text-sm text-[var(--text-muted)]'
        }`}
      >
        {hasSig && sig ? (
          // eslint-disable-next-line @next/next/no-img-element -- external Cloudinary URL
          <img src={sig.signUrl} alt={`Signature of ${member.name}`} className="max-h-[90px] object-contain" />
        ) : (
          <span>Awaiting signature</span>
        )}
      </div>
      <div className="relative w-full border-t border-[var(--border)] p-2 text-start">
        {showSign ? (
          <button
            type="button"
            title="Add your signature"
            className="absolute right-2 top-2 text-[var(--brand-600)] hover:text-[var(--brand-700)]"
            aria-label="Sign"
            onClick={() =>
              onSignClick({
                id: member.id,
                name: member.name,
                email: member.email,
                group: member.group,
              })
            }
          >
            <PenLine className="h-4 w-4" strokeWidth={2} />
          </button>
        ) : null}
        <p className="m-1 text-[15px] font-semibold leading-tight text-[var(--text)]">{member.name}</p>
        <p className="m-1 text-[15px] leading-tight text-[var(--text-muted)]">Member of Working GCPC</p>
        <p className="m-1 text-[15px] leading-tight text-[var(--text)]">
          Date:{' '}
          <span>{hasSig && sig ? formatSignatureDate(sig.signedAt) : 'Not signed'}</span>
        </p>
      </div>
    </div>
  );
}

export default function RequestSignatureSection({
  requestId,
  status,
  preparedMembers,
  confirmedMembers,
  signatures,
  currentUser,
}: RequestSignatureSectionProps) {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [activeMember, setActiveMember] = useState<SignModalMember | null>(null);
  const normalizedStatus = normalize(status);
  const canSign = normalizedStatus === PENDING_REVIEW_STATUS;

  if (!SIGNATURE_VISIBLE_STATUSES.has(normalizedStatus)) {
    return null;
  }

  const openSign = (member: SignModalMember) => {
    setActiveMember(member);
    setModalOpen(true);
  };

  return (
    <>
      <div
        id="signature-section"
        className="rounded-lg border border-[var(--border)] bg-white p-4 text-sm text-[var(--text)]"
        style={{ fontFamily: 'Arial, sans-serif' }}
      >
        <h3 className="mb-6 bg-[var(--surface-muted)] py-4 text-center text-[15px] font-bold uppercase tracking-wide text-[var(--text)]">
          Prepared and Compiled By
        </h3>
        <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2">
          {preparedMembers.map((member) => (
            <SignatureBox
              key={member.id}
              member={member}
              signatures={signatures}
              currentUser={currentUser}
              canSign={canSign}
              onSignClick={openSign}
            />
          ))}
        </div>

        <h3 className="mb-6 bg-[var(--surface-muted)] py-4 text-center text-[15px] font-bold uppercase tracking-wide text-[var(--text)]">
          Checked and Confirmed By
        </h3>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {confirmedMembers.map((member) => (
            <SignatureBox
              key={member.id}
              member={member}
              signatures={signatures}
              currentUser={currentUser}
              canSign={canSign}
              onSignClick={openSign}
            />
          ))}
        </div>
      </div>

      <SignSignatureModal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setActiveMember(null);
        }}
        requestId={requestId}
        member={activeMember}
        onComplete={() => router.refresh()}
      />
    </>
  );
}
