"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supplierPortalApi } from "@/lib/api";
import { apiErrorMessage } from "@/lib/apiError";
import { useI18n } from "@/lib/i18n/LocaleProvider";
import { useToast } from "@/components/ui/Toast";

export default function SupplierProfilePage() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const toast = useToast();
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
  const [error, setError] = useState<string | null>(null);

  const profileQuery = useQuery({
    queryKey: ["supplier-profile"],
    queryFn: () => supplierPortalApi.me().then((response) => response.data.data),
  });
  const categoriesQuery = useQuery({
    queryKey: ["supplier-categories"],
    queryFn: () => supplierPortalApi.categories().then((response) => response.data.data),
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
      return supplierPortalApi.updateProfile(formData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["supplier-profile"] });
      queryClient.invalidateQueries({ queryKey: ["supplier-dashboard"] });
      setError(null);
      toast.success(t("supplier.profile.saved"));
    },
    onError: (err: unknown) => {
      const message = apiErrorMessage(err, t("supplier.profile.saveError"));
      setError(message);
      toast.error(t("supplier.profile.notSaved"), message);
    },
  });

  if (profileQuery.isLoading) return <div className="card p-6">{t("supplier.profile.loading")}</div>;
  if (profileQuery.isError || !profileQuery.data) {
    return (
      <div className="card p-6" data-testid="supplier-profile-error">
        {apiErrorMessage(profileQuery.error, t("supplier.profile.loadError"))}
      </div>
    );
  }

  return (
    <div className="w-full min-w-0 space-y-5">
      <ModulePageHeader
        title="supplier.profile.title"
        breadcrumbs={<PageBreadcrumbs items={[{ label: "supplier.profile.title" }]} />}
      />

      <div className="card p-5 space-y-4">
        {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        {categoriesQuery.isError && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
            {apiErrorMessage(categoriesQuery.error, t("supplier.profile.categoriesError"))}
          </div>
        )}
        {profileQuery.data.last_info_request_reason && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
            {profileQuery.data.last_info_request_reason}
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label htmlFor="supplier-contact-name" className="mb-1 block text-xs font-semibold text-neutral-600">{t("supplier.register.contactName")}</label>
            <input id="supplier-contact-name" className="form-input w-full" placeholder={t("supplier.register.contactName")} value={contactName} onChange={(e) => setContactName(e.target.value)} />
          </div>
          <div>
            <label htmlFor="supplier-contact-phone" className="mb-1 block text-xs font-semibold text-neutral-600">{t("supplier.register.contactPhone")}</label>
            <input id="supplier-contact-phone" className="form-input w-full" placeholder={t("supplier.register.contactPhone")} value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} />
          </div>
          <div>
            <label htmlFor="supplier-website" className="mb-1 block text-xs font-semibold text-neutral-600">{t("supplier.profile.website")}</label>
            <input id="supplier-website" className="form-input w-full" placeholder={t("supplier.profile.website")} value={website} onChange={(e) => setWebsite(e.target.value)} />
          </div>
          <div>
            <label htmlFor="supplier-country" className="mb-1 block text-xs font-semibold text-neutral-600">{t("supplier.profile.country")}</label>
            <input id="supplier-country" className="form-input w-full" placeholder={t("supplier.profile.country")} value={country} onChange={(e) => setCountry(e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <label htmlFor="supplier-address" className="mb-1 block text-xs font-semibold text-neutral-600">{t("supplier.profile.address")}</label>
            <input id="supplier-address" className="form-input w-full" placeholder={t("supplier.profile.address")} value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>
          <div>
            <label htmlFor="supplier-bank-name" className="mb-1 block text-xs font-semibold text-neutral-600">{t("supplier.register.bankName")}</label>
            <input id="supplier-bank-name" className="form-input w-full" placeholder={t("supplier.register.bankName")} value={bankName} onChange={(e) => setBankName(e.target.value)} />
          </div>
          <div>
            <label htmlFor="supplier-payment-terms" className="mb-1 block text-xs font-semibold text-neutral-600">{t("supplier.profile.paymentTerms")}</label>
            <input id="supplier-payment-terms" className="form-input w-full" placeholder={t("supplier.profile.paymentTerms")} value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} />
          </div>
          <div>
            <label htmlFor="supplier-bank-account" className="mb-1 block text-xs font-semibold text-neutral-600">{t("supplier.register.bankAccount")}</label>
            <input id="supplier-bank-account" className="form-input w-full" placeholder={t("supplier.register.bankAccount")} value={bankAccount} onChange={(e) => setBankAccount(e.target.value)} />
          </div>
          <div>
            <label htmlFor="supplier-bank-branch" className="mb-1 block text-xs font-semibold text-neutral-600">{t("supplier.profile.bankBranch")}</label>
            <input id="supplier-bank-branch" className="form-input w-full" placeholder={t("supplier.profile.bankBranch")} value={bankBranch} onChange={(e) => setBankBranch(e.target.value)} />
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-semibold text-neutral-700">{t("supplier.profile.requestedCategories")}</p>
          <div className="grid gap-2 md:grid-cols-2">
            {(categoriesQuery.data ?? []).map((category) => (
              <label key={category.id} className={`rounded-xl border p-3 text-sm ${categoryIds.includes(category.id) ? "border-primary bg-primary/5" : "border-neutral-200"}`}>
                <input
                  type="checkbox"
                  className="mr-2"
                  checked={categoryIds.includes(category.id)}
                  onChange={() =>
                    setCategoryIds((current) => {
                      if (current.includes(category.id)) {
                        return current.filter((id) => id !== category.id);
                      }
                      return [...current, category.id];
                    })
                  }
                />
                {category.name}
              </label>
            ))}
          </div>
          <p className="text-xs text-neutral-500">{t("supplier.register.categoriesHint")}</p>
        </div>

        <p className="text-sm text-neutral-600">
          <Link href="/supplier/documents" className="font-medium text-primary-800 hover:opacity-80">
            {t("supplier.documents.manage")}
          </Link>
        </p>

        <button className="btn-primary disabled:opacity-60" disabled={mutation.isPending || categoryIds.length === 0} onClick={() => mutation.mutate()}>
          {mutation.isPending ? t("admin.common.savingDots") : t("supplier.profile.update")}
        </button>
      </div>

      <WizardDeclarations
        vendorStatus={profileQuery.data.status}
        emailVerified={profileQuery.data.email_verified === true}
      />
    </div>
  );
}

