"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { financeApi, type Budget } from "@/lib/api";

export default function BudgetDashboardPage() {
    const [loading, setLoading] = useState(true);
    const [budgets, setBudgets] = useState<Budget[]>([]);
    const [error, setError] = useState("");
    const [deletingId, setDeletingId] = useState<number | null>(null);

    useEffect(() => {
        financeApi.listBudgets()
            .then((res) => {
                setBudgets((res.data as any).data);
            })
            .catch(() => setError("Failed to load budgets."))
            .finally(() => setLoading(false));
    }, []);

    const handleDelete = (budget: Budget) => {
        if (!confirm(`Delete budget "${budget.name}"? This cannot be undone.`)) return; // ship-safe-ignore: confirm dialog string, not SQL
        setDeletingId(budget.id);
        financeApi.deleteBudget(budget.id)
            .then(() => setBudgets((prev) => prev.filter((b) => b.id !== budget.id)))
            .catch(() => setError("Failed to delete budget."))
            .finally(() => setDeletingId(null));
    };

    const totalCore = budgets.filter(b => b.type === 'core').reduce((acc, curr) => acc + Number(curr.total_amount), 0);
    const totalProject = budgets.filter(b => b.type === 'project').reduce((acc, curr) => acc + Number(curr.total_amount), 0);

    return (
        <div className="mx-auto max-w-5xl space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="page-title">Budget Management</h1>
                    <p className="page-subtitle">Track core and project budgets, allocations, and expenditures</p>
                </div>
                <div className="flex items-center gap-3">
                    <Link href="/finance/budget/upload" className="btn-primary flex items-center gap-2">
                        <span className="material-symbols-outlined text-[18px]">upload_file</span>
                        Upload Budget
                    </Link>
                </div>
            </div>

            {error && (
                <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    <span className="material-symbols-outlined text-[18px]">error</span>
                    {error}
                </div>
            )}

            {/* Summary Cards */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="card p-5">
                    <div className="text-sm font-medium text-neutral-500 mb-1">Total Core Budget</div>
                    <div className="text-2xl font-bold text-neutral-900">
                        ${totalCore.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                </div>
                <div className="card p-5">
                    <div className="text-sm font-medium text-neutral-500 mb-1">Total Project Budget</div>
                    <div className="text-2xl font-bold text-neutral-900">
                        ${totalProject.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                </div>
                <div className="card p-5 border-l-4 border-l-primary">
                    <div className="text-sm font-medium text-neutral-500 mb-1">Total Managed Funds</div>
                    <div className="text-2xl font-bold text-primary">
                        ${(totalCore + totalProject).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                </div>
            </div>

            {/* Budgets List */}
            <div className="card overflow-hidden">
                <div className="card-header">
                    <h2 className="text-lg font-semibold text-neutral-800">Budget Portfolios</h2>
                </div>
                <div className="overflow-x-auto">
                    <table className="data-table w-full">
                        <thead>
                            <tr>
                                <th className="text-left font-semibold text-neutral-500 uppercase tracking-wider text-xs">Name</th>
                                <th className="text-left font-semibold text-neutral-500 uppercase tracking-wider text-xs">Type</th>
                                <th className="text-left font-semibold text-neutral-500 uppercase tracking-wider text-xs">Year</th>
                                <th className="text-left font-semibold text-neutral-500 uppercase tracking-wider text-xs">Currency</th>
                                <th className="text-right font-semibold text-neutral-500 uppercase tracking-wider text-xs">Total Amount</th>
                                <th className="text-right font-semibold text-neutral-500 uppercase tracking-wider text-xs">Status</th>
                                <th className="text-right font-semibold text-neutral-500 uppercase tracking-wider text-xs">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-100">
                            {loading ? (
                                <tr>
                                    <td colSpan={7} className="text-center py-8 text-neutral-500">
                                        <span className="material-symbols-outlined animate-spin text-primary">autorenew</span>
                                    </td>
                                </tr>
                            ) : budgets.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="text-center py-8 text-neutral-500 italic">No budgets found.</td>
                                </tr>
                            ) : (
                                budgets.map((budget) => (
                                    <tr key={budget.id} className="hover:bg-neutral-50/50">
                                        <td className="font-medium text-neutral-900">
                                            <Link href={`/finance/budget/${budget.id}`} className="hover:text-primary transition-colors">
                                                {budget.name}
                                            </Link>
                                        </td>
                                        <td>
                                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize ${budget.type === 'core' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
                                                }`}>
                                                {budget.type}
                                            </span>
                                        </td>
                                        <td className="text-neutral-600">{budget.year}</td>
                                        <td className="text-neutral-600">{budget.currency}</td>
                                        <td className="text-right font-medium text-neutral-900">
                                            {Number(budget.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </td>
                                        <td className="text-right">
                                            <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600">
                                                <span className="h-1.5 w-1.5 rounded-full bg-green-500"></span> Active
                                            </span>
                                        </td>
                                        <td className="text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                <Link href={`/finance/budget/${budget.id}`} className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-neutral-600 hover:bg-neutral-100 transition-colors">
                                                    <span className="material-symbols-outlined text-[14px]">open_in_new</span>
                                                    View
                                                </Link>
                                                <button
                                                    type="button"
                                                    onClick={() => handleDelete(budget)}
                                                    disabled={deletingId === budget.id}
                                                    className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                                                >
                                                    {deletingId === budget.id ? (
                                                        <span className="material-symbols-outlined text-[14px] animate-spin">progress_activity</span>
                                                    ) : (
                                                        <span className="material-symbols-outlined text-[14px]">delete</span>
                                                    )}
                                                    Delete
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
