import { AppShell } from "@/components/layout/AppShell";
import { ToastProvider } from "@/components/ui/Toast";
import { ConfirmProvider } from "@/components/ui/ConfirmDialog";
import { RouteProgressBar } from "@/components/ui/RouteProgressBar";
import { QueryProvider } from "@/components/providers/QueryProvider";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { PrefsProvider } from "@/components/providers/PrefsProvider";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <PrefsProvider>
        <QueryProvider>
          <ToastProvider>
            <ConfirmProvider>
              <RouteProgressBar />
              <AppShell>{children}</AppShell>
            </ConfirmProvider>
          </ToastProvider>
        </QueryProvider>
      </PrefsProvider>
    </ThemeProvider>
  );
}
