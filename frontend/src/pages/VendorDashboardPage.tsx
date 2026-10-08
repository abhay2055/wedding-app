import { FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Card } from "../components/Card";
import { Input } from "../components/Input";
import { Button } from "../components/Button";
import { Tabs } from "../components/Tabs";
import { VerificationBadge } from "../components/VerificationBadge";
import { VendorAvailabilityManager } from "../components/VendorAvailabilityManager";
import { ErrorMessage, extractErrorMessage } from "../components/ErrorMessage";
import { EmptyState } from "../components/EmptyState";
import { LoadingState } from "../components/LoadingState";
import { useCategories } from "../hooks/useCategories";
import * as vendorApi from "../api/vendor";
import * as portfolioApi from "../api/portfolio";
import * as packagesApi from "../api/packages";
import * as bookingsApi from "../api/bookings";
import { PackageItem as PackageItemModel, PortfolioItem, Vendor, VendorPackage } from "../types/api";
import { formatInr } from "../utils/format";

const PROFILE_FIELDS = ["businessName", "city", "categoryId", "description", "startingPrice"] as const;

function profileCompletion(vendor: Vendor): number {
  const filled = PROFILE_FIELDS.filter((f) => {
    const value = vendor[f as keyof Vendor];
    return value !== null && value !== undefined && value !== "";
  }).length;
  return Math.round((filled / PROFILE_FIELDS.length) * 100);
}

function BookingsSummaryCard() {
  const [pendingCount, setPendingCount] = useState<number | null>(null);

  useEffect(() => {
    bookingsApi
      .listVendorBookings({ status: "PENDING", limit: 1 })
      .then((res) => setPendingCount(res.pagination.total))
      .catch(() => setPendingCount(null));
  }, []);

  return (
    <Card>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-neutral-500">Booking requests</p>
          <p className="font-medium text-neutral-900">
            {pendingCount === null ? "-" : `${pendingCount} pending request${pendingCount === 1 ? "" : "s"}`}
          </p>
        </div>
        <Link to="/vendor/bookings">
          <Button variant="secondary">View bookings</Button>
        </Link>
      </div>
    </Card>
  );
}

function OverviewTab({ vendor, portfolioCount, packageCount }: { vendor: Vendor; portfolioCount: number; packageCount: number }) {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <p className="text-xs uppercase text-neutral-500">Profile completion</p>
          <p className="mt-1 text-lg font-semibold text-neutral-900">{profileCompletion(vendor)}%</p>
        </Card>
        <Card>
          <p className="text-xs uppercase text-neutral-500">Verification</p>
          <div className="mt-1"><VerificationBadge status={vendor.verificationStatus} /></div>
        </Card>
        <Card>
          <p className="text-xs uppercase text-neutral-500">Portfolio items</p>
          <p className="mt-1 text-lg font-semibold text-neutral-900">{portfolioCount}</p>
        </Card>
        <Card>
          <p className="text-xs uppercase text-neutral-500">Packages</p>
          <p className="mt-1 text-lg font-semibold text-neutral-900">{packageCount}</p>
        </Card>
      </div>
      <Card>
        <p className="text-sm text-neutral-500">Category</p>
        <p className="font-medium text-neutral-900">{vendor.category?.name ?? "Not set"}</p>
        <p className="mt-3 text-sm text-neutral-500">City</p>
        <p className="font-medium text-neutral-900">{vendor.city}</p>
      </Card>
      <BookingsSummaryCard />
    </div>
  );
}

