# R Quotas - Professional Job Estimator

## Overview
R Quotas is a professional job estimator for carpentry/construction businesses. Multi-tenant architecture with companies, hierarchical trades/specialties service catalog, job assignments with address release controls, and bilingual support (EN/PT, default English).

## Recent Changes
- 2026-02-08: HouseClean Schedule page at /schedule: week/month calendar views, job cards with address Maps links, door codes, assignments
- 2026-02-08: Browser notification for daily schedule reminder at 9PM (checks tomorrow's jobs, requires user opt-in)
- 2026-02-08: Schedule navigation link added to main nav bar with CalendarDays icon
- 2026-02-08: Owner/Admin Employee Management in Settings: employee list with active/inactive toggle, invite link generation
- 2026-02-08: Invite Employee system: POST /api/invite/create generates 7-day expiring tokens, GET /api/invite/list shows token status
- 2026-02-08: Public signup via invite link: /signup/:token route bypasses auth, validates token, creates account with auto-company assignment
- 2026-02-08: DB-backed role system: users.globalRole column (user/support_admin/super_admin); seed sets mateus/admin/admin_test as support_admin
- 2026-02-08: Support Admin allowlist updated to (mateus, admin, admin_test); isSupportAdmin checks both globalRole DB column and username allowlist
- 2026-02-08: "admintest" renamed to "admin_test" in test accounts seed; brother (OWNER) explicitly excluded from support admin
- 2026-02-08: Support Panel enhanced: Create Test User form, Generate Signup Link action (support-admin only)
- 2026-02-08: invite_tokens schema table: token, companyId, createdBy, role, expiresDays, expiresAt, usedAt, usedBy
- 2026-02-08: API routes: /api/invite/create, /api/invite/validate/:token, /api/invite/signup/:token, /api/invite/list, /api/employees, /api/employees/:userId/active
- 2026-02-08: requireSupportAdmin middleware for server-side enforcement; isSupportAdmin flag in auth responses
- 2026-02-08: Visual UI overhaul: premium SaaS look with professional stock images, redesigned logo, hero sections, and polished layouts
- 2026-02-08: Dashboard hero: dedicated hero-dashboard.jpg image with gradient-to-top overlay, primary "New Job" button, color-coded stat card icons
- 2026-02-08: Login page: hero image background with dark gradient, logo centered over image, login card with shadow
- 2026-02-08: Onboarding page: each trade is a separate Card with image banner header, specialty buttons in card body
- 2026-02-08: Logo redesign: architectural roof-line + center beam, "RQ" text below, supports dark/light variant
- 2026-02-08: New professional stock images for all trades (carpentry, painting, tile, house_cleaning) and specialties
- 2026-02-08: getHeroDashboardImage() function added to trade-images.ts
- 2026-02-08: Fixed /api/specialties endpoint returning only company-scoped specialties; now returns ALL specialties for onboarding
- 2026-02-08: Fixed multi-tenant data contamination: seed cleanup removes stale cross-company user assignments
- 2026-02-07: Support Panel page at /support: search users by login, view permissions/specialties, reset password, rename, activate/deactivate, edit carpentry specialties
- 2026-02-07: Support Panel accessible by ADMIN, OWNER, SUPPORT roles; USER sees access denied
- 2026-02-07: API routes: GET /api/support/users/search, PUT /api/support/users/:userId/rename, PUT /api/support/users/:userId/active, GET/PUT /api/support/users/:userId/specialties
- 2026-02-07: isUserInCompany() method for proper multi-tenant security checks in support routes
- 2026-02-07: Trade/specialty background images: hero banners on Dashboard, JobEditor, OnboardingSpecialties with dark overlay for text legibility
- 2026-02-07: trade-images.ts utility: getTradeImage(slug), getSpecialtyImage(slug, tradeSlug), getHeroDashboardImage() for image mapping
- 2026-02-07: Auth response now includes tradeSlug field for company trade identification
- 2026-02-07: Enterprise Premium UI overhaul: light backgrounds (#f1f2f5), white cards, dark topbar header, subtle borders/shadows
- 2026-02-07: AppShell layout: dark fixed topbar with RQ logo + user badge, light content area, 3-button mobile bottom bar (Jobs, New Quote, Settings)
- 2026-02-07: CSS custom property --topbar/--topbar-foreground for dark header, semantic light tokens for all other surfaces
- 2026-02-07: Regional Pricing + Photo Estimate V1: regions table (MA, RI), pricing_rules table with JSONB multipliers, estimate_photos table
- 2026-02-07: Anchor-high pricing strategy: base_price × 1.15 × material_mult × complexity_mult; material tiers (basic/standard/premium), complexity (normal/hard)
- 2026-02-07: Photo Estimate dialog in JobEditor services step with live price calculation, formula breakdown, price range display
- 2026-02-07: Region selector on Settings page (admin/owner only) with regionId stored in company_settings
- 2026-02-07: API routes: /api/regions, /api/pricing-rules (GET/POST/PUT), /api/estimate-photos (POST/GET)
- 2026-02-07: useRegions() and usePricingRules() hooks in use-catalog.ts
- 2026-02-07: Settings update route now validates request body with insertCompanySettingsSchema
- 2026-02-07: Onboarding specialty selection flow: users with no specialties selected are redirected to specialty picker before entering the app
- 2026-02-07: /api/auth/me and /api/auth/login now return needsOnboarding flag based on user_specialties count
- 2026-02-07: OnboardingSpecialties page at client/src/pages/OnboardingSpecialties.tsx
- 2026-02-07: Permission keys updated to: canManageUsers, canViewAllSpecialties, canViewPrices, canEditPrices, canAudit
- 2026-02-07: Restructured from 8-trade flat model to 4-trade hierarchical model with specialties
- 2026-02-07: 4 trades: Carpentry, Painting, Tile, House Cleaning (slug-based: carpentry, painting, tile, house_cleaning)
- 2026-02-07: 9 carpentry specialties: Finish, Deck, Stairs, Doors, Windows, Baseboard/Trim, Floor, Frame, Roof + 3 general specialties for painting/tile/house_cleaning
- 2026-02-07: Specialty management in Settings: admin/owner can assign/remove specialties per user via toggle buttons
- 2026-02-07: API routes: PUT /api/admin/users/:userId/specialties, GET /api/admin/users/:userId/specialties
- 2026-02-07: Services columns renamed: unit→pricingUnit (text, default 'EA'), price→unitPrice (numeric(10,2), dollars not cents)
- 2026-02-07: Services schema restructured: companyId (multi-tenant), specialtyId (NOT NULL), pricingUnit, unitPrice (dollars), description, active; removed tradeId/priceMin/priceMax/priceDefault/notes/isExtra
- 2026-02-07: specialties table (id, tradeId, slug, name) with user_specialties junction table
- 2026-02-07: Services have tradeId (required) + specialtyId (optional, for carpentry sub-categorization)
- 2026-02-07: Jobs have tradeId (required) + specialtyId (optional, for carpentry)
- 2026-02-07: Companies have tradeId FK (replaces old tradeType text column)
- 2026-02-07: trades table uses slug column (not code)
- 2026-02-07: API endpoints: /api/specialties, /api/trades/:tradeId/specialties, /api/specialties/:specialtyId/services
- 2026-02-07: useSpecialties() and useServicesBySpecialty() hooks added
- 2026-02-07: JobEditor shows specialty selector for carpentry jobs, filters services by specialty
- 2026-02-07: 12 tables total (added specialties, user_specialties); 6 carpentry specialties replacing old 5
- 2026-02-07: Complete database restructure: 12 tables (companies, company_users, trades, specialties, user_specialties, services, jobs, job_items, job_assignments, company_settings, audit_log, users)
- 2026-02-07: Multi-tenant via companies + company_users junction table
- 2026-02-07: SUPPORT role added: can reset passwords and see user list, but sees zero jobs/services/estimates
- 2026-02-07: isGlobalAdmin disabled - no cross-company access for any role
- 2026-02-07: All roles (OWNER, ADMIN, USER, SUPPORT) are company-scoped only
- 2026-02-07: Support routes: POST /api/support/reset-password, GET /api/support/users
- 2026-02-07: Password reset endpoint enforces same-company scope for all roles
- 2026-02-07: Uppercase roles throughout: OWNER, ADMIN, USER, SUPPORT
- 2026-02-07: Expanded job statuses: DRAFT, SENT, APPROVED, SCHEDULED, IN_PROGRESS, DONE
- 2026-02-07: Per-company settings with taxRate, overheadRate, profitRate
- 2026-02-07: Granular employee permissions system: 7 permission flags per job assignment
- 2026-02-07: capPermissions() utility: effective permissions = job permissions AND company permissions (company is ceiling)
- 2026-02-07: Server-side injection of companyId/createdBy/tradeId (omitted from client schema)

## Architecture

### Backend
- Express server on port 5000
- PostgreSQL via Drizzle ORM
- Tables: companies, company_users, users, trades, specialties, user_specialties, services, jobs, job_items, job_assignments, company_settings, audit_log
- Routes: /api/jobs, /api/jobs/:id, /api/trades, /api/specialties, /api/trades/:tradeId/specialties, /api/specialties/:specialtyId/services, /api/trades/:tradeId/services, /api/services, /api/settings, /api/auth/*, /api/jobs/:id/assignments, /api/users, /api/support/*
- Access control: company-scoped queries via company_users membership
- Auth: express-session + connect-pg-simple, bcrypt password hashing

### Frontend
- React + Vite + TypeScript
- TanStack Query for data fetching
- Shadcn/UI components
- wouter for routing
- jsPDF for PDF generation
- Dark premium theme (green accent on dark background)

### Pages
- `/` - Dashboard (job list with stat cards, status filters)
- `/jobs/new` - New Job (4-step wizard: Job Info, Services, Summary, PDF)
- `/jobs/:id` - Edit Job (4-step wizard)
- `/stairs` - Stair Calculator
- `/settings` - App settings (language toggle for all; admin config for ADMIN/OWNER)
- `/support` - Support Panel (ADMIN/OWNER/SUPPORT only: user search, password reset, rename, activate/deactivate, edit specialties)

### Key Files
- `shared/schema.ts` - Drizzle tables and types (12 tables)
- `shared/routes.ts` - API contract definitions (jobs, trades, specialties, services, settings)
- `server/routes.ts` - Express route handlers + auth + seed data
- `server/storage.ts` - Database storage layer (company-scoped access control)
- `client/src/pages/JobEditor.tsx` - Wizard job editor + PDF generation
- `client/src/pages/Dashboard.tsx` - Dashboard with stat cards and job list
- `client/src/components/Navigation.tsx` - Top nav with R Quotas branding
- `client/src/hooks/use-catalog.ts` - useTrades(), useServices(), useSpecialties(), useServicesBySpecialty() hooks
- `client/src/hooks/use-auth.ts` - Auth context (isAdmin, isOwner, isAdminOrOwner)
- `client/src/lib/i18n.ts` - Bilingual strings (EN/PT)
- `client/src/lib/trade-images.ts` - Trade/specialty image mapping utility
- `client/src/pages/SupportPanel.tsx` - Support panel for user management (ADMIN/OWNER/SUPPORT)

### Trades & Specialties
- **Carpentry** (trade, slug: carpentry) - 9 specialties:
  - Baseboard / Trim (9 services): Baseboard, Crown Molding, Door/Window Trim, Ext Trim, Gable, Shiplap/Bigboard Ext
  - Doors (6 services): Interior/Exterior Door Install, Door Jamb Extensions
  - Windows (5 services): Window Install, Window Complete, Window Jamb Extensions
  - Stairs (9 services): Treads, Risers, Skirts, Handrails, Brackets
  - Finish Carpentry (15 services): Shiplap, Ceilings, Kitchen Cabinets, Flooring, Extras
  - Deck (17 services): Decking, Railings, Exterior Structures
  - Floor (10 services): LVP/Vinyl, Hardwood, Engineered, Laminate, Subfloor, Transitions
  - Frame (10 services): Wall Framing, Headers, Joists, Subfloor, Posts, Blocking
  - Roof (11 services): Shingles, Tear-Off, Underlayment, Flashing, Ridge Cap, Skylight
- **Painting** (trade, slug: painting) - 13 services, no specialties
- **House Cleaning** (trade, slug: house_cleaning) - 11 services, no specialties
- **Tile** (trade, slug: tile) - 12 services, no specialties
- Total: 128 services across 4 trades

### Default Users
- admin / admin123 (role: ADMIN, company: Mateus Santana Finish Carpentry)
- user / user123 (role: USER, company: Mateus Santana Finish Carpentry)
- mateus / owner123 (role: OWNER, company: Mateus Santana Finish Carpentry)
- brother / owner123 (role: OWNER, company: Brother's Carpentry)

### Test Users (all password: test1234)
- admintest (OWNER) - all 9 carpentry specialties, full admin access, company: Mateus Santana Finish Carpentry
- carpentertest (USER) - finish carpentry specialist, company: Mateus Santana Finish Carpentry
- rooftest (USER) - roofing specialist, company: Mateus Santana Finish Carpentry
- frametest (USER) - framing specialist, company: Mateus Santana Finish Carpentry
- floortest (USER) - flooring specialist, company: Mateus Santana Finish Carpentry
- paintertest (USER) - painting specialist, company: Mateus Santana Finish Carpentry
- cleantest (USER) - house cleaning specialist, company: Mateus Santana Finish Carpentry
- roof_finish_test (USER) - roofing + finish carpentry specialist, company: Mateus Santana Finish Carpentry
- frame_finish_test (USER) - framing + finish carpentry specialist, company: Mateus Santana Finish Carpentry
- clean_owner_test (OWNER) - house cleaning, company: Clean Pro House Cleaning
- clean_staff_test (USER) - house cleaning staff, restricted permissions (no prices, no settings), company: Clean Pro House Cleaning

## User Preferences
- Enterprise premium light UI: light gray background, white cards, dark topbar, green accents
- Mobile-first design
- Portuguese-speaking user (bilingual EN/PT)
- Professional, clean PDF output
- App name: "R Quotas" (with space)
