const PLACEMENT_REVIEW_NOTICE_SELECTOR = '[data-alert-rewrite-status="placement-review"]';

// Placement-review notices are AIDA editor guidance, not page content.
export function removeAlertRewritePlacementReviewNotices(root: ParentNode): void {
  root.querySelectorAll(PLACEMENT_REVIEW_NOTICE_SELECTOR).forEach((notice) => notice.remove());
}
