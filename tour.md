# RMS Guided Tours (“Take a tour”) — Deep Scan + Handoff Bundle

This document captures **everything needed** to replicate the exact “Take a tour” feature from this RMS project into another Next.js app (e.g., your School Management System): **library**, **providers wiring**, **UI entry points**, **tour registration**, **step definitions**, **events/listeners**, and **copy checklist**.

---

## What the feature does (user flow)

- User opens the **profile dropdown** and clicks **“Take a tour”**.
- A **Guided Tours modal** opens showing multiple tour “cards” (POS, Menu, Kitchen, Inventory, etc.).
- Clicking a card:
  - stores a **return path** in `zustand` (so skip/complete can navigate back),
  - navigates to the tour’s `startRoute` if needed,
  - then starts the tour by calling `startNextStep(tourName)`.
- The tour engine (NextStep) shows a **custom Mantine-styled tour card** and highlights elements using **DOM selectors** like `#tour-pos-cart`, `[data-tour-target="..."]`, etc.
- During step changes / skip / completion:
  - pages may be forced into deterministic UI states (close modals, clear search, reset filters),
  - a “re-open tours modal” request can be triggered so the modal pops again.
- On first login, the “tours modal” **auto-opens once** (unless the user already saw it before).

---

## Core library used

- **Tour library**: `nextstepjs` (React guided tours)
  - Used via `useNextStep`, `NextStepProvider`, `NextStep`, and types `Tour`, `Step`.
  - Declared in `frontend/package.json` as `"nextstepjs": "^2.2.0"`.

---

## The three “roots” you must replicate

### 1) “Engine mount”: global `NextStepRoot` wrapper

Mounted once for the whole app in:

- `frontend/src/components/providers/Providers.tsx`
  - wraps app with `<NextStepRoot> ... {children} ... </NextStepRoot>`
  - also imports Mantine styles: `@mantine/core/styles.css`, `@mantine/notifications/styles.css`, `@mantine/dates/styles.css`

The tour engine itself lives in:

- `frontend/src/components/onboarding/NextStepRoot.tsx`
  - creates `<NextStepProvider><NextStep ...>{children}</NextStep></NextStepProvider>`
  - injects:
    - `steps={allGuidedTourSteps}`
    - `cardComponent={OnboardingTourCard}`
    - overlay/shadow config and **zIndex** alignment with Mantine modals
  - implements all tour lifecycle hooks:
    - `onStart`
    - `onStepChange`
    - `onSkip`
    - `onComplete`

### 2) UI entry point: “Take a tour” in profile dropdown

- `frontend/src/components/layout/UserMenu.tsx`
  - `Menu.Item` labeled **“Take a tour”** opens `OnboardingToursModal`
  - also includes **auto-open logic** on login using `sessionStorage` key `rms_show_tours_modal`

### 3) Tours launcher modal (cards list)

- `frontend/src/components/onboarding/OnboardingToursModal.tsx`
  - reads tour definitions from `getTourLauncherDefinitions()`
  - on tour selection:
    - sets return path in `useOnboardingStore`
    - closes the modal (also updates `onboarding_seen_tours_modal` via `authApi.updateProfile`)
    - navigates to `startRoute` if needed
    - starts `startNextStep(tour.tourName)` with a timed delay (100–450ms)

---

## Files involved (copy bundle)

If you want the other project to replicate this **exactly**, copy these files (and then adjust selectors/routes to match your new UI).

### A) Entry point + modal + card

- `frontend/src/components/layout/UserMenu.tsx`
- `frontend/src/components/onboarding/OnboardingToursModal.tsx`
- `frontend/src/components/onboarding/NextStepRoot.tsx`
- `frontend/src/components/onboarding/OnboardingTourCard.tsx`

### B) Store (tour state + UI synchronization)

- `frontend/src/lib/store/onboarding-store.ts`

This store is the backbone for:
- “active tour” flags
- dummy-data flags per tour
- step index tracking for multi-tab pages
- “close modal” nonces
- “return path” plumbing
- request to reopen the tours modal (`openToursModalRequested`)

### C) Guided tour “framework” module

- `frontend/src/features/guided-tours/index.ts`
- `frontend/src/features/guided-tours/README.md`
- `frontend/src/features/guided-tours/constants.ts`
- `frontend/src/features/guided-tours/types/tour.types.ts`
- `frontend/src/features/guided-tours/tours/allTourSteps.ts`
- `frontend/src/features/guided-tours/tours/tourLaunchers.tsx`
- `frontend/src/features/guided-tours/tours/registry.ts`
- `frontend/src/features/guided-tours/utils/interactiveTitle.ts`
- `frontend/src/features/guided-tours/utils/tourDomHelpers.ts`
- `frontend/src/features/guided-tours/utils/modalManager.ts`

### D) Tour step definitions (NextStep `Tour[]`)

All are in `frontend/src/components/onboarding/`:

