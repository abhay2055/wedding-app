import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import * as eventsApi from "../api/events";
import { useCategories } from "../hooks/useCategories";
import { Card } from "../components/Card";
import { Input } from "../components/Input";
import { Button } from "../components/Button";
import { ErrorMessage, extractErrorMessage } from "../components/ErrorMessage";

const STEPS = ["Name", "City", "Wedding date", "Guest count", "Budget", "Services you need"] as const;

export function WeddingSetupPage() {
  const navigate = useNavigate();
  const { categories } = useCategories();
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [weddingDate, setWeddingDate] = useState("");
  const [guestCount, setGuestCount] = useState("");
  const [budgetMin, setBudgetMin] = useState("");
  const [budgetMax, setBudgetMax] = useState("");
  const [categoryIds, setCategoryIds] = useState<Set<string>>(new Set());

  const isLastStep = step === STEPS.length - 1;

  function canProceed(): boolean {
    if (step === 0) return name.trim().length >= 2;
    if (step === 1) return city.trim().length >= 2;
    if (step === 2) return weddingDate.trim().length > 0;
    return true;
  }

  function toggleCategory(id: string) {
    setCategoryIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!isLastStep) {
      setStep((s) => s + 1);
      return;
    }

    setError(null);
    setIsSaving(true);
    try {
      await eventsApi.createEvent({
        name,
        city,
        weddingDate,
        guestCount: guestCount ? Number(guestCount) : undefined,
        budgetMin: budgetMin ? Number(budgetMin) : undefined,
        budgetMax: budgetMax ? Number(budgetMax) : undefined,
        categoryIds: categoryIds.size > 0 ? Array.from(categoryIds) : undefined,
      });
      navigate("/dashboard");
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6 px-4 py-12">
      <div>
        <p className="text-sm text-neutral-500">
          Step {step + 1} of {STEPS.length}
        </p>
        <h1 className="text-2xl font-semibold text-brand-800">{STEPS[step]}</h1>
      </div>

      <Card>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {error && <ErrorMessage message={error} />}

          {step === 0 && (
            <Input
              label="What should we call your wedding/event?"
              placeholder="e.g. Abhay Wedding"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          )}

          {step === 1 && (
            <Input
              label="Which city is the wedding in?"
              placeholder="e.g. Jalandhar"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              autoFocus
            />
          )}

          {step === 2 && (
            <Input
              label="Wedding date"
              type="date"
              value={weddingDate}
              onChange={(e) => setWeddingDate(e.target.value)}
              autoFocus
            />
          )}

          {step === 3 && (
            <Input
              label="Expected guest count (optional)"
              type="number"
              min={1}
              placeholder="e.g. 300"
              value={guestCount}
              onChange={(e) => setGuestCount(e.target.value)}
              autoFocus
            />
          )}

          {step === 4 && (
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Budget min (₹, optional)"
                type="number"
                min={0}
                value={budgetMin}
                onChange={(e) => setBudgetMin(e.target.value)}
                autoFocus
              />
              <Input
                label="Budget max (₹, optional)"
                type="number"
                min={0}
                value={budgetMax}
                onChange={(e) => setBudgetMax(e.target.value)}
              />
            </div>
          )}

          {step === 5 && (
            <div>
              <p className="mb-2 text-sm font-medium text-neutral-700">
                Which services are you interested in? (optional)
              </p>
              <div className="grid grid-cols-2 gap-2">
                {categories.map((c) => (
                  <label key={c.id} className="flex items-center gap-2 text-sm text-neutral-700">
                    <input type="checkbox" checked={categoryIds.has(c.id)} onChange={() => toggleCategory(c.id)} />
                    {c.name}
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-between pt-2">
            <Button
              type="button"
              variant="secondary"
              disabled={step === 0}
              onClick={() => setStep((s) => Math.max(0, s - 1))}
            >
              Back
            </Button>
            <Button type="submit" disabled={!canProceed()} isLoading={isSaving}>
              {isLastStep ? "Create Wedding" : "Next"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
