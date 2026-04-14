// Minimal pass-through layout for the setup wizard.
// No AppShell, no sidebar, no header — the wizard owns its full-screen shell.
export default function SetupLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
