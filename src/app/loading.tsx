/**
 * Root Loading State
 *
 * Displayed during route transitions and initial page loads.
 * Uses a minimal, professional loading indicator.
 */
export default function RootLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        {/* Spinner */}
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-primary" />
        {/* Loading text */}
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    </div>
  );
}