- `newOrderTourSteps.tsx`
- `menuTourSteps.tsx`
- `kitchenTourSteps.tsx`
- `inventoryTourSteps.tsx`
- `recipeTourSteps.tsx`
- `deliveryTourSteps.tsx`
- `couponTourSteps.tsx`
- `employeesTourSteps.tsx`
- `customersTourSteps.tsx`
- `reportsTourSteps.tsx`
- `settingsTourSteps.tsx`

### E) Pages that *listen* to guided-tour events (important!)

The tours can dispatch window events to reset React state. These listeners must exist or the tour will feel “broken”:

- `frontend/src/features/inventory/components/RecipesPage.tsx` (listens: `recipeTourClearSearch`)
- `frontend/src/features/inventory/components/StockManagementPage.tsx` (listens: `inventoryStockTourClearFilters`)
- `frontend/src/features/inventory/components/IngredientsPage.tsx` (listens: `inventoryIngredientsTourClearFilters`)
- `frontend/src/features/coupons/components/CouponsPage.tsx` (listens: `couponTourClearSearch`)
- `frontend/src/features/employees/components/EmployeesPage.tsx` (listens: `employeesTourClearFilters`)
- `frontend/src/features/customers/components/CustomersPage.tsx` (listens: `customersTourClearSearch`)
- `frontend/src/app/portal/delivery/page.tsx` (listens: `deliveryTourClearFilters`)

In the other project, you’ll either copy these patterns or remove the event dispatches from the tour helpers.

---

## Where tours are registered / aggregated

### The single steps array passed to NextStep

- `frontend/src/features/guided-tours/tours/allTourSteps.ts`
  - exports `allGuidedTourSteps`
  - merges all `*TourSteps.tsx` arrays into one `Tour[]`

### The tour launcher cards list

- `frontend/src/features/guided-tours/tours/tourLaunchers.tsx`
  - `getTourLauncherDefinitions()` returns the modal cards:
    - `key`
    - `title`, `badge`, `badgeIcon`
    - `available`
    - `startRoute`
    - `tourName` (must match the step definitions’ `tour`)

---

## First-login auto-open behavior

### Session flag set at login/callback

- Set on successful login:
  - `frontend/src/app/(auth)/login/page.tsx` sets `sessionStorage.setItem('rms_show_tours_modal', '1')`
- Set on successful OAuth callback:
  - `frontend/src/app/auth/callback/page.tsx` sets the same flag after user is stored.

### Consumed in profile menu

- `frontend/src/components/layout/UserMenu.tsx`:
  - checks `sessionStorage.getItem('rms_show_tours_modal') === '1'`
  - removes it immediately (so refresh doesn’t re-open)
  - opens `OnboardingToursModal` only if user profile field `onboarding_seen_tours_modal !== true`

### Persisted “seen modal” flag

- The modal close handler updates the user profile:
  - `frontend/src/components/onboarding/OnboardingToursModal.tsx` calls `authApi.updateProfile({ onboarding_seen_tours_modal: true })`
  - This makes the first-login auto-open a “once ever” behavior per user.

---

## How skipping/completing returns to the modal

- `frontend/src/components/onboarding/NextStepRoot.tsx`:
  - on `onSkip` and `onComplete`, it calls `requestOpenToursModal()`
- `frontend/src/lib/store/onboarding-store.ts`:
  - `openToursModalRequested` boolean
- `frontend/src/components/layout/UserMenu.tsx`:
  - watches `openToursModalRequested` in an effect and opens `OnboardingToursModal`

This is why the tours modal can “pop back open” after you finish/skip a tour.

---

## Guided-tour DOM events (React state synchronization)

### Event names

Defined in:
- `frontend/src/features/guided-tours/constants.ts` → `GUIDED_TOUR_EVENTS`

Events used:
- `recipeTourClearSearch`
- `deliveryTourClearFilters`
- `couponTourClearSearch`
- `inventoryStockTourClearFilters`
- `inventoryIngredientsTourClearFilters`
- `employeesTourClearFilters`
- `customersTourClearSearch`

### Where they are dispatched

Dispatched from:
- `frontend/src/features/guided-tours/utils/tourDomHelpers.ts`

Examples:
- `clearRecipeSearchInput()` clears the DOM input and dispatches `recipeTourClearSearch`
- `resetDeliveryTourFilters()` dispatches `deliveryTourClearFilters`
- `clearCouponSearchInput()` clears the DOM input and dispatches `couponTourClearSearch`

### Where they are listened to

Examples:
- Recipes: `frontend/src/features/inventory/components/RecipesPage.tsx`
- Stock filters: `frontend/src/features/inventory/components/StockManagementPage.tsx`
- Delivery: `frontend/src/app/portal/delivery/page.tsx`
- Coupons: `frontend/src/features/coupons/components/CouponsPage.tsx`

If you replicate this into a different app, you must either:
- implement equivalent listeners to clear search/filters in React state, or
- remove the dispatch/listener mechanism and rely on the tour card instructions only.

