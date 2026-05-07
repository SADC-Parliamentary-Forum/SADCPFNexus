"use client";

import { useState } from "react";

interface ReturnModalProps {
    open: boolean;
    onClose: () => void;
    onConfirm: (comment: string) => Promise<void>;
    loading: boolean;
}

export function ReturnModal({ open, onClose, onConfirm, loading }: ReturnModalProps) {
    const [comment, setComment] = useState("");

    if (!open) return null;

    const handleSubmit = async () => {
        if (!comment.trim()) return;
        await onConfirm(comment.trim());
        setComment("");
    };

    const handleClose = () => {
        setComment("");
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-2xl bg-white shadow-xl p-6">
                <div className="flex items-start gap-3 mb-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-50 flex-shrink-0">
                        <span className="material-symbols-outlined text-[20px] text-amber-600">undo</span>
                    </div>
                    <div>
                        <h2 className="text-base font-bold text-neutral-900">Return for Correction</h2>
                        <p className="text-sm text-neutral-500 mt-0.5">
                            Describe the corrections the requester must make before resubmitting.
                        </p>
                    </div>
                </div>

                <textarea
                    value={comment}
                    onChange={e => setComment(e.target.value)}
                    placeholder="Enter correction instructions…"
                    rows={4}
                    className="form-input w-full resize-none text-sm"
                    disabled={loading}
                    autoFocus
                />

                <div className="flex gap-3 mt-4 justify-end">
                    <button
                        type="button"
                        onClick={handleClose}
                        disabled={loading}
                        className="btn-secondary text-sm"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={!comment.trim() || loading}
                        className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        {loading ? "Returning…" : "Return for Correction"}
                    </button>
                </div>
            </div>
        </div>
    );
}
