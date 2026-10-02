export function buildIettHatParams(hatKodu = ''): { HatKodu: string } {
  return { HatKodu: hatKodu.trim().toLocaleUpperCase('tr-TR') };
}
