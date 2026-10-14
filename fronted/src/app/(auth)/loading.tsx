export default function AuthLoading() {
  return (
    <div className="flex min-h-[calc(100dvh-4rem)] items-center justify-center p-4">
      <div
        className="card card-shadow w-full max-w-sm space-y-5 rounded-lg p-6"
        role="status"
        aria-label="Loading account page"
        aria-busy="true"
      >
        <div className="h-7 w-3/4 animate-pulse rounded bg-muted" />
        <div className="h-4 w-full animate-pulse rounded bg-muted" />
        {[1, 2, 3].map((key) => (
          <div key={key} className="h-11 animate-pulse rounded-md bg-muted" />
        ))}
        <span className="sr-only">Loading your account page</span>
      </div>
    </div>
  );
}
