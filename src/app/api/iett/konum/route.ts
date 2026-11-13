import { createLiveVehicleHandler, verifyLiveIettSession } from '@/services/iett-live';
import { getHatOtoKonum } from '@/services/iett';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const getLiveVehicleLocations = createLiveVehicleHandler({
  verifySession: verifyLiveIettSession,
  getLocations: getHatOtoKonum,
});

export async function GET(request: Request) {
  return getLiveVehicleLocations(request);
}
