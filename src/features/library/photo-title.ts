/**
 * Naming an imported photo.
 *
 * The picker's `fileName` is only sometimes a name. When the player crops in the
 * picker — which this app always asks for (`allowsEditing: true`) — Android hands
 * back the *cropped copy*, whose name is a freshly minted UUID. Passing that
 * through a "tidy up the file name" pass produced titles like
 * `2c2550e4 36fc 4a2b 9e77 1f3c5d9b0e21`, which then appeared as the puzzle's
 * name on the board header, in Library, and in Puzzles.
 *
 * So the question is not "how do I tidy this string" but "is this string a name
 * at all". Anything that is plainly machine-generated is discarded in favour of
 * the caller's fallback; a real name is kept.
 */

/** `2c2550e4-36fc-4a2b-9e77-1f3c5d9b0e21`, with or without the dashes. */
const UUID = /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i;

/**
 * A long run of hex with nothing else in it — content hashes, cache keys.
 *
 * The lookahead requiring at least one digit is not decoration: `a`–`f` are
 * letters, so without it any long enough word built from them alone would be
 * thrown away as a hash. A real hash effectively always carries digits.
 */
const HEX_BLOB = /^(?=[0-9a-f]*\d)[0-9a-f]{12,}$/i;

/** Bare digits: timestamps, and the counters some galleries use. */
const DIGITS = /^\d+$/;

/**
 * Camera and screenshot conventions: `IMG_20260823_120000`, `PXL_...`,
 * `DSC01234`, `Screenshot_20260823-120000`, `image_1690000000`.
 *
 * These are not gibberish, but they are not a name the player chose either, and
 * "My photo 3" reads better on a board header than "IMG 20260823 120000".
 */
const CAMERA_PATTERN = /^(img|pxl|dsc|dcim|photo|image|screenshot|signal|whatsapp)[\W_]*[\d\W_]*$/i;

/** Longest title kept, in characters. Board headers ellipsise past this anyway. */
const MAX_LENGTH = 40;

/** Whether a picker file name (extension already stripped) names nothing. */
export function isOpaqueFileName(stem: string): boolean {
  const compact = stem.replace(/[\s_-]+/g, '');
  if (compact.length === 0) {
    return true;
  }
  return (
    UUID.test(compact) ||
    HEX_BLOB.test(compact) ||
    DIGITS.test(compact) ||
    CAMERA_PATTERN.test(stem)
  );
}

/**
 * A title for a photo the player just imported.
 *
 * `fallback` is used whenever the file name is missing or says nothing — the
 * caller passes something the player can tell apart, e.g. "My photo 3".
 */
export function titleForImportedPhoto(
  fileName: string | null | undefined,
  fallback: string,
): string {
  if (!fileName) {
    return fallback;
  }

  const stem = fileName.replace(/\.[^.]+$/, '');
  if (isOpaqueFileName(stem)) {
    return fallback;
  }

  const cleaned = stem.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  return cleaned.length > 0 ? cleaned.slice(0, MAX_LENGTH) : fallback;
}

/** The fallback itself, numbered so successive imports stay distinguishable. */
export function fallbackPhotoTitle(existingCount: number): string {
  return `My photo ${Math.max(0, existingCount) + 1}`;
}
