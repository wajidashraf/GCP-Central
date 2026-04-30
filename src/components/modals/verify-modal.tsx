'use client';

import { useMemo, useState } from 'react';
import Button from '@/src/components/ui/button';
import { REQUEST_STATUS_MAP } from '@/src/constants/enums/requestStatus';

type StatusOption = { value: string; label: string };

interface VerifyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { comment: string; requestStatus: string }) => Promise<void>;
  currentStatus: string;
  requestType: string;
  isSpecialProject?: boolean;
  isLoading?: boolean;
}

export default function VerifyModal({
  isOpen,
  onClose,
  onSubmit,
  currentStatus,
  requestType,
  isSpecialProject = false,
  isLoading = false,
}: VerifyModalProps) {
  const [comment, setComment] = useState('');
  const [requestStatus, setRequestStatus] = useState<string>('');
  const [error, setError] = useState('');

  const statusOptions = useMemo<StatusOption[]>(() => {
    const normalizedRequestType = requestType.trim().toLowerCase();
    const isRequestType = (...keywords: string[]) =>
      keywords.some((keyword) => normalizedRequestType.includes(keyword));
    if (isRequestType('rtp')|| isRequestType('registration of tender', 'tender & proposal')) {
      return [
        { value: REQUEST_STATUS_MAP.FR.label, label: REQUEST_STATUS_MAP.FR.label },
        { value: REQUEST_STATUS_MAP.RS.label, label: REQUEST_STATUS_MAP.RS.label },
        { value: REQUEST_STATUS_MAP.W.label, label: REQUEST_STATUS_MAP.W.label },
      ];
    }

    if (isRequestType('prospective bidders list', '(pbl)', 'pbl', 'JV / Partnership', 'jvp', '(jvp)')) {
      return [
        { value: REQUEST_STATUS_MAP.FR.label, label: REQUEST_STATUS_MAP.FR.label },
        { value: REQUEST_STATUS_MAP.NEW.label, label: REQUEST_STATUS_MAP.NEW.label },
        { value: REQUEST_STATUS_MAP.RS.label, label: REQUEST_STATUS_MAP.RS.label },
        {
          value: REQUEST_STATUS_MAP.READY_FOR_ENGAGEMENT.label,
          label: REQUEST_STATUS_MAP.READY_FOR_ENGAGEMENT.label,
        },
      ];
    }

    const baseOptions: StatusOption[] = [
      { value: REQUEST_STATUS_MAP.FR.label, label: REQUEST_STATUS_MAP.FR.label },
      { value: REQUEST_STATUS_MAP.RS.label, label: REQUEST_STATUS_MAP.RS.label },
      {
        value: REQUEST_STATUS_MAP.READY_FOR_ENGAGEMENT.label,
        label: REQUEST_STATUS_MAP.READY_FOR_ENGAGEMENT.label,
      },
    ];

    const addOption = (option: StatusOption) => {
      if (!baseOptions.some((item) => item.value === option.value)) {
        baseOptions.push(option);
      }
    };

    if (isSpecialProject) {
      addOption({ value: REQUEST_STATUS_MAP.W.label, label: REQUEST_STATUS_MAP.W.label });
    }

    if (
      isRequestType(
        'registration of tender',
        'client - acceptance of award',
        'r-pcca',
        'rpcca',
        'revised pcca',
        'contractual issue',
        'gcp - others',
        'revised procurement plan'
      )
    ) {
      const idx = baseOptions.findIndex(
        (item) => item.value === REQUEST_STATUS_MAP.READY_FOR_ENGAGEMENT.label
      );
      if (idx >= 0) baseOptions.splice(idx, 1);
    }

    if (isRequestType('r-pcca', 'rpcca', 'revised pcca', 'contractual issue', 'gcp - others', 'revised procurement plan')) {
      addOption({
        value: REQUEST_STATUS_MAP.PENDING_ACK.label,
        label: REQUEST_STATUS_MAP.PENDING_ACK.label,
      });
    }

    if (isRequestType('monthly information update')) {
      return [{ value: REQUEST_STATUS_MAP.FR.label, label: REQUEST_STATUS_MAP.FR.label }];
    }

    return baseOptions;
  }, [isSpecialProject, requestType]);

  const selectableOptions = useMemo<StatusOption[]>(() => {
    if (!currentStatus) return statusOptions;
    if (statusOptions.some((item) => item.value === currentStatus)) {
      return statusOptions;
    }
    return [...statusOptions, { value: currentStatus, label: currentStatus }];
  }, [currentStatus, statusOptions]);

  const effectiveRequestStatus = useMemo(() => {
    if (requestStatus && selectableOptions.some((option) => option.value === requestStatus)) {
      return requestStatus;
    }
    const matchedOption = selectableOptions.find(
      (opt) => opt.value.toLowerCase() === currentStatus?.trim().toLowerCase()
    );
    return matchedOption ? matchedOption.value : selectableOptions[0]?.value ?? '';
  }, [currentStatus, requestStatus, selectableOptions]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!comment.trim()) {
      setError('Please enter a comment');
      return;
    }
    if (!effectiveRequestStatus) {
      setError('Please select a request status');
      return;
    }
    if (effectiveRequestStatus.toLowerCase() === REQUEST_STATUS_MAP.NEW.label.toLowerCase()) {
      setError('Please select a status different from New');
      return;
    }

    try {
      await onSubmit({ comment, requestStatus: effectiveRequestStatus });
      setComment('');
      setRequestStatus('');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit verification');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-2xl rounded-lg bg-white p-6 shadow-lg">
        <h2 className="mb-4 text-2xl font-bold text-[var(--text)]">Verify Request Data</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="requestStatus" className="mb-2 block text-sm font-medium text-[var(--text)]">
              Request Status
            </label>
            <select
              id="requestStatus"
              value={effectiveRequestStatus}
              onChange={(e) => setRequestStatus(e.target.value)}
              className="w-full rounded-lg border border-[var(--border)] bg-white p-3 text-sm text-[var(--text)] focus:border-[var(--brand-500)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-100)]"
              disabled={isLoading}
            >
              {/* ✅ No placeholder option — first real option is selected by default */}
              {selectableOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="comment" className="mb-2 block text-sm font-medium text-[var(--text)]">
              Verification Comment
            </label>
            <textarea
              id="comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Enter your verification comments..."
              className="w-full rounded-lg border border-[var(--border)] bg-white p-3 text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] focus:border-[var(--brand-500)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-100)]"
              rows={5}
              disabled={isLoading}
            />
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
          )}

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="secondary" onClick={onClose} disabled={isLoading}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={isLoading}>
              {isLoading ? 'Submitting...' : 'Submit Verification'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}