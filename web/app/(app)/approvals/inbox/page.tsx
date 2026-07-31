'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { workflowApi, type ApprovalRequest } from '@/lib/api';
import { formatDateShort } from '@/lib/utils';
import { useToast } from '@/components/ui/Toast';
import { ModulePageHeader, PageBreadcrumbs } from '@/components/ui/ModulePageHeader';
import { EmptyState } from '@/components/ui/EmptyState';

type InboxStatus = 'awaiting' | 'due' | 'overdue' | 'delegated' | 'acting' | 'completed';

const TABS: { id: InboxStatus; label: string }[] = [
  { id: 'awaiting', label: 'Awaiting' },
  { id: 'due', label: 'Due soon' },
  { id: 'overdue', label: 'Overdue' },
  { id: 'delegated', label: 'Delegated' },
  { id: 'acting', label: 'Acting' },
  { id: 'completed', label: 'Completed' },
];

export default function ApprovalsInboxPage() {
  const [tab, setTab] = useState<InboxStatus>('awaiting');
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['approvals', 'inbox', tab],
    queryFn: async () => {
      const res = await workflowApi.getInbox({ status: tab });
      return res.data.data ?? [];
    },
    staleTime: 20_000,
  });

  const { data: pending = [] } = useQuery({
    queryKey: ['approvals', 'pending'],
    queryFn: () => workflowApi.getPending().then((res) => res.data.data as ApprovalRequest[]),
    staleTime: 30_000,
    enabled: tab === 'awaiting',
  });

  const rows = useMemo(() => {
    if (tab === 'awaiting' && tasks.length === 0) {
      return pending.map((p) => ({
        id: p.id,
        approval_request_id: p.id,
        stage_type: p.workflow?.module_type,
        status: 'awaiting',
        due_at: null,
        assignment_reason: 'Legacy pending approval',
        approval_request: p,
      }));
    }
    return tasks;
  }, [tab, tasks, pending]);

  const decide = async (task: any, decision: 'approve' | 'reject') => {
    setActionLoading(task.id);
    try {
      if (task.approval_request_id && !task.uuid) {
        if (decision === 'approve') await workflowApi.approve(task.approval_request_id);
        else await workflowApi.reject(task.approval_request_id, 'Rejected from inbox');
      } else {
        await workflowApi.decideTask(task.id, {
          decision_type: decision,
          comment: decision === 'reject' ? 'Rejected from inbox' : null,
          idempotency_key: `inbox-${task.id}-${decision}-${Date.now()}`,
        });
      }
      queryClient.invalidateQueries({ queryKey: ['approvals'] });
      toast('success', decision === 'approve' ? 'Approved' : 'Rejected', 'Decision recorded.');
    } catch {
      toast('error', 'Action failed', 'Could not record decision.');
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <ModulePageHeader
        title="My Approvals"
        subtitle="Awaiting action, due, overdue, delegated, acting and completed tasks — with current holder and stage."
        breadcrumbs={
          <PageBreadcrumbs items={[{ label: 'Approvals', href: '/approvals' }, { label: 'Inbox' }]} />
        }
      />

      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`filter-tab ${tab === t.id ? 'active' : ''}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="card space-y-3 p-6">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-12 animate-pulse rounded-lg bg-neutral-100" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="card">
          <EmptyState icon="inbox" title="No items in this view" description="Switch tabs or check back when new approval tasks arrive." />
        </div>
      ) : (
        <div className="overflow-x-auto border border-neutral-200 dark:border-neutral-800 rounded-lg">
          <table className="min-w-full text-sm">
            <thead className="bg-neutral-50 dark:bg-neutral-900/50 text-left">
              <tr>
                <th className="px-3 py-2 font-medium">Stage</th>
                <th className="px-3 py-2 font-medium">Module</th>
                <th className="px-3 py-2 font-medium">Due</th>
                <th className="px-3 py-2 font-medium">Why me</th>
                <th className="px-3 py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((task: any) => (
                <tr key={task.id} className="border-t border-neutral-100 dark:border-neutral-800">
                  <td className="px-3 py-2 capitalize">{task.stage_type ?? task.decision_type ?? '—'}</td>
                  <td className="px-3 py-2">
                    {task.approval_request?.workflow?.module_type ?? '—'}
                    {task.approval_request?.reference ? (
                      <span className="block text-xs text-neutral-500">{task.approval_request.reference}</span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2">{task.due_at ? formatDateShort(task.due_at) : '—'}</td>
                  <td className="px-3 py-2 text-neutral-600 dark:text-neutral-300 max-w-xs truncate">
                    {task.assignment_reason ?? '—'}
                  </td>
                  <td className="px-3 py-2 space-x-2">
                    {tab !== 'completed' && (
                      <>
                        <button
                          type="button"
                          disabled={actionLoading === task.id}
                          onClick={() => decide(task, 'approve')}
                          className="text-primary hover:underline disabled:opacity-50"
                        >
                          Decide
                        </button>
                        <button
                          type="button"
                          disabled={actionLoading === task.id}
                          onClick={() => decide(task, 'reject')}
                          className="text-rose-600 hover:underline disabled:opacity-50"
                        >
                          Reject
                        </button>
                      </>
                    )}
                    {task.approval_request_id && (
                      <Link href={`/approvals?focus=${task.approval_request_id}`} className="text-neutral-500 hover:underline">
                        Open
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-neutral-400">
        Phase 2 parallel/quorum designer and AI assistance are deferred — AI must never auto-approve, skip or sign.
      </p>
    </div>
  );
}
