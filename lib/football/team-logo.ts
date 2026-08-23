/**
 * 365scores CDN crest URLs (Cloudinary imagecache).
 * Uses competitor id + imageVersion from API payloads.
 */
export function scores365CompetitorLogoUrl(
  competitorId: number | string | null | undefined,
  imageVersion?: number | string | null,
  size = 64,
): string | null {
  const id = Number(competitorId);
  if (!Number.isFinite(id) || id <= 0) return null;
  const version = Math.max(1, Math.trunc(Number(imageVersion) || 1));
  const px = Math.min(128, Math.max(24, Math.trunc(size)));
  return `https://imagecache.365scores.com/image/upload/f_png,w_${px},h_${px},c_limit,q_auto:eco,dpr_2,d_Competitors:default1.png/v${version}/Competitors/${id}`;
}
