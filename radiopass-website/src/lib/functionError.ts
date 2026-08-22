/* Read what an Edge Function actually said.
 *
 * supabase-js does not put the function's response body on error.message — it
 * puts a generic "Edge Function returned a non-2xx status code" there and
 * hangs the real Response off error.context. Code that throws error.message
 * therefore shows the buyer, and the developer, a sentence containing no
 * information at all.
 *
 * That cost most of a day: the function was returning a perfectly clear
 * "This plan has no Stripe price configured yet", and neither the page nor the
 * logs I could reach ever showed it. The fix is small and the failure it
 * prevents is not.
 */

export async function functionErrorMessage(error: unknown, fallback: string): Promise<string> {
  const ctx = (error as { context?: unknown } | null)?.context
  if (ctx instanceof Response) {
    try {
      const body = await ctx.clone().json()
      const msg = (body as { error?: string; message?: string })?.message
        ?? (body as { error?: string })?.error
      if (typeof msg === 'string' && msg.trim()) return msg
    } catch {
      try {
        const text = (await ctx.clone().text()).trim()
        if (text) return text.slice(0, 300)
      } catch { /* body already consumed */ }
    }
    return `${fallback} (HTTP ${ctx.status})`
  }
  const m = (error as { message?: string } | null)?.message
  /* The generic sentence is worse than the fallback — it names no cause. */
  if (typeof m === 'string' && m && !/non-2xx status code/i.test(m)) return m
  return fallback
}
