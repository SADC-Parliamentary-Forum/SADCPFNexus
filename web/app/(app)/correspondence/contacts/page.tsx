"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { useState, useEffect, useCallback } from "react";
import { correspondenceApi, type CorrespondenceContact, type ContactGroup } from "@/lib/api";
import { getStoredUser, hasPermission, isSystemAdmin } from "@/lib/auth";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { EmptyState, TableEmpty } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import { apiErrorMessage } from "@/lib/apiError";
import { useI18n } from "@/lib/i18n/LocaleProvider";

type Tab = "contacts" | "groups";

const stakeholderLabel: Record<string, string> = {
  member_parliament: "correspondence.contacts.type.parliament", ministry: "correspondence.contacts.type.ministry", ngo: "correspondence.contacts.type.ngo",
  donor: "correspondence.contacts.type.donor", private_sector: "correspondence.contacts.type.privateSector", other: "correspondence.channel.other",
};

const EMPTY_CONTACT = {
  full_name: "", organization: "", country: "", email: "",
  phone: "", stakeholder_type: "other", tags: "",
};

export default function CorrespondenceContactsPage() {
  const { confirm } = useConfirm();
  const toast = useToast();
  const { t } = useI18n();
  const [tab, setTab] = useState<Tab>("contacts");
  const [contacts, setContacts] = useState<CorrespondenceContact[]>([]);
  const [groups, setGroups] = useState<ContactGroup[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [slideOver, setSlideOver] = useState<{ type: "contact" | "group"; item?: CorrespondenceContact | ContactGroup } | null>(null);
  const [form, setForm] = useState({ ...EMPTY_CONTACT });
  const [groupForm, setGroupForm] = useState({ name: "", description: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(() => {
    setLoading(true);
    const params: Record<string, string | number> = { per_page: 200 };
    if (search) params.search = search;
    Promise.all([
      correspondenceApi.listContacts(params),
      correspondenceApi.listGroups(),
    ])
      .then(([cRes, gRes]) => {
        setContacts(cRes.data.data ?? []);
        setGroups(gRes.data.data ?? []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [search]);

  useEffect(() => { loadData(); }, [loadData]);

  function openContactSlideOver(contact?: CorrespondenceContact) {
    setForm(contact ? {
      full_name: contact.full_name, organization: contact.organization ?? "",
      country: contact.country ?? "", email: contact.email,
      phone: contact.phone ?? "", stakeholder_type: contact.stakeholder_type,
      tags: (contact.tags ?? []).join(", "),
    } : { ...EMPTY_CONTACT });
    setSlideOver({ type: "contact", item: contact });
    setError(null);
  }

  function openGroupSlideOver(group?: ContactGroup) {
    setGroupForm(group ? { name: group.name, description: group.description ?? "" } : { name: "", description: "" });
    setSlideOver({ type: "group", item: group });
    setError(null);
  }

  async function saveContact() {
    if (!form.full_name.trim() || !form.email.trim()) {
      setError(t("correspondence.contacts.nameEmailRequired"));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const data = {
        full_name: form.full_name,
        organization: form.organization || undefined,
        country: form.country || undefined,
        email: form.email,
        phone: form.phone || undefined,
        stakeholder_type: form.stakeholder_type,
        tags: form.tags ? form.tags.split(",").map((tag) => tag.trim()).filter(Boolean) : [],
      };
      const existing = slideOver?.item as CorrespondenceContact | undefined;
      if (existing?.id) {
        await correspondenceApi.updateContact(existing.id, data);
      } else {
        await correspondenceApi.createContact(data);
      }
      toast.success(existing?.id ? t("correspondence.contacts.contactUpdated") : t("correspondence.contacts.contactCreated"));
      setSlideOver(null);
      loadData();
    } catch (err) {
      setError(t("correspondence.contacts.contactSaveFailed"));
      toast.error(t("correspondence.contacts.contactNotSaved"), apiErrorMessage(err, t("correspondence.contacts.contactSaveFailed")));
    } finally {
      setSaving(false);
    }
  }

  async function deleteContact(id: number) {
    if (
      !(await confirm({
        title: t("correspondence.contacts.deleteContactTitle"),
        message: t("correspondence.contacts.deleteContactMessage"),
        variant: "danger",
      }))
    ) return;
    try {
      await correspondenceApi.deleteContact(id);
      toast.success(t("correspondence.contacts.contactDeleted"));
      loadData();
    } catch (err) {
      setError(t("correspondence.contacts.contactDeleteFailed"));
      toast.error(t("correspondence.contacts.contactNotDeleted"), apiErrorMessage(err, t("correspondence.contacts.contactDeleteFailed")));
    }
  }

  async function saveGroup() {
    if (!groupForm.name.trim()) { setError(t("correspondence.contacts.groupNameRequired")); return; }
    setSaving(true);
    setError(null);
    try {
      const existing = slideOver?.item as ContactGroup | undefined;
      if (existing?.id) {
        await correspondenceApi.updateGroup(existing.id, groupForm);
      } else {
        await correspondenceApi.createGroup(groupForm);
      }
      toast.success(existing?.id ? t("correspondence.contacts.groupUpdated") : t("correspondence.contacts.groupCreated"));
      setSlideOver(null);
      loadData();
    } catch (err) {
      setError(t("correspondence.contacts.groupSaveFailed"));
      toast.error(t("correspondence.contacts.groupNotSaved"), apiErrorMessage(err, t("correspondence.contacts.groupSaveFailed")));
    } finally {
      setSaving(false);
    }
  }

  async function deleteGroup(id: number) {
    if (
      !(await confirm({
        title: t("correspondence.contacts.deleteGroupTitle"),
        message: t("correspondence.contacts.deleteGroupMessage"),
        variant: "danger",
      }))
    ) return;
    try {
      await correspondenceApi.deleteGroup(id);
      toast.success(t("correspondence.contacts.groupDeleted"));
      loadData();
    } catch (err) {
      setError(t("correspondence.contacts.groupDeleteFailed"));
      toast.error(t("correspondence.contacts.groupNotDeleted"), apiErrorMessage(err, t("correspondence.contacts.groupDeleteFailed")));
    }
  }

  const currentUser = getStoredUser();
  const canAdmin = isSystemAdmin(currentUser) || hasPermission(currentUser, "correspondence.admin");

  return (
    <div className="w-full min-w-0 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <ModulePageHeader
        title={t("correspondence.contacts.title")}
        subtitle={t("correspondence.contacts.subtitle")}
        breadcrumbs={<PageBreadcrumbs items={[{ label: t("correspondence.contacts.title") }]} />}
      />
        {canAdmin && (
          <button
            onClick={() => tab === "contacts" ? openContactSlideOver() : openGroupSlideOver()}
            className="btn-primary inline-flex items-center gap-1.5 flex-shrink-0"
          >
            <span className="material-symbols-outlined text-[16px]">add</span>
            {tab === "contacts" ? t("correspondence.contacts.addContact") : t("correspondence.contacts.addGroup")}
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-neutral-200">
        {(["contacts", "groups"] as Tab[]).map((tb) => (
          <button
            key={tb}
            onClick={() => setTab(tb)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === tb
                ? "border-primary text-primary"
                : "border-transparent text-neutral-500 hover:text-neutral-700"
            }`}
          >
            {tb === "contacts" ? t("correspondence.contacts.tabContacts", { count: contacts.length }) : t("correspondence.contacts.tabGroups", { count: groups.length })}
          </button>
        ))}
      </div>

      {/* Search (contacts tab) */}
      {tab === "contacts" && (
        <div>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="form-input w-full max-w-sm"
            placeholder={t("correspondence.contacts.search")}
          />
        </div>
      )}

      {loading ? (
        <div className="py-8 text-center text-sm text-neutral-400">{t("common.loading")}</div>
      ) : tab === "contacts" ? (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t("correspondence.contacts.name")}</th>
                  <th>{t("correspondence.contacts.email")}</th>
                  <th>{t("correspondence.contacts.organization")}</th>
                  <th>{t("correspondence.col.type")}</th>
                  <th>{t("correspondence.contacts.country")}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {contacts.length > 0 ? contacts.map((c) => (
                  <tr key={c.id}>
                    <td className="font-medium text-neutral-900">{c.full_name}</td>
                    <td className="text-sm text-neutral-500">{c.email}</td>
                    <td className="text-sm text-neutral-500">{c.organization ?? "—"}</td>
                    <td><span className="text-xs text-neutral-500">{stakeholderLabel[c.stakeholder_type] ? t(stakeholderLabel[c.stakeholder_type]) : c.stakeholder_type}</span></td>
                    <td className="text-sm text-neutral-500">{c.country ?? "—"}</td>
                    <td>
                      {canAdmin && (
                        <div className="flex items-center gap-2">
                          <button type="button" onClick={() => openContactSlideOver(c)} className="btn-secondary text-xs py-1 px-2">{t("common.edit")}</button>
                          <button type="button" onClick={() => deleteContact(c.id)} className="btn-secondary text-xs py-1 px-2 text-red-600">{t("common.delete")}</button>
                        </div>
                      )}
                    </td>
                  </tr>
                )) : (
                  <TableEmpty
                    colSpan={6}
                    title={t("correspondence.contacts.emptyContacts")}
                    action={canAdmin ? (
                      <button type="button" onClick={() => openContactSlideOver()} className="btn-primary text-sm">{t("correspondence.contacts.addOne")}</button>
                    ) : undefined}
                  />
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {groups.length > 0 ? groups.map((g) => (
            <div key={g.id} className="card p-5 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-neutral-900">{g.name}</h3>
                  {g.description && <p className="text-xs text-neutral-400 mt-0.5">{g.description}</p>}
                </div>
                {canAdmin && (
                  <div className="flex gap-1 flex-shrink-0">
                    <button type="button" onClick={() => openGroupSlideOver(g)} className="btn-secondary text-xs py-1 px-2">{t("common.edit")}</button>
                    <button type="button" onClick={() => deleteGroup(g.id)} className="btn-secondary text-xs py-1 px-2 text-red-600">{t("common.delete")}</button>
                  </div>
                )}
              </div>
              <p className="text-xs text-neutral-500">
                {(g.contacts_count ?? 0) === 1 ? t("correspondence.contacts.memberOne") : t("correspondence.contacts.memberMany", { count: g.contacts_count ?? 0 })}
              </p>
            </div>
          )) : (
            <div className="col-span-3 card">
              <EmptyState
                icon="group"
                title={t("correspondence.contacts.emptyGroups")}
                action={canAdmin ? (
                  <button type="button" onClick={() => openGroupSlideOver()} className="btn-primary text-sm">{t("correspondence.contacts.createOne")}</button>
                ) : undefined}
              />
            </div>
          )}
        </div>
      )}

      {/* Slide-over */}
      {slideOver && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setSlideOver(null)} />
          <div className="relative z-10 w-full max-w-md bg-white shadow-2xl flex flex-col h-full">
            <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100">
              <h2 className="text-base font-semibold text-neutral-900">
                {slideOver.type === "contact"
                  ? (slideOver.item ? t("correspondence.contacts.editContact") : t("correspondence.contacts.addContact"))
                  : (slideOver.item ? t("correspondence.contacts.editGroup") : t("correspondence.contacts.addGroup"))}
              </h2>
              <button onClick={() => setSlideOver(null)} className="text-neutral-400 hover:text-neutral-600">
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {error && (
                <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">{error}</div>
              )}

              {slideOver.type === "contact" ? (
                <>
                  <div>
                    <label htmlFor="correspondence-contacts-full-name" className="block text-xs font-medium text-neutral-600 mb-1">{t("correspondence.contacts.fullNameRequired")}</label>
                    <input id="correspondence-contacts-full-name" value={form.full_name} onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))} className="form-input w-full" />
                  </div>
                  <div>
                    <label htmlFor="correspondence-contacts-email" className="block text-xs font-medium text-neutral-600 mb-1">{t("correspondence.contacts.emailRequired")}</label>
                    <input id="correspondence-contacts-email" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} className="form-input w-full" />
                  </div>
                  <div>
                    <label htmlFor="correspondence-contacts-organization" className="block text-xs font-medium text-neutral-600 mb-1">{t("correspondence.contacts.organization")}</label>
                    <input id="correspondence-contacts-organization" value={form.organization} onChange={(e) => setForm((f) => ({ ...f, organization: e.target.value }))} className="form-input w-full" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="correspondence-contacts-country" className="block text-xs font-medium text-neutral-600 mb-1">{t("correspondence.contacts.country")}</label>
                      <input id="correspondence-contacts-country" value={form.country} onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))} className="form-input w-full" placeholder={t("correspondence.contacts.countryPlaceholder")} maxLength={4} />
                    </div>
                    <div>
                      <label htmlFor="correspondence-contacts-phone" className="block text-xs font-medium text-neutral-600 mb-1">{t("correspondence.contacts.phone")}</label>
                      <input id="correspondence-contacts-phone" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} className="form-input w-full" />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="correspondence-contacts-stakeholder-type" className="block text-xs font-medium text-neutral-600 mb-1">{t("correspondence.contacts.stakeholderType")}</label>
                    <select id="correspondence-contacts-stakeholder-type" value={form.stakeholder_type} onChange={(e) => setForm((f) => ({ ...f, stakeholder_type: e.target.value }))} className="form-input w-full">
                      <option value="member_parliament">{t("correspondence.contacts.opt.mp")}</option>
                      <option value="ministry">{t("correspondence.contacts.opt.ministry")}</option>
                      <option value="ngo">{t("correspondence.contacts.opt.ngo")}</option>
                      <option value="donor">{t("correspondence.contacts.opt.donor")}</option>
                      <option value="private_sector">{t("correspondence.contacts.type.privateSector")}</option>
                      <option value="other">{t("correspondence.channel.other")}</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="correspondence-contacts-tags-comma-separated" className="block text-xs font-medium text-neutral-600 mb-1">{t("correspondence.contacts.tags")} <span className="text-neutral-400 font-normal">{t("correspondence.contacts.commaSeparated")}</span></label>
                    <input id="correspondence-contacts-tags-comma-separated" value={form.tags} onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))} className="form-input w-full" placeholder={t("correspondence.contacts.tagsPlaceholder")} />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label htmlFor="correspondence-contacts-group-name" className="block text-xs font-medium text-neutral-600 mb-1">{t("correspondence.contacts.groupNameLabel")}</label>
                    <input id="correspondence-contacts-group-name" value={groupForm.name} onChange={(e) => setGroupForm((f) => ({ ...f, name: e.target.value }))} className="form-input w-full" placeholder={t("correspondence.contacts.groupPlaceholder")} />
                  </div>
                  <div>
                    <label htmlFor="correspondence-contacts-description" className="block text-xs font-medium text-neutral-600 mb-1">{t("correspondence.contacts.description")}</label>
                    <textarea id="correspondence-contacts-description" value={groupForm.description} onChange={(e) => setGroupForm((f) => ({ ...f, description: e.target.value }))} rows={3} className="form-input w-full resize-none" />
                  </div>
                </>
              )}
            </div>

            <div className="px-6 py-4 border-t border-neutral-100 flex justify-end gap-3">
              <button onClick={() => setSlideOver(null)} className="btn-secondary">{t("common.cancel")}</button>
              <button
                disabled={saving}
                onClick={slideOver.type === "contact" ? saveContact : saveGroup}
                className="btn-primary"
              >
                {saving ? t("correspondence.saving") : t("common.save")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
