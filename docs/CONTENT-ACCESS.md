# Who can see each piece of content

Every item — every lesson, case, question, page — carries one setting that
decides who may open it. You change it in the Studio and press Publish. No
code, no deploy.

---

## The three levels

| Level | Who gets in | Use it for |
|---|---|---|
| **Anyone** (`guest`) | Everybody, signed in or not | The shop window. Sample lessons, the pages you want found by Google and shared in a WhatsApp group. |
| **Signed-in** (`free`) | Anybody with an account, paid or not | The reason to hand over an email address. Enough to be worth registering, not enough to replace subscribing. |
| **Subscribers only** (`subscriber`) | A paid plan covering that branch | Everything else. |

**New items default to Subscribers only.** That's the only safe default: an
item accidentally left free costs money quietly and nobody notices, while an
item accidentally locked is reported within the hour by the first person who
wants it.

**"Signed-in" is genuinely different from "Anyone."** One asks for an email
address and one doesn't. Free-but-registered content is how you find out who
keeps coming back — which is worth more than the page itself.

---

## Changing an item's level

1. Open [radiopass.sanity.studio](https://radiopass.sanity.studio) and sign in.
2. Open the item — a lesson, an anatomy case, a physics question, a page.
3. **Who can see this** is the first field. Pick one of the three.
4. Press **Publish**.

Live in seconds. It applies everywhere that item appears at once — the course
page, the question bank, the search results, the mock exams.

### Changing many at once

In the Studio, filter the document list to what you want, select multiple, and
set the field. For anything larger, ask me and I'll run it as a one-off script
rather than have you click 400 times.

---

## What each area does

| Area | How the level is decided |
|---|---|
| **Physics lessons** | Set on each lesson. |
| **Physics questions & mocks** | Set on each question. A mock paper is open only if the candidate can open the questions in it. |
| **Anatomy cases** | Set on each case. |
| **Structure Atlas** | **Follows the cases automatically.** The Atlas isn't stored content — it's rebuilt from the anatomy questions on every load, so a structure appears exactly when the case behind it is open to that visitor. There's nothing to set. |
| **Home, FAQs, pricing** | Set on each page, though these are almost always Anyone. |

---

## Where the rule is enforced

The app asks one function — `canAccess` — and that function is the only place
the decision is made, which is why a level behaves identically on a course
page, in the question bank and in a mock.

Two rules inside it are worth knowing because they change what you'll see:

**A level beats the branch.** Marking one page **Anyone** opens that page even
inside a branch the visitor hasn't bought. That's what makes it useful for
sampling — you don't have to give away physics to give away one physics page.

**A stranger is asked to sign in, never to upgrade.** Someone signed out who
meets a Subscribers-only page is offered a sign-in, because asking a stranger
to buy a plan before they even have an account is a door with no handle. Only
someone already signed in is asked to upgrade.

---

## An important limit — read this before pricing anything

**Right now, "Subscribers only" hides content. It does not make it
unreadable.**

The question banks are compiled into the site itself — all 429 physics
questions and 1.6 MB of anatomy cases are downloaded by every visitor as part
of the JavaScript, because that's what makes the app fast offline. Setting an
item to Subscribers only stops it being *shown*. It does not stop somebody
technical from opening their browser's developer tools and reading it.

For most of your candidates this is irrelevant — they will never look. But it
means the setting is a **product boundary, not a security boundary**, and you
should know which one you're relying on.

### Making it a real boundary

The fix is to stop shipping paid content to people who haven't paid:

1. Free and guest content stays in the site, as now — fast, and good for search
   engines.
2. Paid content moves out of the bundle and is fetched when it's opened.
3. That fetch goes through a small function on Cloudflare which checks the
   visitor's login and plan against Supabase before returning anything.

Then a visitor without a plan doesn't receive the content at all, rather than
receiving it and being asked not to look.

This is a real piece of work — it changes how questions load — and it costs a
little speed on first open. Worth doing before you take payments; not worth
blocking everything else on. Say the word and I'll scope it properly.

---

## Common questions

**I changed the level and it hasn't changed on the site.**
Hard-refresh (`Cmd+Shift+R`). If it's still wrong, check the document is
Published rather than sitting as a draft.

**Someone says they're subscribed but can't open a lesson.**
Check their plan covers that branch. Somebody who bought anatomy alone is
correctly refused physics, and the level can't override that — a level decides
*how much* access an item needs, not *which branch* it belongs to.

**I want a whole topic free for a week.**
Select those items in the Studio, set them to Anyone, publish. Set them back
afterwards. No deploy either way.

**Does the owner see everything?**
Yes. Your account bypasses every level, so what you see is never a test of what
a candidate sees. Use a private window and a test account to check that.
