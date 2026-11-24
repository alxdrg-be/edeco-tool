/** A filename supplies a tentative index. Unlabelled values are recognised only in the edeco naming convention. */
export function filenameIndex(filename: string): string {
  const stem = filename.replace(/\.pdf$/iu, "");
  const labelled = stem.match(/(?:^|[-_\s])(?:index|revision|rev\.?)\s*[-_]?\s*([a-z\d]{1,5})(?=$|[-_\s])/iu);
  if (labelled) return labelled[1];
  const standard = stem.match(/^\d+_[A-Z]+-[A-Z]+-[A-Z\d]+-(?:[A-Z]{1,3}\d*)-([A-Z]|\d{1,2})-\d+(?:-\d{4}-\d{2}-\d{2})?$/iu);
  return standard?.[1] ?? "";
}

export function compareDeliveryIndex(target: string, file: string) {
  if (!file.trim()) return "Datei-Index fehlt";
  if (!target.trim()) return "Ohne Sollwert";
  return target.trim() === file.trim() ? "Stimmt überein" : "Index weicht ab";
}
