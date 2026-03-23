import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-surface-muted p-6">
      <h1 className="text-2xl font-semibold text-neutral-900 mb-2">This page could not be found</h1>
      <p className="text-neutral-600 mb-6 text-center max-w-md">
        The page you requested does not exist.
      </p>
      <div className="flex gap-4">
        <Link
          href="/"
          className="px-4 py-2 rounded-lg bg-primary text-white font-medium hover:opacity-90"
        >
          Home
        </Link>
        <Link
          href="/login"
          className="px-4 py-2 rounded-lg border border-neutral-300 font-medium hover:bg-neutral-50"
        >
          Login
        </Link>
        <Link
          href="/dashboard"
          className="px-4 py-2 rounded-lg border border-neutral-300 font-medium hover:bg-neutral-50"
        >
          Dashboard
        </Link>
      </div>
    </div>
  );
}
