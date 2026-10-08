import { useEffect, useState } from "react";
import * as adminApi from "../api/admin";
import { AdminCustomer } from "../types/api";
import { Pagination } from "../components/Pagination";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { LoadingState } from "../components/LoadingState";
import { EmptyState } from "../components/EmptyState";
import { ErrorMessage, extractErrorMessage } from "../components/ErrorMessage";
import { formatDate } from "../utils/format";

export function AdminCustomersPage() {
  const [customers, setCustomers] = useState<AdminCustomer[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  function load() {
    setIsLoading(true);
    setError(null);
    adminApi
      .listCustomersForAdmin({ search: search || undefined, page, limit: 20 })
      .then((res) => {
        setCustomers(res.items);
        setPagination(res.pagination);
      })
      .catch((err) => setError(extractErrorMessage(err)))
      .finally(() => setIsLoading(false));
  }

  useEffect(load, [page]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleToggleActive(customer: AdminCustomer) {
    setBusyId(customer.id);
    try {
      const updated = await adminApi.setCustomerStatus(customer.id, !customer.isActive);
      setCustomers((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-semibold text-brand-800">Customers</h1>

      <div className="mb-6 flex flex-col gap-3 rounded-lg border border-neutral-200 bg-white p-4 sm:flex-row sm:items-end">
        <div className="flex-1">
          <Input label="Search by name or email" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Button onClick={() => { setPage(1); load(); }}>Search</Button>
      </div>

      {error && <ErrorMessage message={error} />}

      {isLoading ? (
        <LoadingState label="Loading customers..." />
      ) : customers.length === 0 ? (
        <EmptyState title="No customers match these filters." />
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
            <table className="w-full min-w-[700px] text-left text-sm">
              <thead className="border-b border-neutral-200 bg-neutral-50 text-xs uppercase text-neutral-500">
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Events</th>
                  <th className="px-4 py-3">Bookings</th>
                  <th className="px-4 py-3">Joined</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {customers.map((customer) => (
                  <tr key={customer.id} className="border-b border-neutral-100 align-top last:border-0">
                    <td className="px-4 py-3">
                      <p className="font-medium text-neutral-900">{customer.name}</p>
                      {customer.phone && <p className="text-xs text-neutral-500">{customer.phone}</p>}
                    </td>
                    <td className="px-4 py-3 text-neutral-600">{customer.email}</td>
                    <td className="px-4 py-3 text-neutral-600">{customer._count.weddingEvents}</td>
                    <td className="px-4 py-3 text-neutral-600">{customer._count.bookings}</td>
                    <td className="px-4 py-3 text-neutral-600">{formatDate(customer.createdAt)}</td>
                    <td className="px-4 py-3">
                      <span className={customer.isActive ? "text-green-700" : "text-neutral-400"}>
                        {customer.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        variant={customer.isActive ? "danger" : "secondary"}
                        onClick={() => handleToggleActive(customer)}
                        isLoading={busyId === customer.id}
                      >
                        {customer.isActive ? "Deactivate" : "Activate"}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination pagination={pagination} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}
