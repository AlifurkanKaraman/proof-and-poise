import { AlertTriangle, Trash2 } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Dialog, DialogContent, DialogTrigger, DialogClose } from '../../components/ui/Dialog';
import { IconTile } from '../../components/ui/IconTile';

interface DeleteDataDialogProps {
  onConfirm: () => void;
  isDeleting?: boolean;
  /** A failed delete; the dialog stays open so the candidate can try again. */
  error?: string | null;
}

/**
 * "Delete my data" confirmation dialog (Req 2.5).
 * Deletes all session records and S3 objects. Token becomes 401 after deletion.
 */
export function DeleteDataDialog({ onConfirm, isDeleting, error = null }: DeleteDataDialogProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="secondary" size="sm">
          <Trash2 className="size-4" aria-hidden="true" />
          Delete my data
        </Button>
      </DialogTrigger>

      <DialogContent title="Delete all your data?" className="max-w-md">
        <div className="flex flex-col gap-6">
          <div className="flex items-start gap-4">
            <IconTile icon={AlertTriangle} tone="red" size="lg" />
            <div className="flex-1">
              <p className="text-small text-ink-700">This will permanently delete:</p>
              <ul className="mt-2 list-inside list-disc text-small text-ink-700">
                <li>Your resume and job description</li>
                <li>All analysis results</li>
                <li>Interview questions and answers</li>
                <li>Audio recordings</li>
                <li>Readiness report</li>
              </ul>
              <p className="mt-4 text-small font-semibold text-red-700">
                This action cannot be undone.
              </p>
            </div>
          </div>

          {error && (
            <p role="alert" className="flex items-start gap-2 text-small text-red-700">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span>Your data was not deleted. {error}</span>
            </p>
          )}

          <div className="flex gap-3">
            <DialogClose asChild>
              <Button variant="secondary" className="flex-1" disabled={isDeleting}>
                Cancel
              </Button>
            </DialogClose>
            <Button
              variant="destructive"
              onClick={onConfirm}
              disabled={isDeleting}
              className="flex-1"
            >
              {isDeleting ? 'Deleting...' : 'Delete everything'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
