const turkishMojibakePairs = [
  ['Ã‡', 'Ç'],
  ['Ã§', 'ç'],
  ['Äž', 'Ğ'],
  ['Ä\u009e', 'Ğ'],
  ['ÄŸ', 'ğ'],
  ['Ä\u009f', 'ğ'],
  ['Ä°', 'İ'],
  ['Ä±', 'ı'],
  ['Ã–', 'Ö'],
  ['Ã\u0096', 'Ö'],
  ['Ã¶', 'ö'],
  ['Åž', 'Ş'],
  ['Å\u009e', 'Ş'],
  ['ÅŸ', 'ş'],
  ['Å\u009f', 'ş'],
  ['Ãœ', 'Ü'],
  ['Ã\u009c', 'Ü'],
  ['Ã¼', 'ü'],
] as const;

/** Repairs the known one-pass UTF-8/Windows-1252 corruption in legacy İETT text fields. */
export function repairTurkishMojibake(value: string): string {
  let repaired = value;
  for (const [broken, correct] of turkishMojibakePairs) {
    repaired = repaired.replaceAll(broken, correct);
  }
  return repaired;
}
