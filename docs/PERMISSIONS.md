# Who can do what, and how to change it

Six seats, across three systems that each have their own idea of permissions.
This explains what each seat means, where it is actually enforced, and the exact
steps to invite somebody, change their role, or cut them off.

---

## The six seats

| Seat | Content | People | Staging | The one-line version |
|---|---|---|---|---|
| **Owner** (you) | everything | everything | yes | Full control. Only you can hand ownership on. |
| **Administrator** | everything | invite, change, remove | yes | Runs the place day to day. Cannot remove you. |
| **Senior editor** | draft, publish, delete | — | yes | Writes and ships lessons, cases, questions. |
| **Reviewer** | read drafts, comment | — | yes | Says what's wrong. Cannot publish or delete. |
| **Contributor** | draft, comment | — | yes | Writes. Someone else decides when it goes live. |
| **Beta tester** | — | — | yes | Uses the staging site as a candidate. No CMS at all. |

Three deliberate lines in that table:

**Publishing is the boundary.** Reviewer and contributor sit below it. That is
the whole reason those two seats exist — a contributor can be given real work
without any risk that half-finished writing reaches a candidate.

**Deleting is separated from publishing.** Undoing is not the same power as
doing. Somebody who can unpublish can take the site down.

**An administrator cannot remove the owner.** Without that line "administrator"
quietly *is* "owner", and you could be locked out of your own product by
somebody you invited.

---

## Where it is actually enforced

A role system that lives only in the interface is theatre — anybody can edit
JavaScript in their own browser. So each rule is enforced three times, in
places a browser cannot argue with:

| Layer | What it decides | Where |
|---|---|---|
| **The app** | what buttons you are *offered* | `src/lib/roles.ts` |
| **Supabase** | what the database *allows* | `docs/sql/permissions.sql` |
| **Sanity** | who may open the CMS at all | Sanity project members |

Editing the first wins you nothing but buttons that fail. That's intentional,
and it's the same rule the existing admin check already follows.

---

## Staging and production

Two of everything, so testers and half-finished content never touch the live
site.

| | Production | Staging |
|---|---|---|
| Site | `radiopass.co.uk` | `staging.radiopass.co.uk` |
| Built from | branch `main` | branch `staging` |
| Sanity dataset | `production` | `staging` |
| Supabase | your live project | a second project |
| Who can reach it | everyone | signed-in testers only |

**Why a separate Supabase project rather than a flag.** Candidates' real
progress and real accounts live in the production database. A tester who
deletes something, or a broken migration run against the wrong project, must
not be able to touch it. Two projects makes that a physical impossibility
rather than a rule someone has to remember.

**Why a separate Sanity dataset rather than a separate project.** The same
people edit both, so the same logins should work. Datasets are the level Sanity
separates content at, and switching between them is a dropdown.

### Setting staging up, once

1. **Branch.** `git checkout -b staging && git push -u origin staging`
2. **Cloudflare.** In your Pages project → **Settings → Builds** →
   add `staging` as a preview branch. Give it its own environment variables
   pointing at the staging Supabase project and the `staging` Sanity dataset.
3. **Sanity.** `sanity dataset create staging`, then
   `sanity dataset copy production staging` to seed it with real content.
4. **Supabase.** Create a second project. Run `docs/sql/permissions.sql` in it.
5. **Lock the door.** Cloudflare → **Zero Trust → Access → Applications** → add
   `staging.radiopass.co.uk`, policy "allow specific email addresses". This is
   what makes a beta tester's access real and revocable: they get a one-time
   code by email, and removing them removes it.

---

## Inviting somebody

There are two halves, and which you need depends on the seat. **Beta testers
need only the first. Everyone else needs both.**

### A. Give them the site (all seats)

1. Ask them to create an account at the site itself — production for staff,
   `staging.radiopass.co.uk` for testers. They sign up normally; you never
   handle their password.
2. In Supabase → **SQL Editor**, give them their seat:

```sql
insert into public.entitlements (user_id, grants, role)
select id, '["account","full"]'::jsonb, 'contributor'
from auth.users where email = 'them@example.com'
on conflict (user_id) do update
  set role = excluded.role, grants = excluded.grants;
```

Change `'contributor'` to the seat you want. For a beta tester use
`'beta-tester'` and grants `'["account","full"]'` — testers need to see
everything in order to test it.

3. **Beta testers only:** add their email in Cloudflare → **Zero Trust →
   Access** so they can reach staging at all.

### B. Give them the CMS (everyone except beta testers)

Sanity → [manage.sanity.io](https://manage.sanity.io) → your project →
**Members** → **Invite member** → their email → pick the Sanity role:

| Our seat | Sanity role |
|---|---|
| Owner, Administrator | Administrator |
| Senior editor | Editor |
| Contributor | Contributor |
| Reviewer | Viewer |
| Beta tester | **do not invite** |

**A caveat worth knowing before you plan around it.** Sanity's free plan only
offers the coarser roles — in practice Administrator and Viewer. Editor,
Contributor and any custom role are paid-plan features, and the exact split
changes, so check the current tiers on their pricing page rather than trusting
this table. Until you are on a plan that supports them, the finer distinctions
between senior editor, contributor and reviewer are enforced by Supabase and by
Cloudflare, but *not* inside the Sanity interface itself — a contributor there
may be able to press Publish. If that matters to you before you upgrade, keep
contributors out of Sanity and have them send you drafts.

---

## Changing somebody's role

One line, in the Supabase SQL Editor:

```sql
update public.entitlements e
set role = 'senior-editor'
from auth.users u
where u.id = e.user_id and u.email = 'them@example.com';
```

Then change their Sanity role to match, in **Members**.

**Both halves, or the change is half-made.** Supabase decides what the app lets
them do; Sanity decides what the CMS lets them do. Demoting somebody in one
place and not the other leaves them holding the higher power in the other.

The database will refuse to make somebody an owner unless *you* are the owner —
that rule is in the policy, not just in the interface.

---

## Removing access

In this order, because the first step is the one that matters most:

1. **Sanity** → **Members** → **Remove**. They lose the CMS immediately.
2. **Supabase** → SQL Editor:

```sql
update public.entitlements e
set role = null, grants = '["account"]'::jsonb
from auth.users u
where u.id = e.user_id and u.email = 'them@example.com';
```

   This takes away the seat and the content, and leaves the account intact.
   Prefer it to deleting the row: deleting loses the record that they ever had
   access, which is exactly what you want to be able to look up later.

3. **Cloudflare** → **Zero Trust → Access** → remove their email, if they were a
   tester.

4. **If you are worried**, Supabase → **Authentication → Users** → their row →
   **Sign out user**. Otherwise an already-issued session can keep working until
   it expires on its own.

To remove somebody completely, including their account, delete them under
**Authentication → Users**. Their progress goes with them and does not come
back.

---

## Common questions

**Somebody was promoted but still can't do the thing.**
Their session is carrying the old role. Have them sign out and back in.

**A contributor can publish in Sanity.**
Sanity's plan doesn't support the finer roles yet — see the caveat above. The
app and the database still refuse them; it's the Sanity interface that's
permissive.

**Can I have two owners?**
No, and that's enforced by a unique index, not by convention. Two owners means
two people who can each remove the other. If you want somebody to have that
much, make them an administrator; if you want to hand the product over, change
your own row last.

**A tester can reach the live site.**
Check they signed up on `staging.` and that Cloudflare Access is applied to the
staging hostname. Access being off is the usual cause — nothing else stops
anyone reaching a public URL.
