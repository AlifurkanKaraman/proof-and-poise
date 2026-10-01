import { UserCheck } from 'lucide-react';
import { useId, useState, type FormEvent } from 'react';
import {
  ConfirmationRequestSchema,
  LIMITS,
  type Competency,
  type ConfirmationRequest,
} from '@proof-and-poise/shared';
import { ErrorState } from '../../components/states/ErrorState';
import { Button } from '../../components/ui/Button';
import { Dialog, DialogClose, DialogContent, DialogTrigger } from '../../components/ui/Dialog';
import { Textarea } from '../../components/ui/Textarea';
import { focusRing } from '../../lib/cn';
import { isApiError, userMessage } from '../../lib/api/errors';

const { min, max, maxPerSession } = LIMITS.confirmation;

interface ConfirmExperienceDialogProps {
  competency: Pick<Competency, 'id' | 'name' | 'missingEvidence'>;
  /** Resolves on success; rejects with an ApiError on failure. */
  onSubmit: (body: ConfirmationRequest) => Promise<void>;
  disabled?: boolean;
}

interface FieldErrors {
  statement?: string;
  attested?: string;
}

/** Candidate confirmation of missing or weak evidence (Req 8.1–8.4). */
export function ConfirmExperienceDialog({
  competency,
  onSubmit,
  disabled,
}: ConfirmExperienceDialogProps) {
  const [open, setOpen] = useState(false);
  const [statement, setStatement] = useState('');
  const [attested, setAttested] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitError, setSubmitError] = useState<unknown>(null);
  const [pending, setPending] = useState(false);
  const checkboxId = useId();
  const attestErrorId = `${checkboxId}-error`;

  const quotaReached = isApiError(submitError) && submitError.code === 'QUOTA_EXCEEDED';

  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    setSubmitError(null);
    // Validate with the shared schema; never redefine it locally (engineering.md).
    const parsed = ConfirmationRequestSchema.safeParse({
      competencyId: competency.id,
      statement,
      attested,
    });
    if (!parsed.success) {
      const next: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        if (issue.path[0] === 'statement') {
          next.statement = `Write between ${min} and ${max} characters.`;
        } else if (issue.path[0] === 'attested') {
          next.attested = 'Confirm that this describes your real experience.';
        }
      }
      setErrors(next);
      return;
    }
    setErrors({});
    setPending(true);
    try {
      await onSubmit(parsed.data);
      setOpen(false);
      setStatement('');
      setAttested(false);
    } catch (error) {
      if (isApiError(error) && error.code === 'VALIDATION' && error.fields?.['statement']) {
        setErrors({ statement: error.fields['statement'] });
      } else {
        setSubmitError(error);
      }
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setSubmitError(null);
      }}
    >
      <DialogTrigger asChild>
        <Button variant="secondary" size="sm" disabled={disabled}>
          <UserCheck aria-hidden="true" className="size-4" />I have this experience
        </Button>
      </DialogTrigger>
      <DialogContent
        title={`Confirm your ${competency.name} experience`}
        description={
          competency.missingEvidence ??
          'Describe a real situation where you used this skill. It is stored as your own statement, not as resume evidence.'
        }
      >
        <form noValidate onSubmit={(e) => void submit(e)} className="flex flex-col gap-4">
          <Textarea
            label="Your experience"
            hint={`${min}–${max} characters. Be specific: what you did and the result.`}
            value={statement}
            onChange={(e) => setStatement(e.target.value)}
            minLength={min}
            maxLength={max}
            error={errors.statement}
            required
          />
          <div className="flex flex-col gap-1">
            <label
              htmlFor={checkboxId}
              className="flex min-h-11 cursor-pointer items-center gap-3 text-small text-ink-950"
            >
              <input
                id={checkboxId}
                type="checkbox"
                checked={attested}
                onChange={(e) => setAttested(e.target.checked)}
                aria-invalid={errors.attested ? true : undefined}
                aria-describedby={errors.attested ? attestErrorId : undefined}
                className={`size-5 accent-indigo-600 ${focusRing}`}
              />
              This describes my real experience.
            </label>
            {errors.attested && (
              <p id={attestErrorId} className="text-small text-red-700">
                {errors.attested}
              </p>
            )}
          </div>

          {submitError !== null && (
            <ErrorState
              title={quotaReached ? 'Confirmation limit reached' : "We couldn't save that"}
              message={
                quotaReached
                  ? `A session allows up to ${maxPerSession} confirmations. You can still practice this topic in the interview.`
                  : userMessage(submitError)
              }
              action={
                quotaReached ? (
                  <DialogClose asChild>
                    <Button variant="secondary">Close</Button>
                  </DialogClose>
                ) : (
                  <Button onClick={() => void submit()} loading={pending}>
                    Retry
                  </Button>
                )
              }
            />
          )}

          <div className="flex flex-wrap justify-end gap-3">
            <DialogClose asChild>
              <Button variant="secondary" type="button">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" loading={pending} disabled={quotaReached}>
              Save confirmation
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
