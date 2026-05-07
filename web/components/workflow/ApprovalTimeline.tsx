"use client";

import { type ApprovalRequest, type ApprovalHistory, type ApprovalStep } from "@/lib/api";

interface Props {
    request?: ApprovalRequest;
}

const ACTION_LABELS: Record<string, string> = {
    approve:   "Approved",
    reject:    "Rejected",
    return:    "Returned for Correction",
    withdraw:  "Withdrawn",
    delegate:  "Delegated",
    resubmit:  "Resubmitted",
};

export function ApprovalTimeline({ request }: Props) {
    if (!request || !request.workflow) return null;

    const steps        = request.workflow.steps || [];
    const history      = request.history || [];
    const currentIndex = request.current_step_index;
    const isWithdrawn  = request.status === "withdrawn";

    // Find the history entry that corresponds to a given step index.
    // Primary: match by step_index column. Fallback: use array position for legacy rows.
    const getHistoryForStep = (stepIdx: number): ApprovalHistory | undefined =>
        history.find(h => h.step_index === stepIdx) ??
        history.find((h, i) => h.step_index == null && i === stepIdx);

    const getStepStatus = (index: number) => {
        if (isWithdrawn) return "withdrawn";
        if (request.status === "rejected" && index === currentIndex) return "rejected";
        if (request.status === "returned" && index === currentIndex) return "returned";
        if (index < currentIndex || request.status === "approved") return "completed";
        if (index === currentIndex) return "pending";
        return "upcoming";
    };

    const getApproverLabel = (step: ApprovalStep, index: number) => {
        const entry = getHistoryForStep(index);
        if (entry && entry.user) return entry.user.name;

        if (step.step_name) return step.step_name;

        switch (step.approver_type) {
            case "supervisor":    return "Direct Supervisor";
            case "up_the_chain":  return "Department Head";
            case "specific_role": return step.role?.name || "Required Role";
            case "specific_user": return step.user?.name || "Specific User";
            default:              return "Pending Approver";
        }
    };

    const getStageLabel = (step: ApprovalStep, index: number) => {
        return step.step_name ?? `Stage ${index + 1}: ${step.approver_type.replace(/_/g, " ")}`;
    };

    return (
        <div className="card p-5">
            <div className="flex items-center gap-3 mb-6">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 flex-shrink-0">
                    <span className="material-symbols-outlined text-[18px] text-indigo-600">account_tree</span>
                </div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500">Approval Timeline</h3>
            </div>

            {/* Withdrawn banner */}
            {isWithdrawn && (
                <div className="mb-4 flex items-center gap-2 rounded-lg bg-neutral-100 border border-neutral-200 px-4 py-3 text-sm text-neutral-600">
                    <span className="material-symbols-outlined text-[16px] text-neutral-500">block</span>
                    This request was withdrawn and is no longer in the approval queue.
                </div>
            )}

            {/* Returned banner */}
            {request.status === "returned" && (
                <div className="mb-4 flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
                    <span className="material-symbols-outlined text-[16px] text-amber-600">undo</span>
                    This request was returned for correction. The requester must resubmit after making changes.
                    {(request.returned_count ?? 0) > 0 && (
                        <span className="ml-auto text-xs text-amber-600">
                            Returned {request.returned_count} time{request.returned_count !== 1 ? "s" : ""}
                        </span>
                    )}
                </div>
            )}

            <div className="space-y-6">
                {steps.map((step, idx) => {
                    const status   = getStepStatus(idx);
                    const histEntry = getHistoryForStep(idx);

                    const dotColor =
                        status === "completed"  ? "bg-green-500 text-white" :
                        status === "rejected"   ? "bg-red-500 text-white" :
                        status === "returned"   ? "bg-amber-500 text-white ring-4 ring-amber-500/20" :
                        status === "pending"    ? "bg-amber-500 text-white ring-4 ring-amber-500/20" :
                        status === "withdrawn"  ? "bg-neutral-300 text-neutral-500" :
                                                  "bg-neutral-100 text-neutral-400";

                    const dotIcon =
                        status === "completed" ? "check" :
                        status === "rejected"  ? "close" :
                        status === "returned"  ? "undo" :
                        status === "pending"   ? "pending" :
                        status === "withdrawn" ? "block" :
                                                 "lock";

                    const connectorColor =
                        status === "completed" ? "bg-green-500" : "bg-neutral-200";

                    return (
                        <div key={step.id} className="relative pl-8">
                            {idx < steps.length - 1 && (
                                <div className={`absolute left-3 top-6 bottom-[-24px] w-px ${connectorColor}`} />
                            )}

                            <div className={`absolute left-0 top-1 size-6 rounded-full border-4 border-white shadow-sm flex items-center justify-center z-10 ${dotColor}`}>
                                <span className="material-symbols-outlined text-[12px] font-bold">{dotIcon}</span>
                            </div>

                            <div className="flex flex-col">
                                <div className="flex items-center justify-between">
                                    <p className={`text-sm font-bold ${status === "upcoming" || status === "withdrawn" ? "text-neutral-400" : "text-neutral-900"}`}>
                                        {getApproverLabel(step, idx)}
                                    </p>
                                    {histEntry && (
                                        <span className="text-[10px] text-neutral-400 font-medium">
                                            {new Date(histEntry.created_at).toLocaleDateString()}
                                        </span>
                                    )}
                                </div>

                                <div className="flex items-center gap-2 mt-0.5">
                                    <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-wider">
                                        {getStageLabel(step, idx)}
                                    </p>
                                    {status === "pending" && (
                                        <span className="flex h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                                    )}
                                    {histEntry && (
                                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                                            histEntry.action === "approve"  ? "bg-green-50 text-green-700" :
                                            histEntry.action === "reject"   ? "bg-red-50 text-red-700" :
                                            histEntry.action === "return"   ? "bg-amber-50 text-amber-700" :
                                            histEntry.action === "delegate" ? "bg-blue-50 text-blue-700" :
                                                                              "bg-neutral-50 text-neutral-600"
                                        }`}>
                                            {ACTION_LABELS[histEntry.action] ?? histEntry.action}
                                        </span>
                                    )}
                                </div>

                                {histEntry?.comment && (
                                    <div className="mt-2 p-3 rounded-lg bg-neutral-50 border border-neutral-100 text-xs text-neutral-600 italic leading-relaxed">
                                        "{histEntry.comment}"
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