function ProfileTab({ vendor, onSaved }: { vendor: Vendor; onSaved: (v: Vendor) => void }) {
  const { categories } = useCategories();
  const [businessName, setBusinessName] = useState(vendor.businessName);
  const [description, setDescription] = useState(vendor.description ?? "");
  const [city, setCity] = useState(vendor.city);
  const [locality, setLocality] = useState(vendor.locality ?? "");
  const [address, setAddress] = useState(vendor.address ?? "");
  const [phone, setPhone] = useState(vendor.phone ?? "");
  const [email, setEmail] = useState(vendor.email ?? "");
  const [categoryId, setCategoryId] = useState(vendor.categoryId ?? "");
  const [startingPrice, setStartingPrice] = useState(vendor.startingPrice?.toString() ?? "");
  const [yearsExperience, setYearsExperience] = useState(vendor.yearsExperience?.toString() ?? "");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setIsSaving(true);
    try {
      const saved = await vendorApi.updateMyVendorProfile({
        businessName,
        description: description || undefined,
        city,
        locality: locality || undefined,
        address: address || undefined,
        phone: phone || undefined,
        email: email || undefined,
        categoryId: categoryId || undefined,
        startingPrice: startingPrice ? Number(startingPrice) : undefined,
        yearsExperience: yearsExperience ? Number(yearsExperience) : undefined,
      });
      onSaved(saved);
      setSuccess(true);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Card>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {error && <ErrorMessage message={error} />}
        {success && (
          <p className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
            Profile updated.
          </p>
        )}
        <Input label="Business name" required value={businessName} onChange={(e) => setBusinessName(e.target.value)} />
        <Input label="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
        <div className="grid grid-cols-2 gap-4">
          <Input label="City" required value={city} onChange={(e) => setCity(e.target.value)} />
          <Input label="Locality" value={locality} onChange={(e) => setLocality(e.target.value)} />
        </div>
        <Input label="Address" value={address} onChange={(e) => setAddress(e.target.value)} />
        <div className="grid grid-cols-2 gap-4">
          <Input label="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="vendor-category" className="text-sm font-medium text-neutral-700">Category</label>
          <select
            id="vendor-category"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
          >
            <option value="">Select a category</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Input label="Starting price (₹)" type="number" min={0} value={startingPrice} onChange={(e) => setStartingPrice(e.target.value)} />
          <Input label="Years of experience" type="number" min={0} value={yearsExperience} onChange={(e) => setYearsExperience(e.target.value)} />
        </div>
        <p className="text-xs text-neutral-500">
          Verification status ({vendor.verificationStatus}) is set by VivahSetu admins and can&apos;t be changed here.
        </p>
        <Button type="submit" isLoading={isSaving}>
          Save changes
        </Button>
      </form>
    </Card>
  );
}

