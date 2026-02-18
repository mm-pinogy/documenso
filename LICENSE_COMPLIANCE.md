# License Compliance Checklist for Documenso Fork

This document helps you verify that your fork (mm-pinogy/documenso) complies with all applicable licenses.

## Compliance Summary – What Was Done

| Requirement | Action Taken | Status |
|-------------|--------------|--------|
| **AGPL §13 – Source availability** | Added `AppFooter` component with link to `github.com/mm-pinogy/documenso` on all pages | Done |
| **AGPL §5a – Modification notice** | Added "Fork Notice" section to `README.md` stating modified version, attribution to Documenso, and AGPL v3 | Done |
| **AGPL §5d – Legal notices in UI** | `AppFooter` displays source link, AGPL v3 license link, and Documenso attribution | Done |
| **EE Commercial License** | Confirmed `NEXT_PRIVATE_DOCUMENSO_LICENSE_KEY` is blank; no EE usage in custom code (e.g. token-exchange) | Verified |

---

## Licenses in This Project

| Component | License | Location |
|-----------|---------|----------|
| **Main codebase** | GNU AGPL v3 | `LICENSE` (root) |
| **Enterprise features** | Documenso Commercial License | `packages/ee/LICENSE` |
| **Dependencies** | Various (MIT, Apache-2.0, etc.) | `package-lock.json` |

---

## 1. AGPLv3 Compliance (Main Codebase)

Your fork modifies the AGPL-licensed code. You **must** satisfy these requirements:

### ✅ Source Code Availability (Section 13 – Critical for Network Use)

**Requirement:** If users interact with your modified version over a network (e.g., sign.pinogy.com, sign-token.pinogy.com), you must **prominently offer** them a way to obtain the Corresponding Source (your modified source code).

**Checklist:**
- [x] Your modified source is publicly available (e.g., at `https://github.com/mm-pinogy/documenso`)
- [x] The app UI includes a visible link (e.g., "Source" or "View source code") that points to your repository
- [x] The link is easy for users to find (footer, about page, or settings)

**Implemented:** `AppFooter` component in `apps/remix/app/components/general/app-footer.tsx` displays source link and license info on all pages.

### ✅ Modification Notice (Section 5a)

**Requirement:** The work must carry prominent notices stating that you modified it and giving a relevant date.

**Checklist:**
- [x] Add a `NOTICE` or `CHANGES` file, or update `README.md`, stating:
  - That this is a modified version of Documenso
  - The date of your modifications (or "Modified [date]")
  - That it is based on https://github.com/documenso/documenso

**Implemented:** Fork notice added to `README.md` in the "Fork Notice" section.

### ✅ License Preservation (Section 4 & 5)

**Requirement:** Keep the LICENSE file intact. Do not remove or alter copyright notices in source files.

**Checklist:**
- [x] Root `LICENSE` file is unchanged (GNU AGPL v3)
- [x] Copyright notices in upstream files are preserved
- [x] Your new/modified files can add your copyright, but the work as a whole remains under AGPLv3

### ✅ Appropriate Legal Notices in UI (Section 5d)

**Requirement:** Interactive user interfaces should display:
1. Copyright notice
2. No warranty disclaimer
3. That the work is licensed under AGPL, and how to view the license

**Checklist:**
- [x] Add a footer or "About" section in the app with:
  - Copyright notice (original + your modifications if applicable)
  - "This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY"
  - Link to the full license: https://www.gnu.org/licenses/agpl-3.0.html
  - Link to your source code

**Implemented:** `AppFooter` provides Documenso attribution, source link, and AGPL v3 link. Full warranty disclaimer is in root `LICENSE` file.

---

## 2. Documenso Enterprise Edition (packages/ee)

The `packages/ee` directory contains features under the **Documenso Commercial License**, not AGPL.

**Requirement:** Production use of EE features requires a valid Documenso Enterprise Edition subscription.

### How to Find EE Usage

