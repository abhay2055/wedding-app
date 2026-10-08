import { FormEvent, useEffect, useState } from "react";
import * as adminApi from "../api/admin";
import { Category } from "../types/api";
import { Card } from "../components/Card";
import { Input } from "../components/Input";
import { Button } from "../components/Button";
import { LoadingState } from "../components/LoadingState";
import { ErrorMessage, extractErrorMessage } from "../components/ErrorMessage";

export function AdminCategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [newName, setNewName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  function load() {
    setIsLoading(true);
    adminApi
      .listCategoriesForAdmin()
      .then(setCategories)
      .catch((err) => setError(extractErrorMessage(err)))
      .finally(() => setIsLoading(false));
  }

  useEffect(load, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setError(null);
    setIsCreating(true);
    try {
      const category = await adminApi.createCategory({ name: newName.trim() });
      setCategories((prev) => [...prev, category].sort((a, b) => a.name.localeCompare(b.name)));
      setNewName("");
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setIsCreating(false);
    }
  }

  async function handleToggleActive(category: Category) {
    setBusyId(category.id);
    try {
      const updated = category.isActive
        ? await adminApi.deactivateCategory(category.id)
        : await adminApi.updateCategory(category.id, { isActive: true });
      setCategories((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-semibold text-brand-800">Manage categories</h1>

      <Card className="mb-6">
        <form onSubmit={handleCreate} className="flex items-end gap-3">
          <div className="flex-1">
            <Input label="New category name" value={newName} onChange={(e) => setNewName(e.target.value)} />
          </div>
          <Button type="submit" isLoading={isCreating}>
            Add category
          </Button>
        </form>
      </Card>

      {error && <ErrorMessage message={error} />}
      {isLoading ? (
        <LoadingState label="Loading categories..." />
      ) : (
        <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-neutral-200 bg-neutral-50 text-xs uppercase text-neutral-500">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Slug</th>
                <th className="px-4 py-3">Vendors</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {categories.map((category) => (
                <tr key={category.id} className="border-b border-neutral-100 last:border-0">
                  <td className="px-4 py-3 font-medium text-neutral-900">{category.name}</td>
                  <td className="px-4 py-3 text-neutral-500">{category.slug}</td>
                  <td className="px-4 py-3 text-neutral-500">{category._count?.vendors ?? 0}</td>
                  <td className="px-4 py-3">
                    <span className={category.isActive ? "text-green-700" : "text-neutral-400"}>
                      {category.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      variant="secondary"
                      onClick={() => handleToggleActive(category)}
                      isLoading={busyId === category.id}
                    >
                      {category.isActive ? "Deactivate" : "Activate"}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
