import { useEffect, useState } from "react";
import * as adminApi from "../api/admin";
import { Vendor, VerificationStatus } from "../types/api";
import { VerificationBadge } from "../components/VerificationBadge";
import { Pagination } from "../components/Pagination";
import { Button } from "../components/Button";
import { LoadingState } from "../components/LoadingState";
import { EmptyState } from "../components/EmptyState";
import { ErrorMessage, extractErrorMessage } from "../components/ErrorMessage";
import { Input } from "../components/Input";
import { formatInr } from "../utils/format";

const STATUS_FILTERS: { value: VerificationStatus | ""; label: string }[] = [
  { value: "", label: "All statuses" },
  { value: "PENDING", label: "Pending" },
  { value: "VERIFIED", label: "Verified" },
  { value: "REJECTED", label: "Rejected" },
];

export function AdminVendorsPage() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyVendorId, setBusyVendorId] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<VerificationStatus | "">("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  function load() {
    setIsLoading(true);
    setError(null);
    adminApi
      .listVendorsForAdmin({ verificationStatus: statusFilter || undefined, search: search || undefined, page, limit: 20 })
      .then((res) => {
        setVendors(res.items);
        setPagination(res.pagination);
      })
      .catch((err) => setError(extractErrorMessage(err)))
      .finally(() => setIsLoading(false));
  }

  useEffect(load, [statusFilter, page]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleVerify(vendor: Vendor, status: VerificationStatus) {
    setBusyVendorId(vendor.id);
    try {
      const updated = await adminApi.verifyVendor(vendor.id, status);
      setVendors((prev) => prev.map((v) => (v.id === updated.id ? updated : v)));
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setBusyVendorId(null);
    }
  }

  async function handleToggleActive(vendor: Vendor) {
    setBusyVendorId(vendor.id);
    try {
      const updated = await adminApi.setVendorStatus(vendor.id, !vendor.isActive);
      setVendors((prev) => prev.map((v) => (v.id === updated.id ? updated : v)));
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setBusyVendorId(null);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-semibold text-brand-800">Manage vendors</h1>

      <div className="mb-6 flex flex-col gap-3 rounded-lg border border-neutral-200 bg-white p-4 sm:flex-row sm:items-end">
        <div className="flex-1">
          <Input label="Search by name or email" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="status-filter" className="text-sm font-medium text-neutral-700">Status</label>
          <select
            id="status-filter"
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value as VerificationStatus | ""); setPage(1); }}
            className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
          >
            {STATUS_FILTERS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <Button onClick={() => { setPage(1); load(); }}>Search</Button>
      </div>

      {error && <ErrorMessage message={error} />}

      {isLoading ? (
        <LoadingState label="Loading vendors..." />
      ) : vendors.length === 0 ? (
        <EmptyState title="No vendors match these filters." />
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
            <table className="w-full min-w-[700px] text-left text-sm">
              <thead className="border-b border-neutral-200 bg-neutral-50 text-xs uppercase text-neutral-500">
                <tr>
                  <th className="px-4 py-3">Business</th>
                  <th className="px-4 py-3">City</th>
                  <th className="px-4 py-3">Starting price</th>
                  <th className="px-4 py-3">Verification</th>
                  <th className="px-4 py-3">Active</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {vendors.map((vendor) => (
                  <tr key={vendor.id} className="border-b border-neutral-100 last:border-0 align-top">
                    <td className="px-4 py-3">
                      <p className="font-medium text-neutral-900">{vendor.businessName}</p>
                      <p className="text-xs text-neutral-500">{vendor.category?.name ?? "No category"}</p>
                    </td>
                    <td className="px-4 py-3 text-neutral-600">{vendor.city}</td>
                    <td className="px-4 py-3 text-neutral-600">{formatInr(vendor.startingPrice)}</td>
                    <td className="px-4 py-3">
                      <VerificationBadge status={vendor.verificationStatus} />
                      <div className="mt-2 flex flex-wrap gap-1">
                        {vendor.verificationStatus !== "VERIFIED" && (
                          <button
                            onClick={() => handleVerify(vendor, "VERIFIED")}
                            disabled={busyVendorId === vendor.id}
                            className="text-xs text-green-700 hover:underline disabled:opacity-50"
                          >
                            Verify
                          </button>
                        )}
                        {vendor.verificationStatus !== "REJECTED" && (
                          <button
                            onClick={() => handleVerify(vendor, "REJECTED")}
                            disabled={busyVendorId === vendor.id}
                            className="text-xs text-red-600 hover:underline disabled:opacity-50"
                          >
                            Reject
                          </button>
                        )}
                        {vendor.verificationStatus !== "PENDING" && (
                          <button
                            onClick={() => handleVerify(vendor, "PENDING")}
                            disabled={busyVendorId === vendor.id}
                            className="text-xs text-amber-700 hover:underline disabled:opacity-50"
                          >
                            Reset to pending
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={vendor.isActive ? "text-green-700" : "text-neutral-400"}>
                        {vendor.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        variant={vendor.isActive ? "danger" : "secondary"}
                        onClick={() => handleToggleActive(vendor)}
                        isLoading={busyVendorId === vendor.id}
                      >
                        {vendor.isActive ? "Deactivate" : "Activate"}
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