function PortfolioTab({ items, onChange }: { items: PortfolioItem[]; onChange: (items: PortfolioItem[]) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleImageUpload(e: FormEvent) {
    e.preventDefault();
    if (!file) return;
    setError(null);
    setIsUploading(true);
    try {
      const item = await portfolioApi.addImagePortfolioItem(file, title || undefined);
      onChange([...items, item]);
      setFile(null);
      setTitle("");
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setIsUploading(false);
    }
  }

  async function handleVideoAdd(e: FormEvent) {
    e.preventDefault();
    if (!videoUrl) return;
    setError(null);
    setIsUploading(true);
    try {
      const item = await portfolioApi.addVideoPortfolioItem(videoUrl, title || undefined);
      onChange([...items, item]);
      setVideoUrl("");
      setTitle("");
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setIsUploading(false);
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      await portfolioApi.deletePortfolioItem(id);
      onChange(items.filter((i) => i.id !== id));
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <h3 className="mb-3 font-medium">Add a photo</h3>
        <form onSubmit={handleImageUpload} className="flex flex-col gap-3">
          {error && <ErrorMessage message={error} />}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="text-sm"
          />
          <Input label="Title (optional)" value={title} onChange={(e) => setTitle(e.target.value)} />
          <Button type="submit" disabled={!file} isLoading={isUploading}>
            Upload photo
          </Button>
        </form>
        <div className="my-4 border-t border-neutral-100" />
        <h3 className="mb-3 font-medium">Add a video (by URL)</h3>
        <form onSubmit={handleVideoAdd} className="flex flex-col gap-3">
          <Input label="Video URL" type="url" value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder="https://..." />
          <Button type="submit" variant="secondary" disabled={!videoUrl} isLoading={isUploading}>
            Add video
          </Button>
        </form>
      </Card>

      {items.length === 0 ? (
        <EmptyState title="No portfolio items yet." description="Add photos or a video showreel above." />
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {items.map((item) => (
            <div key={item.id} className="relative overflow-hidden rounded-md border border-neutral-200">
              {item.type === "IMAGE" ? (
                <img src={item.thumbnailUrl ?? item.url} alt={item.title ?? ""} className="aspect-square w-full object-cover" />
              ) : (
                <div className="flex aspect-square w-full flex-col items-center justify-center bg-neutral-900 text-white">
                  <span>▶</span>
                  <span className="mt-1 px-2 text-center text-xs">{item.title ?? "Video"}</span>
                </div>
              )}
              <button
                onClick={() => handleDelete(item.id)}
                disabled={deletingId === item.id}
                className="absolute right-1 top-1 rounded-full bg-black/60 px-2 py-0.5 text-xs text-white hover:bg-black/80 disabled:opacity-50"
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PackageForm({ onCreated }: { onCreated: (pkg: VendorPackage) => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [advancePercentage, setAdvancePercentage] = useState("20");
  const [itemNames, setItemNames] = useState<string[]>([""]);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  function updateItem(i: number, value: string) {
    setItemNames((prev) => prev.map((v, idx) => (idx === i ? value : v)));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSaving(true);
    try {
      const items = itemNames.filter((n) => n.trim()).map((n, i) => ({ name: n.trim(), sortOrder: i }));
      const pkg = await packagesApi.createPackage({
        name,
        description: description || undefined,
        price: Number(price),
        advancePercentage: advancePercentage ? Number(advancePercentage) : undefined,
        items: items.length > 0 ? items : undefined,
      });
      onCreated(pkg);
      setName("");
      setDescription("");
      setPrice("");
      setAdvancePercentage("20");
      setItemNames([""]);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Card>
      <h3 className="mb-3 font-medium">Create a package</h3>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        {error && <ErrorMessage message={error} />}
        <Input label="Package name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Premium Photography" />
        <Input label="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
        <Input label="Price (₹)" type="number" min={0} required value={price} onChange={(e) => setPrice(e.target.value)} />
        <Input
          label="Advance required (%)"
          type="number"
          min={0}
          max={100}
          value={advancePercentage}
          onChange={(e) => setAdvancePercentage(e.target.value)}
        />
        <div>
          <p className="mb-1 text-sm font-medium text-neutral-700">What&apos;s included</p>
          {itemNames.map((value, i) => (
            <input
              key={i}
              value={value}
              onChange={(e) => updateItem(i, e.target.value)}
              placeholder={`Item ${i + 1}, e.g. 2 photographers`}
              className="mb-2 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
            />
          ))}
          <button
            type="button"
            onClick={() => setItemNames((prev) => [...prev, ""])}
            className="text-sm text-brand-700 hover:underline"
          >
            + Add another item
          </button>
        </div>
        <Button type="submit" isLoading={isSaving}>
          Create package
        </Button>
      </form>
    </Card>
  );
}

function PackagesTab({ packages, onChange }: { packages: VendorPackage[]; onChange: (packages: VendorPackage[]) => void }) {
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      await packagesApi.deletePackage(id);
      onChange(packages.filter((p) => p.id !== id));
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PackageForm onCreated={(pkg) => onChange([...packages, pkg])} />
      {packages.length === 0 ? (
        <EmptyState title="No packages yet." description="Create your first package above." />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {packages.map((pkg) => (
            <Card key={pkg.id}>
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="font-semibold text-neutral-900">{pkg.name}</h4>
                  <p className="text-brand-700 font-medium">{formatInr(pkg.price)}</p>
                  <p className="text-xs text-neutral-500">{pkg.advancePercentage}% advance required</p>
                </div>
                <button
                  onClick={() => handleDelete(pkg.id)}
                  disabled={deletingId === pkg.id}
                  className="text-sm text-red-600 hover:underline disabled:opacity-50"
                >
                  Delete
                </button>
              </div>
              {pkg.items.length > 0 && (
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-neutral-700">
                  {pkg.items.map((item: PackageItemModel) => (
                    <li key={item.id}>{item.name}</li>
                  ))}
                </ul>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function CreateProfileForm({ onCreated }: { onCreated: (v: Vendor) => void }) {
  const { categories } = useCategories();
  const [businessName, setBusinessName] = useState("");
  const [city, setCity] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSaving(true);
    try {
      const vendor = await vendorApi.createMyVendorProfile({
        businessName,
        city,
        categoryId: categoryId || undefined,
      });
      onCreated(vendor);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Card>
      <p className="mb-4 text-sm text-neutral-600">
        You don&apos;t have a business profile yet. Create one to start appearing in the marketplace.
      </p>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {error && <ErrorMessage message={error} />}
        <Input label="Business name" required value={businessName} onChange={(e) => setBusinessName(e.target.value)} />
        <Input label="City" required placeholder="e.g. Mumbai, Delhi, Jalandhar" value={city} onChange={(e) => setCity(e.target.value)} />
        <div className="flex flex-col gap-1">
          <label htmlFor="new-vendor-category" className="text-sm font-medium text-neutral-700">Category</label>
          <select
            id="new-vendor-category"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
          >
            <option value="">Select a category</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <Button type="submit" isLoading={isSaving}>
          Create profile
        </Button>
      </form>
    </Card>
  );
}

export function VendorDashboardPage() {
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [portfolio, setPortfolio] = useState<PortfolioItem[]>([]);
  const [packages, setPackages] = useState<VendorPackage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState("overview");

  useEffect(() => {
    vendorApi
      .getMyVendorProfile()
      .then(async (v) => {
        setVendor(v);
        const [p, pkgs] = await Promise.all([portfolioApi.listMyPortfolio(), packagesApi.listMyPackages()]);
        setPortfolio(p);
        setPackages(pkgs);
      })
      .catch((err) => {
        if (err?.response?.status === 404) setNotFound(true);
        else setError(extractErrorMessage(err));
      })
      .finally(() => setIsLoading(false));
  }, []);

  if (isLoading) return <LoadingState label="Loading your vendor dashboard..." />;

  if (notFound || !vendor) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <h1 className="mb-6 text-2xl font-semibold text-brand-800">Vendor business profile</h1>
        <CreateProfileForm onCreated={(v) => { setVendor(v); setNotFound(false); }} />
      </div>
    );
  }

  if (error) {
    return <div className="mx-auto max-w-2xl px-4 py-12"><ErrorMessage message={error} /></div>;
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-brand-800">{vendor.businessName}</h1>
        <a href={`/vendors/${vendor.slug}`} target="_blank" rel="noreferrer" className="text-sm text-brand-700 hover:underline">
          View public profile ↗
        </a>
      </div>

      <div className="mb-6">
        <Tabs
          tabs={[
            { key: "overview", label: "Overview" },
            { key: "profile", label: "Profile" },
            { key: "portfolio", label: "Portfolio" },
            { key: "packages", label: "Packages" },
            { key: "availability", label: "Availability" },
          ]}
          active={tab}
          onChange={setTab}
        />
      </div>

      {tab === "overview" && <OverviewTab vendor={vendor} portfolioCount={portfolio.length} packageCount={packages.length} />}
      {tab === "profile" && <ProfileTab vendor={vendor} onSaved={setVendor} />}
      {tab === "portfolio" && <PortfolioTab items={portfolio} onChange={setPortfolio} />}
      {tab === "packages" && <PackagesTab packages={packages} onChange={setPackages} />}
      {tab === "availability" && <VendorAvailabilityManager />}
    </div>
  );
}
