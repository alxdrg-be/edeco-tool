import { useCallback, useEffect, useRef, useState } from "react";
import { api, type ProjectDetail, type Review } from "../../api";
import type { Tab } from "./types.ts";

/** The pre-delivery check of a project: reloaded after every change and when its tab opens. */
export function useProjectReview(projectId: string, data: ProjectDetail | null, tab: Tab) {
  const [review, setReview] = useState<Review | null>(null);
  const [reviewLoading, setReviewLoading] = useState(false);
  const reviewGeneration = useRef(0);

  const loadReview = useCallback(async () => {
    const generation = ++reviewGeneration.current;
    setReviewLoading(true);
    try {
      const r = await api.review(projectId);
      if (generation === reviewGeneration.current) setReview(r);
    } catch {
      /* the check is optional; the tab shows «Noch nicht geprüft» */
    } finally {
      if (generation === reviewGeneration.current) setReviewLoading(false);
    }
  }, [projectId]);

  // check again after every change of the project and when the tab is opened
  useEffect(() => {
    if (data) loadReview();
  }, [data, loadReview]);
  useEffect(() => {
    if (tab === "review") loadReview();
  }, [tab, loadReview]);
  return { review, reviewLoading, loadReview };
}
