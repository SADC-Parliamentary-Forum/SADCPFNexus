"use client";

import { useState, useEffect, useCallback } from "react";
import { correspondenceApi, type CorrespondenceContact, type ContactGroup } from "@/lib/api";
import { getStoredUser, hasPermission, isSystemAdmin } from "@/lib/auth";

type Tab = "contacts" | "groups";

const stakeholderLabel: Record<string, string> = {
  member_parliament: "Parliament", ministry: "Ministry", ngo: "NGO",
  donor: "Donor", private_sector: "Private Sector", other: "Other",
};

const EMPTY_CONTACT = {
  full_name: "", organization: "", country: "", email: "",
  phone: "", stakeholder_type: "other", tags: "",
};

export default function CorrespondenceContactsPage() {
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
      setError("Name and email are required.");
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
        tags: form.tags ? form.tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
      };
      const existing = slideOver?.item as CorrespondenceContact | undefined;
      if (existing?.id) {
        await correspondenceApi.updateContact(existing.id, data);
      } else {
        await correspondenceApi.createContact(data);
      }
      setSlideOver(null);
      loadData();
    } catch {
      setError("Failed to save contact.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteContact(id: number) {
    if (!confirm("Delete this contact?")) return;
    try {
      await correspondenceApi.deleteContact(id);
      loadData();
    } catch { setError("Failed to delete contact."); }
  }

  async function saveGroup() {
    if (!groupForm.name.trim()) { setError("Group name is required."); return; }
    setSaving(true);
    setError(null);
    try {
      const existing = slideOver?.item as ContactGroup | undefined;
      if (existing?.id) {
        await correspondenceApi.updateGroup(existing.id, groupForm);
      } else {
        await correspondenceApi.createGroup(groupForm);
      }
      setSlideOver(null);
      loadData();
    } catch {
      setError("Failed to save group.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteGroup(id: number) {
    if (!confirm("Delete this group?")) return;
    try {
      await correspondenceApi.deleteGroup(id);
      loadData();
    } catch { setError("Failed to delete group."); }
  }

  const currentUser = getStoredUser();
  const canAdmin = isSystemAdmin(currentUser) || hasPermission(currentUser, "correspondence.admin");

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="page-title">Contacts & Groups</h1>
          <p className="page-subtitle">Manage correspondence recipients and distribution groups.</p>
        </div>
        {canAdmin && (
          <button
            onClick={() => tab === "contacts" ? openContactSlideOver() : openGroupSlideOver()}
            className="btn-primary inline-flex items-center gap-1.5 flex-shrink-0"
          >
            <span className="material-symbols-outlined text-[16px]">add</span>
            {tab === "contacts" ? "Add Contact" : "Add Group"}
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-neutral-200">
        {(["contacts", "groups"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t
                ? "border-primary text-primary"
                : "border-transparent text-neutral-500 hover:text-neutral-700"
            }`}
          >
            {t === "contacts" ? `Contacts (${contacts.length})` : `Groups (${groups.length})`}
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
            placeholder="Search contacts by name or email…"
          />
        </div>
      )}

      {loading ? (
        <div className="py-8 text-center text-sm text-neutral-400">Loading…</div>
      ) : tab === "contacts" ? (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Organization</th>
                  <th>Type</th>
                  <th>Country</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {contacts.length > 0 ? contacts.map((c) => (
                  <tr key={c.id}>
                    <td className="font-medium text-neutral-900">{c.full_name}</td>
                    <td className="text-sm text-neutral-500">{c.email}</td>
                    <td className="text-sm text-neutral-500">{c.organization ?? "—"}</td>
                    <td><span className="text-xs text-neutral-500">{stakeholderLabel[c.stakeholder_type] ?? c.stakeholder_type}</span></td>
                    <td className="text-sm text-neutral-500">{c.country ?? "—"}</td>
                    <td>
                      {canAdmin && (
                        <div className="flex items-center gap-2">
                          <button onClick={() => openContactSlideOver(c)} className="text-xs font-semibold text-primary hover:underline">Edit</button>
                          <button onClick={() => deleteContact(c.id)} className="text-xs font-semibold text-red-500 hover:underline">Delete</button>
                        </div>
                      )}
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-sm text-neutral-400">
                      No contacts yet.{canAdmin && <> <button onClick={() => openContactSlideOver()} className="text-primary font-semibold">Add one</button></>}
                    </td>
                  </tr>
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
                    <button onClick={() => openGroupSlideOver(g)} className="text-xs font-semibold text-primary hover:underline">Edit</button>
                    <button onClick={() => deleteGroup(g.id)} className="text-xs font-semibold text-red-500 hover:underline">Delete</button>
                  </div>
                )}
              </div>
              <p className="text-xs text-neutral-500">
                {g.contacts_count ?? 0} member{(g.contacts_count ?? 0) !== 1 ? "s" : ""}
              </p>
            </div>
          )) : (
            <div className="col-span-3 py-12 text-center text-sm text-neutral-400">
              No groups yet.{canAdmin && <> <button onClick={() => openGroupSlideOver()} className="text-primary font-semibold">Create one</button></>}
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
                  ? (slideOver.item ? "Edit Contact" : "Add Contact")
                  : (slideOver.item ? "Edit Group" : "Add Group")}
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
                    <label className="block text-xs font-medium text-neutral-600 mb-1">Full Name *</label>
                    <input value={form.full_name} onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))} className="form-input w-full" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-neutral-600 mb-1">Email *</label>
                    <input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} className="form-input w-full" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-neutral-600 mb-1">Organization</label>
                    <input value={form.organization} onChange={(e) => setForm((f) => ({ ...f, organization: e.target.value }))} className="form-input w-full" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-neutral-600 mb-1">Country</label>
                      <input value={form.country} onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))} className="form-input w-full" placeholder="e.g. ZA" maxLength={4} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-neutral-600 mb-1">Phone</label>
                      <input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} className="form-input w-full" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-neutral-600 mb-1">Stakeholder Type</label>
                    <select value={form.stakeholder_type} onChange={(e) => setForm((f) => ({ ...f, stakeholder_type: e.target.value }))} className="form-input w-full">
                      <option value="member_parliament">Member of Parliament</option>
                      <option value="ministry">Ministry / Government</option>
                      <option value="ngo">NGO / Civil Society</option>
                      <option value="donor">Donor / Partner</option>
                      <option value="private_sector">Private Sector</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-neutral-600 mb-1">Tags <span className="text-neutral-400 font-normal">(comma-separated)</span></label>
                    <input value={form.tags} onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))} className="form-input w-full" placeholder="e.g. sadc, finance, procurement" />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="block text-xs font-medium text-neutral-600 mb-1">Group Name *</label>
                    <input value={groupForm.name} onChange={(e) => setGroupForm((f) => ({ ...f, name: e.target.value }))} className="form-input w-full" placeholder="e.g. Finance Committee" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-neutral-600 mb-1">Description</label>
                    <textarea value={groupForm.description} onChange={(e) => setGroupForm((f) => ({ ...f, description: e.target.value }))} rows={3} className="form-input w-full resize-none" />
                  </div>
                </>
              )}
            </div>

            <div className="px-6 py-4 border-t border-neutral-100 flex justify-end gap-3">
              <button onClick={() => setSlideOver(null)} className="btn-secondary">Cancel</button>
              <button
                disabled={saving}
                onClick={slideOver.type === "contact" ? saveContact : saveGroup}
                className="btn-primary"
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
