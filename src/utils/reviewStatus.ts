// Document review status kept in the frontmatter `review-status` field.

export const REVIEW_STATUS_FIELD = "review-status";

export const REVIEW_STATUSES = ["draft", "in-review", "approved"] as const;

export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

export function isReviewStatus(value: unknown): value is ReviewStatus {
  return (
    typeof value === "string" &&
    (REVIEW_STATUSES as readonly string[]).includes(value)
  );
}

export function reviewStatusLabel(status: string): string {
  switch (status) {
    case "in-review":
      return "In review";
    case "approved":
      return "Approved";
    default:
      return "Draft";
  }
}

/** Tailwind classes for the status pill in the header. */
export function reviewStatusClasses(status: string): string {
  switch (status) {
    case "in-review":
      return "bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300";
    case "approved":
      return "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300";
    default:
      return "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300";
  }
}
