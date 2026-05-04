export function sortSlidesByNumber(slides = []) {
  return [...slides].sort((a, b) => a.slideNumber - b.slideNumber);
}

export function getSlidePreviewImage(slide) {
  return slide?.thumbnailUrl ?? slide?.imageUrl ?? '';
}

export function getSlideDisplayImage(slide) {
  return slide?.imageUrl ?? slide?.thumbnailUrl ?? '';
}
