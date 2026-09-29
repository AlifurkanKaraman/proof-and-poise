import { AlertTriangle } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Dialog, DialogContent, DialogTrigger, DialogClose } from '../../components/ui/Dialog';

interface DeleteDataDialogProps {
  onConfirm: () => void;
  isDeleting?: boolean;
}

/**
 * "Delete my data" confirmation dialog (Req 2.5).
 * Deletes all session records and S3 objects. Token becomes 401 after deletion.
 */
export function DeleteDataDialog({ onConfirm, isDeleting }: DeleteDataDialogProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="secondary" size="sm">
          Delete my data
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-md">
        <div className="flex flex-col gap-6">
          <div className="flex items-start gap-4">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-error-100">
              <AlertTriangle className="size-6 text-error-700" aria-hidden />
            </div>
            <div className="flex-1">
              <h2 className="text-h3 font-semibold text-ink-950">Delete all your data?</h2>
              <p className="mt-2 text-small text-ink-700">
                This will permanently delete:
              </p>
              <ul className="mt-2 list-inside list-disc text-small text-ink-700">
                <li>Your resume and job description</li>
                <li>All analysis results</li>
                <li>Interview questions and answers</li>
                <li>Audio recordings</li>
                <li>Readiness report</li>
              </ul>
              <p className="mt-4 text-small font-semibold text-error-700">
                This action cannot be undone.
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <DialogClose asChild>
              <Button variant="secondary" className="flex-1" disabled={isDeleting}>
                Cancel
              </Button>
            </DialogClose>
            <Button
              onClick={onConfirm}
              disabled={isDeleting}
              className="flex-1 bg-error-700 hover:bg-error-800"
            >
              {isDeleting ? 'Deleting...' : 'Delete everything'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
