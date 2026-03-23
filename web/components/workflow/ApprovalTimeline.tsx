"use client";

import { type ApprovalRequest, type ApprovalHistory, type ApprovalStep } from "@/lib/api";

interface Props {
    request?: ApprovalRequest;
}

export function ApprovalTimeline({ request }: Props) {
    if (!request || !request.workflow) return null;

    const steps = request.workflow.steps || [];
    const history = request.history || [];
    const currentIndex = request.current_step_index;

    const getStepStatus = (index: number) => {
        if (request.status === 'rejected' && index === currentIndex) return 'rejected';
        if (index < currentIndex || request.status === 'approved') return 'completed';
        if (index === currentIndex) return 'pending';
        return 'upcoming';
    };

    const getApproverLabel = (step: ApprovalStep, index: number) => {
        // Check history for this step
        const entry = history[index];
        if (entry && entry.user) return entry.user.name;

        switch (step.approver_type) {
            case 'supervisor': return "Direct Supervisor";
            case 'up_the_chain': return "Department Head";
            case 'specific_role': return step.role?.name || "Required Role";
            case 'specific_user': return step.user?.name || "Specific User";
            default: return "Pending Approver";
        }
    };

    return (
        <div className="card p-5">
            <div className="flex items-center gap-3 mb-6">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 flex-shrink-0">
                    <span className="material-symbols-outlined text-[18px] text-indigo-600">account_tree</span>
                </div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500">Approval Timeline</h3>
            </div>

            <div className="space-y-6">
                {steps.map((step, idx) => {
                    const status = getStepStatus(idx);
                    const histEntry = history[idx];

                    return (
                        <div key={step.id} className="relative pl-8">
                            {/* Vertical Connector */}
                            {idx < steps.length - 1 && (
                                <div className={`absolute left-3 top-6 bottom-[-24px] w-px ${status === 'completed' ? 'bg-green-500' : 'bg-neutral-200'}`} />
                            )}

                            {/* Status Indicator */}
                            <div className={`absolute left-0 top-1 size-6 rounded-full border-4 border-white shadow-sm flex items-center justify-center z-10 
                ${status === 'completed' ? 'bg-green-500 text-white' :
                                    status === 'rejected' ? 'bg-red-500 text-white' :
                                        status === 'pending' ? 'bg-amber-500 text-white ring-4 ring-amber-500/20' :
                                            'bg-neutral-100 text-neutral-400'}`}
                            >
                                <span className="material-symbols-outlined text-[12px] font-bold">
                                    {status === 'completed' ? 'check' : status === 'rejected' ? 'close' : status === 'pending' ? 'pending' : 'lock'}
                                </span>
                            </div>

                            <div className="flex flex-col">
                                <div className="flex items-center justify-between">
                                    <p className={`text-sm font-bold ${status === 'upcoming' ? 'text-neutral-400' : 'text-neutral-900'}`}>
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
                                        Stage {idx + 1}: {step.approver_type.replace(/_/g, ' ')}
                                    </p>
                                    {status === 'pending' && (
                                        <span className="flex h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
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
