"use client";

export default function ErrorState({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#ececec] p-6">
      <div className="w-full max-w-md rounded-[24px] bg-white p-6 text-center shadow-sm">
        <h1 className="text-xl font-semibold">Something went wrong</h1>
        <p className="mt-2 text-sm text-[#666]">{error.message || "The application hit an unexpected error."}</p>
        <button type="button" onClick={reset} className="mt-5 rounded-full bg-[#1c1c1c] px-5 py-2.5 text-sm font-semibold text-white">
          Try again
        </button>
      </div>
    </div>
  );
}
