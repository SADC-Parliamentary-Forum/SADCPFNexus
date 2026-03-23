import { AppShell } from "@/components/layout/AppShell";
import { ToastProvider } from "@/components/ui/Toast";
import { ConfirmProvider } from "@/components/ui/ConfirmDialog";
import { RouteProgressBar } from "@/components/ui/RouteProgressBar";
import { QueryProvider } from "@/components/providers/QueryProvider";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <QueryProvider>
      <ToastProvider>
        <ConfirmProvider>
          <RouteProgressBar />
          <AppShell>{children}</AppShell>
        </ConfirmProvider>
      </ToastProvider>
    </QueryProvider>
  );
}
