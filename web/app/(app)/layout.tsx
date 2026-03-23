import { AppShell } from "@/components/layout/AppShell";
import { ToastProvider } from "@/components/ui/Toast";
import { ConfirmProvider } from "@/components/ui/ConfirmDialog";
import { RouteProgressBar } from "@/components/ui/RouteProgressBar";
import { QueryProvider } from "@/components/providers/QueryProvider";
import { ThemeProvider } from "@/components/providers/ThemeProvider";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <QueryProvider>
        <ToastProvider>
          <ConfirmProvider>
            <RouteProgressBar />
            <AppShell>{children}</AppShell>
          </ConfirmProvider>
        </ToastProvider>
      </QueryProvider>
    </ThemeProvider>
  );
}
