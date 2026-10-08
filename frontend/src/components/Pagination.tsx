import { Pagination as PaginationData } from "../types/api";
import { Button } from "./Button";

export function Pagination({ pagination, onPageChange }: { pagination: PaginationData; onPageChange: (page: number) => void }) {
  if (pagination.totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-center gap-3 py-6">
      <Button
        variant="secondary"
        disabled={pagination.page <= 1}
        onClick={() => onPageChange(pagination.page - 1)}
      >
        Previous
      </Button>
      <span className="text-sm text-neutral-600">
        Page {pagination.page} of {pagination.totalPages}
      </span>
      <Button
        variant="secondary"
        disabled={pagination.page >= pagination.totalPages}
        onClick={() => onPageChange(pagination.page + 1)}
      >
        Next
      </Button>
    </div>
  );
}
