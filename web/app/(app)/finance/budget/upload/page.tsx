"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { financeApi } from "@/lib/api";

type ParsedBudgetLine = {
    category: string;
    account_code?: string;
    description?: string;
    amount_allocated: number;
};

export default function BudgetUploadPage() {
    const router = useRouter();

    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [toastMsg, setToastMsg] = useState("");

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
                setError("Failed to parse CSV file. Ensure standard formatting.");
            }
        };
        reader.readAsText(file);
    };

    const handleSave = async () => {
        if (!name.trim()) {
            setError("Budget name is required.");
            return;
        }
        if (parsedLines.length === 0) {
            setError("No budget lines found. Please upload a valid CSV.");
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

            setToastMsg("Budget successfully uploaded.");
            setTimeout(() => router.push("/finance/budget"), 1500);
        } catch {
            setError("Failed to upload budget. Please check the network payload.");
            setSaving(false);
        }
    };

    return (
        <div className="mx-auto max-w-3xl space-y-6">
            {/* Toast */}
            {toastMsg && (
                <div className="fixed top-5 right-5 z-50 flex items-center gap-2 rounded-xl bg-green-600 px-4 py-3 text-sm font-medium text-white shadow-lg">
                    <span className="material-symbols-outlined text-[18px]">check_circle</span>
                    {toastMsg}
                </div>
            )}

            {/* Page header */}
            <div className="flex items-center gap-2 text-sm text-neutral-500">
                <Link href="/finance/budget" className="hover:text-primary">Budgets</Link>
                <span className="material-symbols-outlined text-[14px]">chevron_right</span>
                <span className="text-neutral-900 font-medium">Upload</span>
            </div>

            <div className="flex items-start justify-between">
                <div>
                    <h1 className="page-title">Upload New Budget</h1>
                    <p className="page-subtitle">Import budget lines via CSV for a core or project portfolio.</p>
                </div>
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
                    <label className="block text-xs font-semibold text-neutral-600 mb-1.5 uppercase tracking-wide">Budget Name *</label>
                    <input
                        className="form-input"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="e.g. SADC PF Core Budget 2026"
                    />
                </div>

                <div className="grid grid-cols-3 gap-4">
                    <div>
                        <label className="block text-xs font-semibold text-neutral-600 mb-1.5 uppercase tracking-wide">Year *</label>
                        <input
                            type="number"
                            className="form-input"
                            value={year}
                            onChange={(e) => setYear(e.target.value)}
                            placeholder="YYYY"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-neutral-600 mb-1.5 uppercase tracking-wide">Type *</label>
                        <select className="form-input" value={type} onChange={(e) => setType(e.target.value as any)}>
                            <option value="core">Core Budget</option>
                            <option value="project">Project / Extra-Budgetary</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-neutral-600 mb-1.5 uppercase tracking-wide">Currency *</label>
                        <select className="form-input" value={currency} onChange={(e) => setCurrency(e.target.value)}>
                            <option value="USD">USD</option>
                            <option value="NAD">NAD</option>
                            <option value="ZAR">ZAR</option>
                            <option value="EUR">EUR</option>
                        </select>
                    </div>
                </div>

                <div>
                    <label className="block text-xs font-semibold text-neutral-600 mb-1.5 uppercase tracking-wide">Description</label>
                    <textarea
                        className="form-input min-h-[60px]"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Optional context about this budget portfolio."
                    />
                </div>
            </div>

            {/* CSV Uploader */}
            <div className="card">
                <div className="card-header border-b border-neutral-100 flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-neutral-800">Import CSV Lines</h2>
                    <a href="#" className="text-sm font-medium text-primary hover:underline">Download Template</a>
                </div>
                <div className="p-5">
                    <div className="flex items-center justify-center w-full">
                        <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-neutral-300 border-dashed rounded-lg cursor-pointer bg-neutral-50 hover:bg-neutral-100 transition-colors">
                            <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                <span className="material-symbols-outlined text-3xl text-neutral-400 mb-2">cloud_upload</span>
                                <p className="mb-1 text-sm text-neutral-500 font-medium">Click to upload a CSV file</p>
                                <p className="text-xs text-neutral-400">Format: Category, Account Code, Description, Amount</p>
                            </div>
                            <input type="file" accept=".csv" className="hidden" onChange={handleFileUpload} />
                        </label>
                    </div>

                    {parsedLines.length > 0 && (
                        <div className="mt-6 border border-neutral-200 rounded-lg overflow-hidden">
                            <div className="bg-neutral-50 px-4 py-2 text-xs font-semibold text-neutral-500 uppercase flex justify-between">
                                <span>Preview extracted data</span>
                                <span>{parsedLines.length} lines detected</span>
                            </div>
                            <div className="max-h-60 overflow-y-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-white sticky top-0 border-b border-neutral-200 shadow-sm">
                                        <tr>
                                            <th className="px-4 py-2 font-medium text-neutral-900">Category</th>
                                            <th className="px-4 py-2 font-medium text-neutral-900 text-right">Amount</th>
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
                                                    ...and {parsedLines.length - 10} more lines.
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
                <Link href="/finance/budget" className="btn-secondary">Cancel</Link>
                <button
                    onClick={handleSave}
                    disabled={saving || parsedLines.length === 0}
                    className="btn-primary"
                >
                    {saving ? "Uploading..." : "Save Budget"}
                </button>
            </div>
        </div>
    );
}