---

## Critical “selector contract” (why replication isn’t just copying files)

Every tour step that highlights UI depends on `selector` fields like:

- `#tour-pos-category-filter`
- `#tour-pos-cart`
- `#tour-kitchen-section-preparing`
- `#tour-dashboard-revenue-chart`
- `[data-tour-target="tour-menu-tab-menus"]`

These are not magic—**they must exist in your DOM**. In this project, most of these IDs/attributes are embedded directly in feature pages/components.

### What to do in the other project

- Pick the tours you want (maybe only 1–2 initially).
- For each step:
  - ensure the element exists
  - add the exact `id="..."` or `data-tour-target="..."` attribute
  - ensure the element is visible at the time the step runs (sometimes the tour forces scroll/resize for this)

If you want *pixel-perfect identical behavior*, you’ll likely need to port the same UI structure or at least the same DOM anchors.

---

## Dependencies to install in the other project

### Required

- `nextstepjs`

### Already used here (tour UI assumes these patterns)

The tour “card component” and modal are Mantine-based here; for an exact clone, your other project should also use:
- `@mantine/core`
- `@mantine/modals`
- `@mantine/notifications`
- `@mantine/dates`

Also used for icons:
- `@tabler/icons-react`

If your other project does not use Mantine, you can still use `nextstepjs`, but you’ll need to rewrite:
- `OnboardingTourCard.tsx`
- `OnboardingToursModal.tsx`
- some zIndex alignment assumptions in `NextStepRoot.tsx`

---

## Exact wiring points (minimal checklist)

### 1) Add the provider mount

- Wrap your app root with a `NextStepRoot` equivalent.
- Ensure it is above all routes/pages that need the tours.

This project does it in:
- `frontend/src/components/providers/Providers.tsx`

### 2) Add the “Take a tour” entry

- Add a menu item that opens `OnboardingToursModal`.
- This project does it in:
  - `frontend/src/components/layout/UserMenu.tsx`

### 3) Add the launcher modal

- Implement the cards list (from `getTourLauncherDefinitions()`).
- Start the tour via `startNextStep(tourName)`.

### 4) Include steps and the NextStep mount

- Aggregate all `Tour[]` and pass them to `<NextStep steps={...} />`.
- This project uses:
  - `frontend/src/features/guided-tours/tours/allTourSteps.ts`

### 5) Implement store behaviors (optional but “exact”)

If you want identical robustness:
- implement the `zustand` onboarding store state:
  - active tour flags
  - step index tracking
  - “close modal” nonces
  - return-path fields
  - dummy data toggles (if you want tours to work without real data)

---

## Notes about “dummy data” tour mode

Several tours switch pages into “dummy/in-memory” mode so the UI is deterministic even if the real database is empty. This is coordinated by:

- `useOnboardingStore().startTour(tourName)` which sets flags like:
  - `usePosDummyData`
  - `useMenuDummyData`
  - `useInventoryDummyData`
  - `useRecipeDummyData`
  - `useDeliveryDummyData`
  - `useCouponsDummyData`
  - `useReportsDummyData`

And then the feature pages load dummy lists from places like:
- `frontend/src/features/coupons/onboarding/couponOnboardingDummyData.ts`
- `frontend/src/features/inventory/onboarding/recipeOnboardingDummyData.ts`
- `frontend/src/features/delivery/onboarding/deliveryOnboardingDummyData.ts`
- (and others seen in `frontend/src/features/*/onboarding/`)

If your school system does not have these pages/data models, you can skip dummy mode entirely, but then tours may fail if selectors rely on “first row” items existing.

---

## Practical migration strategy (recommended)

To replicate “exactly” but safely:

1) **Port the platform layer first**
   - `Providers` → mount `NextStepRoot`
   - `OnboardingStore`
   - `OnboardingToursModal` + `OnboardingTourCard`
   - `guided-tours` utilities

2) **Port ONE tour** (e.g., a Dashboard tour) and add the needed `id` / `data-tour-target` anchors.

3) Add event listeners only if needed (search/filter reset).

4) Expand to more tours.

---

## Quick reference: most important files

- **Entry point**: `frontend/src/components/layout/UserMenu.tsx`
- **Launcher modal**: `frontend/src/components/onboarding/OnboardingToursModal.tsx`
- **Tour engine mount**: `frontend/src/components/onboarding/NextStepRoot.tsx`
- **Tour card UI**: `frontend/src/components/onboarding/OnboardingTourCard.tsx`
- **Tour steps list**: `frontend/src/features/guided-tours/tours/allTourSteps.ts`
- **Tour launchers**: `frontend/src/features/guided-tours/tours/tourLaunchers.tsx`
- **Store**: `frontend/src/lib/store/onboarding-store.ts`
- **Events**: `frontend/src/features/guided-tours/constants.ts`
- **DOM helpers**: `frontend/src/features/guided-tours/utils/tourDomHelpers.ts`

