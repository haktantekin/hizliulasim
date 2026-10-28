import type { MinibusCachedData } from './minibusData.ts';

export async function loadMinibusDetailWithFallback(
  cmsData: MinibusCachedData | null,
  loadOfficial: () => Promise<MinibusCachedData>,
  onOfficialError?: (error: unknown) => void,
): Promise<MinibusCachedData | null> {
  if (cmsData) return cmsData;

  try {
    return await loadOfficial();
  } catch (error) {
    onOfficialError?.(error);
    return null;
  }
}
