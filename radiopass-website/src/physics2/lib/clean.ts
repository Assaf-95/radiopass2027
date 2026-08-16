/**
 * Display-time cleaning of stem explanations.
 *
 * A handful of stems carry artefacts from the recall merge: sentences that
 * referred to how the source lines were split ("This line is completed by the
 * next stem…"), which mean nothing to a learner. Stripped at render; the data
 * files are not touched.
 */

const MERGE_ARTEFACTS = [
  /This line is completed by the next stem[^.]*\.\s*/gi,
  /This completes the previous line\.\s*/gi,
  /;?\s*the next line completes the recalled statement\.?\s*/gi,
  /This completes the recalled statement[^.]*\.\s*/gi,
]

export function cleanExplanation(text: string): string {
  let out = text
  for (const pattern of MERGE_ARTEFACTS) out = out.replace(pattern, '')
  return out.trim()
}
