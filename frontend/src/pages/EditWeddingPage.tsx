import { FormEvent, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import * as eventsApi from "../api/events";
import { useCategories } from "../hooks/useCategories";
import { Card } from "../components/Card";
import { Input } from "../components/Input";
import { Button } from "../components/Button";
import { LoadingState } from "../components/LoadingState";
import { ErrorMessage, extractErrorMessage } from "../components/ErrorMessage";

export function EditWeddingPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { categories } = useCategories();

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [weddingDate, setWeddingDate] = useState("");
  const [guestCount, setGuestCount] = useState("");
  const [budgetMin, setBudgetMin] = useState("");
  const [budgetMax, setBudgetMax] = useState("");
  const [notes, setNotes] = useState("");
  const [categoryIds, setCategoryIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!id) return;
    eventsApi
      .getMyEvent(id)
      .then((event) => {
        setName(event.name);
        setCity(event.city);
        setWeddingDate(event.weddingDate.slice(0, 10));
        setGuestCount(event.guestCount?.toString() ?? "");
        setBudgetMin(event.budgetMin?.toString() ?? "");
        setBudgetMax(event.budgetMax?.toString() ?? "");
        setNotes(event.notes ?? "");
        setCategoryIds(new Set(event.interestedCategories.map((c) => c.categoryId)));
      })
      .catch((err) => setError(extractErrorMessage(err)))
      .finally(() => setIsLoading(false));
  }, [id]);

  function toggleCategory(catId: string) {
    setCategoryIds((prev) => {
      const next = new Set(prev);
      if (next.has(catId)) next.delete(catId);
      else next.add(catId);
      return next;
    });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!id) return;
    setError(null);
    setIsSaving(true);
    try {
      await eventsApi.updateEvent(id, {
        name,
        city,
        weddingDate,
        guestCount: guestCount ? Number(guestCount) : undefined,
        budgetMin: budgetMin ? Number(budgetMin) : undefined,
        budgetMax: budgetMax ? Number(budgetMax) : undefined,
        notes: notes || undefined,
        categoryIds: Array.from(categoryIds),
      });
      navigate("/dashboard");
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) return <LoadingState label="Loading your wedding details..." />;

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6 px-4 py-12">
      <h1 className="text-2xl font-semibold text-brand-800">Edit your wedding</h1>
      <Card>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {error && <ErrorMessage message={error} />}
          <Input label="Wedding/event name" value={name} onChange={(e) => setName(e.target.value)} required />
          <Input label="City" value={city} onChange={(e) => setCity(e.target.value)} required />
          <Input label="Wedding date" type="date" value={weddingDate} onChange={(e) => setWeddingDate(e.target.value)} required />
          <Input label="Guest count" type="number" min={1} value={guestCount} onChange={(e) => setGuestCount(e.target.value)} />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Budget min (₹)" type="number" min={0} value={budgetMin} onChange={(e) => setBudgetMin(e.target.value)} />
            <Input label="Budget max (₹)" type="number" min={0} value={budgetMax} onChange={(e) => setBudgetMax(e.target.value)} />
          </div>
          <Input label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
          <div>
            <p className="mb-2 text-sm font-medium text-neutral-700">Services you&apos;re interested in</p>
            <div className="grid grid-cols-2 gap-2">
              {categories.map((c) => (
                <label key={c.id} className="flex items-center gap-2 text-sm text-neutral-700">
                  <input type="checkbox" checked={categoryIds.has(c.id)} onChange={() => toggleCategory(c.id)} />
                  {c.name}
                </label>
              ))}
            </div>
          </div>
          <Button type="submit" isLoading={isSaving}>
            Save changes
          </Button>
        </form>
      </Card>
    </div>
  );
}