function WizardDeclarations({ vendorStatus, emailVerified }: { vendorStatus?: string; emailVerified: boolean }) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const toast = useToast();
  const declarationsQuery = useQuery({
    queryKey: ["supplier-declarations"],
    queryFn: () => supplierPortalApi.declarations().then((r) => r.data.data),
  });
  const completenessQuery = useQuery({
    queryKey: ["supplier-completeness"],
    queryFn: () => supplierPortalApi.completeness().then((r) => r.data.data),
  });
  const acceptMutation = useMutation({
    mutationFn: (ids: number[]) => supplierPortalApi.acceptDeclarations(ids),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["supplier-declarations"] });
      queryClient.invalidateQueries({ queryKey: ["supplier-completeness"] });
      queryClient.invalidateQueries({ queryKey: ["supplier-dashboard"] });
      toast.success(t("supplier.profile.declarationsAccepted"));
    },
    onError: (err: unknown) => {
      toast.error(t("supplier.profile.declarationsNotAccepted"), apiErrorMessage(err, t("supplier.profile.declarationsError")));
    },
  });
  const submitMutation = useMutation({
    mutationFn: () => supplierPortalApi.submitApplication(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["supplier-profile"] });
      queryClient.invalidateQueries({ queryKey: ["supplier-completeness"] });
      queryClient.invalidateQueries({ queryKey: ["supplier-dashboard"] });
      toast.success(t("supplier.dashboard.submitted"));
    },
    onError: (err: unknown) => {
      toast.error(t("supplier.dashboard.notSubmitted"), apiErrorMessage(err, t("supplier.dashboard.submitError")));
    },
  });
  const resendMutation = useMutation({
    mutationFn: () => supplierPortalApi.resendVerification(),
    onSuccess: () => toast.success(t("supplier.profile.verificationSent")),
    onError: (err: unknown) => {
      toast.error(t("supplier.profile.verificationNotSent"), apiErrorMessage(err, t("supplier.profile.verificationError")));
    },
  });

  const pending = (declarationsQuery.data ?? []).filter((row) => !row.accepted).map((row) => row.id);
  const canSubmit = completenessQuery.data?.completeness.can_submit === true;

  return (
    <div className="card p-5 space-y-4" data-testid="supplier-wizard-review">
      <h2 className="text-sm font-bold text-neutral-800">{t("supplier.profile.declarationsTitle")}</h2>
      <p className="text-sm text-neutral-500">
        {t("supplier.profile.summary", {
          percent: completenessQuery.data?.completeness.percent ?? 0,
          status: (vendorStatus ?? "draft").replace(/_/g, " "),
        })}
      </p>
      {emailVerified === false && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {t("supplier.profile.verifyEmail")}
          <button type="button" className="font-semibold ml-2 hover:opacity-80" onClick={() => resendMutation.mutate()}>
            {t("supplier.profile.resendVerification")}
          </button>
        </div>
      )}
      <ul className="space-y-3">
        {(declarationsQuery.data ?? []).map((row) => (
          <li key={row.id} className="rounded-xl border border-neutral-200 p-3">
            <p className="text-sm font-semibold">{row.title}</p>
            <p className="mt-1 text-xs text-neutral-600">{row.body}</p>
            <p className="mt-2 text-xs">{row.accepted ? t("supplier.profile.accepted") : t("supplier.profile.notYetAccepted")}</p>
          </li>
        ))}
      </ul>
      {pending.length > 0 && (
        <button type="button" className="btn-secondary text-sm" onClick={() => acceptMutation.mutate(pending)} disabled={acceptMutation.isPending}>
          {t("supplier.profile.acceptDeclarations")}
        </button>
      )}
      <button
        type="button"
        data-testid="submit-application"
        className="btn-primary text-sm disabled:opacity-50"
        disabled={!canSubmit || submitMutation.isPending}
        onClick={() => submitMutation.mutate()}
      >
        {canSubmit ? t("supplier.profile.submitApplication") : t("supplier.profile.submitIncomplete")}
      </button>
    </div>
  );
}
