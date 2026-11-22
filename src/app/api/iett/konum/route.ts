import { createLiveVehicleHandler, verifyLiveIettSession } from '@/services/iett-live';
import { getHatOtoKonum } from '@/services/iett';
import { unstable_cache } from 'next/cache';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const getCachedLiveVehicleLocations = unstable_cache(
  async (lineCode: string) => getHatOtoKonum(lineCode),
  ['iett-live-vehicle-locations-v1'],
  { revalidate: 60 },
);

const getLiveVehicleLocations = createLiveVehicleHandler({
  verifySession: verifyLiveIettSession,
  getLocations: getCachedLiveVehicleLocations,
});

export async function GET(request: Request) {
  return getLiveVehicleLocations(request);
}
