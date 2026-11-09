"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { financeApi } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import { useI18n } from "@/lib/i18n/LocaleProvider";

type ParsedBudgetLine = {
    category: string;
    account_code?: string;
    description?: string;
    amount_allocated: number;
};

export default function BudgetUploadPage() {
  const { success, error: showErrorToast, info } = useToast();
    const { t } = useI18n();
    const router = useRouter();

    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    const [year, setYear] = useState(new Date().getFullYear().toString());
    const [name, setName] = useState("");
    const [type, setType] = useState<"core" | "project">("core");
    const [currency, setCurrency] = useState("USD");
    const [description, setDescription] = useState("");

    const [csvContent, setCsvContent] = useState<string>("");
    const [parsedLines, setParsedLines] = useState<ParsedBudgetLine[]>([]);

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const text = event.target?.result as string;
            setCsvContent(text);

            try {
                const rows = text.split("\n").filter(row => row.trim() !== "");
                // Assume first row might be headers
                const startIndex = rows[0].toLowerCase().includes("category") ? 1 : 0;

                const lines: ParsedBudgetLine[] = [];
                for (let i = startIndex; i < rows.length; i++) {
                    const cols = rows[i].split(",").map(c => c.trim().replace(/^"|"$/g, ''));
                    // Expected cols: Category, Account Code, Description, Amount
                    if (cols.length >= 2) {
                        lines.push({
                            category: cols[0],
                            account_code: cols[1] || "",
                            description: cols[2] || "",
                            amount_allocated: parseFloat(cols[3] || cols[1] || "0"),
                        });
                    }
                }
                setParsedLines(lines);
                setError("");
            } catch (err) {
                setError(t("finance.budget.upload.parseFailed"));
            }
        };
        reader.readAsText(file);
    };

    const handleSave = async () => {
        if (!name.trim()) {
            setError(t("finance.budget.upload.nameRequired"));
            return;
        }
        if (parsedLines.length === 0) {
            setError(t("finance.budget.upload.noLines"));
            return;
        }

        setSaving(true);
        setError("");

        try {
            await financeApi.createBudget({
                year,
                name,
                type,
                currency,
                description,
                lines: parsedLines as any,
            });

            success(t("finance.budget.upload.success"));
            setTimeout(() => router.push("/finance/budget"), 1500);
        } catch {
            setError(t("finance.budget.upload.failed"));
            setSaving(false);
        }
    };

    return (
        <div className="w-full min-w-0 space-y-6">
            {/* Toast */}

            {/* Page header */}
            <div className="flex items-center gap-2 text-sm text-neutral-500">
                <Link href="/finance/budget" className="hover:text-primary">{t("finance.budget.budgets")}</Link>
                <span className="material-symbols-outlined text-[14px]">chevron_right</span>
                <span className="text-neutral-900 font-medium">{t("common.upload")}</span>
            </div>

            <div className="flex items-start justify-between">
                <ModulePageHeader
        title="finance.budget.upload.title"
        subtitle="finance.budget.upload.subtitle"
        breadcrumbs={<PageBreadcrumbs items={[{ label: "finance.budget.upload.title" }]} />}
      />
            </div>

            {error && (
                <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    <span className="material-symbols-outlined text-[18px]">error</span>
                    {error}
                </div>
            )}

            {/* Basic Setup */}
            <div className="card p-5 space-y-4">
                <div>
                    <label htmlFor="finance-budget-upload-budget-name" className="block text-xs font-semibold text-neutral-600 mb-1.5 uppercase tracking-wide">{t("finance.budget.upload.name")}</label>
                    <input id="finance-budget-upload-budget-name"
                        className="form-input"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder={t("finance.budget.upload.namePlaceholder")}
                    />
                </div>

                <div className="grid grid-cols-3 gap-4">
                    <div>
                        <label htmlFor="finance-budget-upload-year" className="block text-xs font-semibold text-neutral-600 mb-1.5 uppercase tracking-wide">{t("finance.budget.upload.year")}</label>
                        <input id="finance-budget-upload-year"
                            type="number"
                            className="form-input"
                            value={year}
                            onChange={(e) => setYear(e.target.value)}
                            placeholder={t("finance.budget.upload.yearPlaceholder")}
                        />
                    </div>
                    <div>
                        <label htmlFor="finance-budget-upload-type" className="block text-xs font-semibold text-neutral-600 mb-1.5 uppercase tracking-wide">{t("finance.budget.upload.type")}</label>
                        <select id="finance-budget-upload-type" className="form-input" value={type} onChange={(e) => setType(e.target.value as any)}>
                            <option value="core">{t("finance.budget.upload.typeCore")}</option>
                            <option value="project">{t("finance.budget.upload.typeProject")}</option>
                        </select>
                    </div>
                    <div>
                        <label htmlFor="finance-budget-upload-currency" className="block text-xs font-semibold text-neutral-600 mb-1.5 uppercase tracking-wide">{t("finance.budget.upload.currency")}</label>
                        <select id="finance-budget-upload-currency" className="form-input" value={currency} onChange={(e) => setCurrency(e.target.value)}>
                            <option value="USD">USD</option> {/* i18n-ignore */}
                            <option value="NAD">NAD</option> {/* i18n-ignore */}
                            <option value="ZAR">ZAR</option> {/* i18n-ignore */}
                            <option value="EUR">EUR</option> {/* i18n-ignore */}
                        </select>
                    </div>
                </div>

                <div>
                    <label htmlFor="finance-budget-upload-description" className="block text-xs font-semibold text-neutral-600 mb-1.5 uppercase tracking-wide">{t("finance.budget.upload.description")}</label>
                    <textarea id="finance-budget-upload-description"
                        className="form-input min-h-[60px]"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder={t("finance.budget.upload.descriptionPlaceholder")}
                    />
                </div>
            </div>

            {/* CSV Uploader */}
            <div className="card">
                <div className="card-header border-b border-neutral-100 flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-neutral-800">{t("finance.budget.upload.importLines")}</h2>
                    <a href="#" className="btn-secondary text-sm py-1 px-2">{t("finance.budget.upload.downloadTemplate")}</a>
                </div>
                <div className="p-5">
                    <div className="flex items-center justify-center w-full">
                        <label htmlFor="finance-budget-upload-cloud-upload-click-to-upload-a-csv-file-format-c" className="flex flex-col items-center justify-center w-full h-32 border-2 border-neutral-300 border-dashed rounded-lg cursor-pointer bg-neutral-50 hover:bg-neutral-100 transition-colors">
                            <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                <span className="material-symbols-outlined text-3xl text-neutral-400 mb-2">cloud_upload</span>
                                <p className="mb-1 text-sm text-neutral-500 font-medium">{t("finance.budget.upload.clickToUpload")}</p>
                                <p className="text-xs text-neutral-400">{t("finance.budget.upload.format")}</p>
                            </div>
                            <input id="finance-budget-upload-cloud-upload-click-to-upload-a-csv-file-format-c" type="file" accept=".csv" className="hidden" onChange={handleFileUpload} />
                        </label>
                    </div>

                    {parsedLines.length > 0 && (
                        <div className="mt-6 border border-neutral-200 rounded-lg overflow-hidden">
                            <div className="bg-neutral-50 px-4 py-2 text-xs font-semibold text-neutral-500 uppercase flex justify-between">
                                <span>{t("finance.budget.upload.preview")}</span>
                                <span>{t("finance.budget.upload.detected", { count: parsedLines.length })}</span>
                            </div>
                            <div className="max-h-60 overflow-y-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-white sticky top-0 border-b border-neutral-200 shadow-sm">
                                        <tr>
                                            <th className="px-4 py-2 font-medium text-neutral-900">{t("finance.budget.detail.col.category")}</th>
                                            <th className="px-4 py-2 font-medium text-neutral-900 text-right">{t("finance.budget.upload.amount")}</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-neutral-100 bg-white">
                                        {parsedLines.slice(0, 10).map((line, idx) => (
                                            <tr key={idx}>
                                                <td className="px-4 py-2 text-neutral-600">{line.category}</td>
                                                <td className="px-4 py-2 text-right font-medium text-neutral-900">
                                                    ${line.amount_allocated.toLocaleString()}
                                                </td>
                                            </tr>
                                        ))}
                                        {parsedLines.length > 10 && (
                                            <tr>
                                                <td colSpan={2} className="px-4 py-3 text-center text-xs text-neutral-500 italic bg-neutral-50">
                                                    {t("finance.budget.upload.more", { count: parsedLines.length - 10 })}
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
                <Link href="/finance/budget" className="btn-secondary">{t("common.cancel")}</Link>
                <button
                    onClick={handleSave}
                    disabled={saving || parsedLines.length === 0}
                    className="btn-primary"
                >
                    {saving ? t("finance.budget.upload.uploading") : t("finance.budget.upload.save")}
                </button>
            </div>
        </div>
    );
}