**1. Search for imports in your codebase:**

```bash
rg "@documenso/ee" -g "*.ts" -g "*.tsx"
```

Or with grep:

```bash
grep -r "@documenso/ee" --include="*.ts" --include="*.tsx" .
```

**2. Check runtime configuration:**

- If `NEXT_PRIVATE_DOCUMENSO_LICENSE_KEY` is **set** in your production `.env`: you are using EE features and need a Commercial Subscription.
- If it is **empty or unset**: the license client returns `NOT_FOUND` and enterprise features are restricted (though some EE code may still run for limits, etc.).

**3. Understand the difference:**

| Level | What it means |
|-------|---------------|
| **Code imports** | The `@documenso/ee` package is used in many places in the upstream codebase (organisation router, limits, Stripe, etc.). This is inherited from Documenso—you didn't add it. |
| **Runtime usage** | If you set a valid license key, EE features (Stripe billing, email domains, etc.) are enabled. Without a key, they are disabled or restricted. |
| **Your custom code** | If you added EE imports in your own files (e.g. `apps/token-exchange`), that would be custom. A search shows `apps/token-exchange` does **not** import EE. |

**4. Summary:**

The EE code is part of the upstream Documenso architecture. Your fork inherits it. To confirm you're not actively using EE in production:

- Ensure `NEXT_PRIVATE_DOCUMENSO_LICENSE_KEY` is **not set** (or is empty) in production.
- Run the grep above to see any EE imports you may have added; remove them if you don't have a subscription.

**Checklist:**
- N/A – Not using EE features in production
- [x] Not using EE: `NEXT_PRIVATE_DOCUMENSO_LICENSE_KEY` is unset/blank; no EE usage in custom code

**Verified (Feb 2025):** `NEXT_PRIVATE_DOCUMENSO_LICENSE_KEY` is blank in production. No EE usage in custom code (e.g. `apps/token-exchange`). EE features inherited from upstream remain disabled without a license key.

**Note:** Development and testing use of EE is allowed without a subscription per the Commercial License.

---

## 3. Third-Party Dependencies

Dependencies in `package-lock.json` have their own licenses (MIT, Apache-2.0, etc.). These are typically compatible with AGPL when used as libraries. No special action is usually required, but you can audit with:

```bash
npx license-checker --summary
```

---

## 4. Quick Verification Steps

1. **Compare your fork to upstream**
   ```bash
   git log upstream/main..HEAD --oneline
   ```
   Review that your modifications don’t introduce proprietary or incompatible code.

2. **Ensure LICENSE is present**
   ```bash
   test -f LICENSE && echo "OK" || echo "Missing LICENSE"
   ```

3. **Check for any added proprietary licenses**
   ```bash
   grep -r "proprietary\|all rights reserved" --include="*.md" --include="*.txt" . 2>/dev/null || true
   ```

4. **Confirm public source**
   - Your repo at https://github.com/mm-pinogy/documenso is public
   - It contains the full source of your modified version

---

## 5. Recommended Additions

| Item | Location | Purpose | Status |
|------|----------|---------|--------|
| Fork notice | `README.md` | Satisfy AGPL 5a (modification notice) | Done |
| Source link in UI | App footer (`AppFooter`) | Satisfy AGPL 13 (network use) | Done |
| NOTICE file | Root `NOTICE` | Optional; central place for attribution | Optional |

---

## 6. Resources

- [GNU AGPL v3 Full Text](https://www.gnu.org/licenses/agpl-3.0.html)
- [AGPL Compliance Guide (FSF)](https://www.gnu.org/licenses/quick-guide-gplv3.html)
- [Documenso Community Edition License Docs](https://docs.documenso.com/users/licenses/community-edition)
- [Documenso Enterprise](https://documenso.com) – for Commercial License inquiries

---

## Disclaimer

This checklist is for informational purposes only and does not constitute legal advice. For definitive guidance, consult a qualified attorney or your organization’s legal team.
