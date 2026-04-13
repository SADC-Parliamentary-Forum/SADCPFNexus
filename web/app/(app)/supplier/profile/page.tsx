"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supplierCategoriesApi, supplierPortalApi } from "@/lib/api";

export default function SupplierProfilePage() {
  const queryClient = useQueryClient();
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [website, setWebsite] = useState("");
  const [address, setAddress] = useState("");
  const [country, setCountry] = useState("");
  const [bankName, setBankName] = useState("");
  const [bankAccount, setBankAccount] = useState("");
  const [bankBranch, setBankBranch] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("");
  const [categoryIds, setCategoryIds] = useState<number[]>([]);
  const [documents, setDocuments] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);

  const profileQuery = useQuery({
    queryKey: ["supplier-profile"],
    queryFn: () => supplierPortalApi.me().then((response) => response.data.data),
  });
  const categoriesQuery = useQuery({
    queryKey: ["supplier-categories"],
    queryFn: () => supplierCategoriesApi.list().then((response) => response.data.data),
  });

  useEffect(() => {
    if (!profileQuery.data) return;
    const vendor = profileQuery.data;
    setContactName(vendor.contact_name ?? "");
    setContactPhone(vendor.contact_phone ?? "");
    setWebsite(vendor.website ?? "");
    setAddress(vendor.address ?? "");
    setCountry(vendor.country ?? "");
    setBankName(vendor.bank_name ?? "");
    setBankAccount(vendor.bank_account ?? "");
    setBankBranch(vendor.bank_branch ?? "");
    setPaymentTerms(vendor.payment_terms ?? "");
    setCategoryIds((vendor.categories ?? []).map((category) => category.id));
  }, [profileQuery.data]);

  const mutation = useMutation({
    mutationFn: () => {
      const formData = new FormData();
      formData.append("contact_name", contactName);
      formData.append("contact_phone", contactPhone);
      formData.append("website", website);
      formData.append("address", address);
      formData.append("country", country);
      formData.append("bank_name", bankName);
      formData.append("bank_account", bankAccount);
      formData.append("bank_branch", bankBranch);
      formData.append("payment_terms", paymentTerms);
      categoryIds.forEach((id) => formData.append("category_ids[]", String(id)));
      documents.forEach((file) => formData.append("documents[]", file));
      return supplierPortalApi.updateProfile(formData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["supplier-profile"] });
      queryClient.invalidateQueries({ queryKey: ["supplier-dashboard"] });
      setDocuments([]);
      setError(null);
    },
    onError: (err: unknown) =>
      setError((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Failed to update supplier profile."),
  });

  if (profileQuery.isLoading || categoriesQuery.isLoading) return <div className="card p-6">Loading supplier profile...</div>;
  if (profileQuery.isError || categoriesQuery.isError || !profileQuery.data) return <div className="card p-6">Failed to load supplier profile.</div>;

  return (
    <div className="max-w-4xl space-y-5">
      <div>
        <h1 className="page-title">Supplier Profile</h1>
        <p className="page-subtitle">{profileQuery.data.name}</p>
      </div>

      <div className="card p-5 space-y-4">
        {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        {profileQuery.data.last_info_request_reason && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
            {profileQuery.data.last_info_request_reason}
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <input className="form-input" placeholder="Contact name" value={contactName} onChange={(e) => setContactName(e.target.value)} />
          <input className="form-input" placeholder="Contact phone" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} />
          <input className="form-input" placeholder="Website" value={website} onChange={(e) => setWebsite(e.target.value)} />
          <input className="form-input" placeholder="Country" value={country} onChange={(e) => setCountry(e.target.value)} />
          <input className="form-input md:col-span-2" placeholder="Address" value={address} onChange={(e) => setAddress(e.target.value)} />
          <input className="form-input" placeholder="Bank name" value={bankName} onChange={(e) => setBankName(e.target.value)} />
          <input className="form-input" placeholder="Payment terms" value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} />
          <input className="form-input" placeholder="Bank account" value={bankAccount} onChange={(e) => setBankAccount(e.target.value)} />
          <input className="form-input" placeholder="Bank branch or SWIFT" value={bankBranch} onChange={(e) => setBankBranch(e.target.value)} />
        </div>

        <div className="space-y-2">
          <p className="text-sm font-semibold text-neutral-700">Requested Categories</p>
          <div className="grid gap-2 md:grid-cols-2">
            {(categoriesQuery.data ?? []).map((category) => (
              <label key={category.id} className={`rounded-xl border p-3 text-sm ${categoryIds.includes(category.id) ? "border-primary bg-primary/5" : "border-neutral-200"}`}>
                <input
                  type="checkbox"
                  className="mr-2"
                  checked={categoryIds.includes(category.id)}
                  onChange={() =>
                    setCategoryIds((current) =>
                      current.includes(category.id)
                        ? current.filter((id) => id !== category.id)
                        : current.length >= 3 ? current : [...current, category.id]
                    )
                  }
                />
                {category.name}
              </label>
            ))}
          </div>
          <p className="text-xs text-neutral-500">Changing categories triggers procurement review and may temporarily suspend portal access.</p>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-semibold text-neutral-700">Supporting Documents</p>
          <input type="file" multiple onChange={(e) => setDocuments(Array.from(e.target.files ?? []))} />
          {documents.length > 0 && <p className="text-xs text-neutral-500">{documents.length} file(s) ready to upload.</p>}
        </div>

        <button className="btn-primary disabled:opacity-60" disabled={mutation.isPending || categoryIds.length === 0} onClick={() => mutation.mutate()}>
          {mutation.isPending ? "Saving..." : "Update Profile"}
        </button>
      </div>
    </div>
  );
}
