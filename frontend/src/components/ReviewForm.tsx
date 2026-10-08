import { FormEvent, useState } from "react";
import { StarRating } from "./StarRating";
import { Button } from "./Button";
import { Input } from "./Input";
import { ErrorMessage, extractErrorMessage } from "./ErrorMessage";
import { Review } from "../types/api";

interface ReviewFormProps {
  initial?: Review;
  onSubmit: (input: { rating: number; title?: string; comment: string }) => Promise<void>;
  submitLabel?: string;
}

export function ReviewForm({ initial, onSubmit, submitLabel = "Submit review" }: ReviewFormProps) {
  const [rating, setRating] = useState(initial?.rating ?? 0);
  const [title, setTitle] = useState(initial?.title ?? "");
  const [comment, setComment] = useState(initial?.comment ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (rating < 1) {
      setError("Please select a star rating.");
      return;
    }
    setIsSaving(true);
    try {
      await onSubmit({ rating, title: title || undefined, comment });
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      {error && <ErrorMessage message={error} />}
      <div>
        <p className="mb-1 text-sm font-medium text-neutral-700">Rating</p>
        <StarRating value={rating} onChange={setRating} size="lg" />
      </div>
      <Input label="Title (optional)" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={150} />
      <div className="flex flex-col gap-1">
        <label htmlFor="review-comment" className="text-sm font-medium text-neutral-700">Comment</label>
        <textarea
          id="review-comment"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          minLength={10}
          maxLength={2000}
          rows={4}
          required
          placeholder="Share details of your experience with this vendor..."
          className="rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-400"
        />
      </div>
      <Button type="submit" isLoading={isSaving}>
        {submitLabel}
      </Button>
    </form>
  );
}
