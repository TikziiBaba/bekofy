export function OrDivider() {
  return (
    <div className="flex items-center gap-3 type-body-sm text-fg-muted" role="separator" aria-label="ya da">
      <span aria-hidden="true" className="h-px flex-1 bg-line" />
      <span aria-hidden="true">ya da</span>
      <span aria-hidden="true" className="h-px flex-1 bg-line" />
    </div>
  );
}
