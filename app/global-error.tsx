"use client";

type GlobalErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-950 text-slate-100">
        <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col items-start justify-center gap-6 px-6 py-12 sm:px-10">
          <p className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-300">
            GCP Central
          </p>
          <div className="space-y-3">
            <h1 className="text-3xl font-bold sm:text-4xl">Server error</h1>
            <p className="max-w-xl text-sm text-slate-300 sm:text-base">
              There is a problem with the server configuration. Check server logs for more information.
            </p>
            {error?.digest ? (
              <p className="text-xs text-slate-400">Reference: {error.digest}</p>
            ) : null}
          </div>
          <button
            type="button"
            className="btn btn--secondary btn--sm"
            onClick={() => reset()}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
