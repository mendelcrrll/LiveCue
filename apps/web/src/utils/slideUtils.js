import { resolveApiUrl } from '../services/apiClient';

export function sortSlidesByNumber(slides = []) {
  return [...slides].sort((a, b) => a.slideNumber - b.slideNumber);
}

export function getSlidePreviewImage(slide) {
  return resolveSlideImage(slide?.thumbnailUrl ?? slide?.imageUrl);
}

export function getSlideDisplayImage(slide) {
  return resolveSlideImage(slide?.imageUrl ?? slide?.thumbnailUrl);
}

function resolveSlideImage(imageUrl) {
  return imageUrl ? resolveApiUrl(imageUrl) : '';
}

export function isPriorityItemComplete(item) {
  return Boolean(item?.completed || item?.complete || item?.isComplete || item?.finished);
}

export function mergeSlidePreservingGoalCompletion(currentSlide, updatedSlide) {
  if (!currentSlide?.buildData?.priorityItems?.length) {
    return updatedSlide;
  }

  const completedById = new Map(
    currentSlide.buildData.priorityItems
      .filter(isPriorityItemComplete)
      .map((item) => [item.id, item])
  );

  if (completedById.size === 0) {
    return updatedSlide;
  }

  const mergedPriorityItems = (updatedSlide.buildData?.priorityItems ?? []).map((item) => {
    if (isPriorityItemComplete(item) || !completedById.has(item.id)) {
      return item;
    }

    const previous = completedById.get(item.id);
    return {
      ...item,
      completed: true,
      completedAtMs: previous.completedAtMs ?? item.completedAtMs,
      evidence: previous.evidence ?? item.evidence,
    };
  });

  return {
    ...updatedSlide,
    buildData: {
      ...updatedSlide.buildData,
      priorityItems: mergedPriorityItems,
    },
  };
}
