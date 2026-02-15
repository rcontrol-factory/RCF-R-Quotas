import { pool } from "./db";
import pg from "pg";

async function colExists(c: pg.PoolClient, table: string, column: string): Promise<boolean> {
  const r = await c.query(
    `SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 AND column_name=$2`,
    [table, column]
  );
  return r.rows.length > 0;
}

async function tblExists(c: pg.PoolClient, table: string): Promise<boolean> {
  const r = await c.query(
    `SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=$1`,
    [table]
  );
  return r.rows.length > 0;
}

async function conExists(c: pg.PoolClient, name: string): Promise<boolean> {
  const r = await c.query(
    `SELECT 1 FROM information_schema.table_constraints WHERE constraint_schema='public' AND constraint_name=$1`,
    [name]
  );
  return r.rows.length > 0;
}

async function idxExists(c: pg.PoolClient, name: string): Promise<boolean> {
  const r = await c.query(
    `SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname=$1`,
    [name]
  );
  return r.rows.length > 0;
}

const LEGACY_SLUGS = new Set(["FINISH", "DECK", "KITCHEN", "FLOORING", "EXTRAS", "PAINT", "CLEAN", "TILE"]);

const LEGACY_TO_NEW_TRADE: Record<string, string> = {
  finish: "carpentry",
  deck: "carpentry",
  kitchen: "carpentry",
  flooring: "carpentry",
  extras: "carpentry",
  paint: "painting",
  clean: "house_cleaning",
  tile: "tile",
};

const LEGACY_TRADE_TYPE_MAP: Record<string, string> = {
  finish_carpentry: "carpentry",
  deck: "carpentry",
  kitchen: "carpentry",
  flooring: "carpentry",
  extras: "carpentry",
  painting: "painting",
  cleaning: "house_cleaning",
  tile: "tile",
};

const NEW_TRADES = [
  { slug: "carpentry", name: "Carpentry" },
  { slug: "painting", name: "Painting" },
  { slug: "tile", name: "Tile" },
  { slug: "house_cleaning", name: "House Cleaning" },
];

const NEW_SPECIALTIES = [
  { tradeSlug: "carpentry", slug: "finish", name: "Finish Carpentry" },
  { tradeSlug: "carpentry", slug: "deck", name: "Deck" },
  { tradeSlug: "carpentry", slug: "stairs", name: "Stairs" },
  { tradeSlug: "carpentry", slug: "doors", name: "Doors" },
  { tradeSlug: "carpentry", slug: "windows", name: "Windows" },
  { tradeSlug: "carpentry", slug: "baseboard", name: "Baseboard / Trim" },
  { tradeSlug: "painting", slug: "general", name: "Painting" },
  { tradeSlug: "tile", slug: "general", name: "Tile" },
  { tradeSlug: "house_cleaning", slug: "general", name: "House Cleaning" },
];

const CATEGORY_TO_SPECIALTY: Record<string, string> = {
  Trim: "baseboard", "Trim Ext": "baseboard",
  Doors: "doors", "Doors Ext": "doors", Jamb: "doors",
  Windows: "windows", Stairs: "stairs",
  Shiplap: "finish", Kitchen: "finish", Flooring: "finish", Extras: "finish", Other: "finish",
  Deck: "deck", Railing: "deck",
  "Interior Paint": "general", "Exterior Paint": "general", Prep: "general",
  "Standard Clean": "general", "Deep Clean": "general", "Move-Out": "general",
  "Floor Tile": "general", "Wall Tile": "general", "Grout & Prep": "general",
};

export async function runMigrations(): Promise<void> {
  console.log("[Migration] Starting idempotent schema migration...");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const orphanCheck = await client.query(`
      SELECT cs.company_id FROM public.company_settings cs
      LEFT JOIN public.companies c ON c.id = cs.company_id
      WHERE cs.company_id IS NOT NULL AND c.id IS NULL
    `);
    if (orphanCheck.rows.length > 0) {
      console.error("[Migration] ABORT: Orphan company_settings ids:", orphanCheck.rows.map((r: any) => r.company_id));
      throw new Error("Orphan data in company_settings. Fix manually.");
    }
    console.log("[Migration] ✓ No orphan data");

    const hasSlug = await colExists(client, "trades", "slug");
    const hasCode = await colExists(client, "trades", "code");
    if (hasCode && !hasSlug) {
      await client.query(`ALTER TABLE public.trades RENAME COLUMN code TO slug`);
      console.log("[Migration] ✓ Rename trades.code → slug");
    }
    if (await idxExists(client, "trades_code_unique")) {
      await client.query(`DROP INDEX IF EXISTS public.trades_code_unique`);
      console.log("[Migration] ✓ Drop trades_code_unique");
    }
    if (!(await idxExists(client, "trades_slug_unique"))) {
      await client.query(`CREATE UNIQUE INDEX trades_slug_unique ON public.trades (slug)`);
      console.log("[Migration] ✓ Create trades_slug_unique");
    }
    if (await colExists(client, "trades", "description")) {
      await client.query(`ALTER TABLE public.trades DROP COLUMN description`);
      console.log("[Migration] ✓ Drop trades.description");
    }

    const existingTrades = await client.query(`SELECT id, slug FROM public.trades`);
    const tradesBySlug = new Map<string, number>(existingTrades.rows.map((r: any) => [r.slug, r.id]));

    const hasLegacyTrades = existingTrades.rows.some((r: any) => {
      const norm = r.slug.toLowerCase();
      return LEGACY_TO_NEW_TRADE[norm] !== undefined && !NEW_TRADES.some(t => t.slug === norm);
    });

    const oldToNewTradeId = new Map<number, number>();

    if (hasLegacyTrades) {
      console.log("[Migration] Consolidating legacy trades → 4 new trades...");

      for (const t of NEW_TRADES) {
        if (!tradesBySlug.has(t.slug)) {
          const res = await client.query(
            `INSERT INTO public.trades (slug, name) VALUES ($1, $2) RETURNING id`,
            [t.slug, t.name]
          );
          tradesBySlug.set(t.slug, res.rows[0].id);
          console.log(`[Migration] ✓ Insert trade: ${t.slug} (id=${res.rows[0].id})`);
        }
      }

      for (const row of existingTrades.rows) {
        const norm = row.slug.toLowerCase();
        const newSlug = LEGACY_TO_NEW_TRADE[norm];
        if (newSlug && tradesBySlug.has(newSlug)) {
          oldToNewTradeId.set(row.id, tradesBySlug.get(newSlug)!);
        }
      }

      const entries = Array.from(oldToNewTradeId.entries());
      for (const [oldId, newId] of entries) {
        if (oldId !== newId) {
          await client.query(`UPDATE public.services SET trade_id = $1 WHERE trade_id = $2`, [newId, oldId]);
          await client.query(`UPDATE public.jobs SET trade_id = $1 WHERE trade_id = $2`, [newId, oldId]);
          console.log(`[Migration] ✓ Remap services/jobs trade_id ${oldId} → ${newId}`);
        }
      }

      if (await colExists(client, "companies", "trade_id")) {
        for (const [oldId, newId] of entries) {
          if (oldId !== newId) {
            await client.query(`UPDATE public.companies SET trade_id = $1 WHERE trade_id = $2`, [newId, oldId]);
          }
        }
      }

      for (const row of existingTrades.rows) {
        const norm = row.slug.toLowerCase();
        if (LEGACY_TO_NEW_TRADE[norm] && !NEW_TRADES.some(t => t.slug === norm)) {
          const refs = await client.query(`
            SELECT
              (SELECT COUNT(*) FROM services WHERE trade_id = $1) +
              (SELECT COUNT(*) FROM jobs WHERE trade_id = $1) as total
          `, [row.id]);
          const hasCompanyRefs = (await colExists(client, "companies", "trade_id"))
            ? parseInt((await client.query(`SELECT COUNT(*) as cnt FROM companies WHERE trade_id = $1`, [row.id])).rows[0].cnt)
            : 0;

          if (parseInt(refs.rows[0].total) === 0 && hasCompanyRefs === 0) {
            await client.query(`DELETE FROM public.trades WHERE id = $1`, [row.id]);
            console.log(`[Migration] ✓ Delete legacy trade: ${row.slug} (id=${row.id})`);
          } else {
            console.log(`[Migration] ~ Legacy trade ${row.slug} still referenced, keeping`);
          }
        }
      }
    } else {
      console.log("[Migration] ~ No legacy trade consolidation needed");
    }

    const finalTrades = await client.query(`SELECT id, slug FROM public.trades`);
    const tradeIdMap = new Map<string, number>(finalTrades.rows.map((r: any) => [r.slug, r.id]));

    if (!(await tblExists(client, "regions"))) {
      await client.query(`
        CREATE TABLE public.regions (
          id SERIAL PRIMARY KEY, code TEXT NOT NULL UNIQUE, name TEXT NOT NULL
        )
      `);
      console.log("[Migration] ✓ Create regions table");
    }

    if (!(await tblExists(client, "specialties"))) {
      await client.query(`
        CREATE TABLE public.specialties (
          id SERIAL PRIMARY KEY,
          trade_id INTEGER NOT NULL REFERENCES public.trades(id),
          slug TEXT NOT NULL,
          name TEXT NOT NULL
        )
      `);
      console.log("[Migration] ✓ Create specialties table");
    }

    const existingSpecs = await client.query(`SELECT id, trade_id, slug FROM public.specialties`);
    const specMap = new Map<string, number>();
    for (const r of existingSpecs.rows) {
      specMap.set(`${r.trade_id}:${r.slug}`, r.id);
    }
    for (const sp of NEW_SPECIALTIES) {
      const tid = tradeIdMap.get(sp.tradeSlug);
      if (!tid) continue;
      const key = `${tid}:${sp.slug}`;
      if (!specMap.has(key)) {
        const res = await client.query(
          `INSERT INTO public.specialties (trade_id, slug, name) VALUES ($1, $2, $3) RETURNING id`,
          [tid, sp.slug, sp.name]
        );
        specMap.set(key, res.rows[0].id);
        console.log(`[Migration] ✓ Insert specialty: ${sp.slug} (trade=${sp.tradeSlug})`);
      }
    }

    if (!(await tblExists(client, "user_specialties"))) {
      await client.query(`
        CREATE TABLE public.user_specialties (
          company_id INTEGER NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
          user_id INTEGER NOT NULL REFERENCES public.users(id),
          specialty_id INTEGER NOT NULL REFERENCES public.specialties(id),
          created_at TIMESTAMP DEFAULT NOW(),
          PRIMARY KEY (company_id, user_id, specialty_id)
        )
      `);
      console.log("[Migration] ✓ Create user_specialties table");
    }

    if (!(await colExists(client, "users", "is_global_admin"))) {
      await client.query(`ALTER TABLE public.users ADD COLUMN is_global_admin BOOLEAN NOT NULL DEFAULT false`);
      console.log("[Migration] ✓ Add users.is_global_admin");
    }

    if (!(await colExists(client, "users", "global_role"))) {
      await client.query(`ALTER TABLE public.users ADD COLUMN global_role TEXT NOT NULL DEFAULT 'user'`);
      console.log("[Migration] ✓ Add users.global_role");
    }

    const supportAdminUsernames = ["mateus", "admin", "admin_test"];
    await client.query(
      `UPDATE public.users SET global_role = 'support_admin' WHERE LOWER(username) = ANY($1) AND global_role = 'user'`,
      [supportAdminUsernames]
    );
    console.log("[Migration] ✓ Set support_admin role for allowlisted users");

    const hasTradeType = await colExists(client, "companies", "trade_type");
    const hasTradeIdCol = await colExists(client, "companies", "trade_id");
    if (hasTradeType && !hasTradeIdCol) {
      await client.query(`ALTER TABLE public.companies ADD COLUMN trade_id INTEGER`);
      for (const [tradeType, newSlug] of Object.entries(LEGACY_TRADE_TYPE_MAP)) {
        const tid = tradeIdMap.get(newSlug);
        if (tid) {
          await client.query(
            `UPDATE public.companies SET trade_id = $1 WHERE trade_type = $2 AND trade_id IS NULL`,
            [tid, tradeType]
          );
        }
      }
      const carpId = tradeIdMap.get("carpentry");
      if (carpId) {
        await client.query(`UPDATE public.companies SET trade_id = $1 WHERE trade_id IS NULL`, [carpId]);
      }
      const nullCheck = await client.query(`SELECT COUNT(*) as cnt FROM companies WHERE trade_id IS NULL`);
      if (parseInt(nullCheck.rows[0].cnt) > 0) {
        throw new Error("Cannot set companies.trade_id NOT NULL: some rows still NULL after mapping");
      }
      await client.query(`ALTER TABLE public.companies ALTER COLUMN trade_id SET NOT NULL`);
      if (!(await conExists(client, "companies_trade_id_trades_id_fk"))) {
        await client.query(`
          ALTER TABLE public.companies ADD CONSTRAINT companies_trade_id_trades_id_fk
          FOREIGN KEY (trade_id) REFERENCES public.trades(id)
        `);
      }
      await client.query(`ALTER TABLE public.companies DROP COLUMN trade_type`);
      console.log("[Migration] ✓ Migrate companies.trade_type → trade_id");
    }

    if (!(await colExists(client, "jobs", "specialty_id"))) {
      await client.query(`ALTER TABLE public.jobs ADD COLUMN specialty_id INTEGER REFERENCES public.specialties(id)`);
      console.log("[Migration] ✓ Add jobs.specialty_id");
    }

    if (!(await colExists(client, "services", "company_id"))) {
      const firstCo = await client.query(`SELECT id FROM companies ORDER BY id LIMIT 1`);
      const defaultCo = firstCo.rows.length > 0 ? firstCo.rows[0].id : 1;
      await client.query(`ALTER TABLE public.services ADD COLUMN company_id INTEGER`);
      await client.query(`UPDATE public.services SET company_id = $1 WHERE company_id IS NULL`, [defaultCo]);
      await client.query(`ALTER TABLE public.services ALTER COLUMN company_id SET NOT NULL`);
      if (!(await conExists(client, "services_company_id_companies_id_fk"))) {
        await client.query(`
          ALTER TABLE public.services ADD CONSTRAINT services_company_id_companies_id_fk
          FOREIGN KEY (company_id) REFERENCES public.companies(id)
        `);
      }
      console.log("[Migration] ✓ Add services.company_id");
    }

    if (!(await colExists(client, "services", "specialty_id"))) {
      await client.query(`ALTER TABLE public.services ADD COLUMN specialty_id INTEGER`);
      console.log("[Migration] ✓ Add services.specialty_id");
    }

    const nullSpecCount = await client.query(`SELECT COUNT(*) as cnt FROM services WHERE specialty_id IS NULL`);
    if (parseInt(nullSpecCount.rows[0].cnt) > 0 && (await colExists(client, "services", "category"))) {
      console.log("[Migration] Backfilling services.specialty_id from category...");

      for (const [category, specSlug] of Object.entries(CATEGORY_TO_SPECIALTY)) {
        const svcTrades = await client.query(
          `SELECT DISTINCT trade_id FROM services WHERE category = $1 AND specialty_id IS NULL`,
          [category]
        );
        for (const row of svcTrades.rows) {
          const tRow = await client.query(`SELECT slug FROM trades WHERE id = $1`, [row.trade_id]);
          if (tRow.rows.length === 0) continue;
          const tradeSlug = tRow.rows[0].slug;
          const lookupSpecSlug = (tradeSlug !== "carpentry") ? "general" : specSlug;
          const specId = specMap.get(`${row.trade_id}:${lookupSpecSlug}`);
          if (specId) {
            await client.query(
              `UPDATE public.services SET specialty_id = $1 WHERE category = $2 AND trade_id = $3 AND specialty_id IS NULL`,
              [specId, category, row.trade_id]
            );
          }
        }
      }

      const carpId = tradeIdMap.get("carpentry");
      const finishSpec = carpId ? specMap.get(`${carpId}:finish`) : null;
      if (finishSpec) {
        await client.query(`UPDATE public.services SET specialty_id = $1 WHERE specialty_id IS NULL`, [finishSpec]);
      }
    }

    const stillNullSpecs = await client.query(`SELECT COUNT(*) as cnt FROM services WHERE specialty_id IS NULL`);
    if (parseInt(stillNullSpecs.rows[0].cnt) > 0) {
      throw new Error(`Cannot set services.specialty_id NOT NULL: ${stillNullSpecs.rows[0].cnt} rows still NULL after backfill. Aborting.`);
    }
    await client.query(`ALTER TABLE public.services ALTER COLUMN specialty_id SET NOT NULL`).catch(() => {});
    if (!(await conExists(client, "services_specialty_id_specialties_id_fk"))) {
      await client.query(`
        ALTER TABLE public.services ADD CONSTRAINT services_specialty_id_specialties_id_fk
        FOREIGN KEY (specialty_id) REFERENCES public.specialties(id)
      `).catch(() => {});
    }

    const hasOldUnit = await colExists(client, "services", "unit");
    const hasPricingUnit = await colExists(client, "services", "pricing_unit");
    if (hasOldUnit && !hasPricingUnit) {
      await client.query(`ALTER TABLE public.services RENAME COLUMN unit TO pricing_unit`);
      console.log("[Migration] ✓ Rename services.unit → pricing_unit");
    } else if (!hasPricingUnit) {
      await client.query(`ALTER TABLE public.services ADD COLUMN pricing_unit TEXT NOT NULL DEFAULT 'EA'`);
      console.log("[Migration] ✓ Add services.pricing_unit");
    }

    const hasPriceDefault = await colExists(client, "services", "price_default");
    const hasUnitPrice = await colExists(client, "services", "unit_price");
    if (hasPriceDefault && !hasUnitPrice) {
      await client.query(`ALTER TABLE public.services ADD COLUMN unit_price NUMERIC(10,2) NOT NULL DEFAULT 0`);
      await client.query(`UPDATE public.services SET unit_price = COALESCE(price_default, 0)`);
      console.log("[Migration] ✓ Add services.unit_price from price_default");
    } else if (!hasUnitPrice) {
      await client.query(`ALTER TABLE public.services ADD COLUMN unit_price NUMERIC(10,2) NOT NULL DEFAULT 0`);
      console.log("[Migration] ✓ Add services.unit_price");
    }

    if (!(await colExists(client, "services", "description"))) {
      await client.query(`ALTER TABLE public.services ADD COLUMN description TEXT`);
      if (await colExists(client, "services", "notes")) {
        await client.query(`UPDATE public.services SET description = notes`);
      }
      console.log("[Migration] ✓ Add services.description");
    }

    if (!(await colExists(client, "services", "active"))) {
      await client.query(`ALTER TABLE public.services ADD COLUMN active BOOLEAN NOT NULL DEFAULT true`);
      if (await colExists(client, "services", "is_active")) {
        await client.query(`UPDATE public.services SET active = COALESCE(is_active, true)`);
      }
      console.log("[Migration] ✓ Add services.active");
    }

    for (const col of ["price_min", "price_max", "price_default", "notes", "is_extra", "is_active"]) {
      if (await colExists(client, "services", col)) {
        await client.query(`ALTER TABLE public.services DROP COLUMN ${col}`);
        console.log(`[Migration] ✓ Drop services.${col}`);
      }
    }

    if (!(await colExists(client, "job_items", "pricing_unit"))) {
      await client.query(`ALTER TABLE public.job_items ADD COLUMN pricing_unit TEXT NOT NULL DEFAULT 'EA'`);
      await client.query(`
        UPDATE public.job_items ji
        SET pricing_unit = COALESCE(s.pricing_unit, 'EA')
        FROM public.services s
        WHERE ji.service_id = s.id
      `);
      console.log("[Migration] ✓ Add job_items.pricing_unit");
    }

    if (!(await colExists(client, "company_settings", "region_id"))) {
      await client.query(`ALTER TABLE public.company_settings ADD COLUMN region_id INTEGER`);
      console.log("[Migration] ✓ Add company_settings.region_id");
    }
    if (!(await conExists(client, "company_settings_region_id_regions_id_fk"))) {
      await client.query(`
        ALTER TABLE public.company_settings ADD CONSTRAINT company_settings_region_id_regions_id_fk
        FOREIGN KEY (region_id) REFERENCES public.regions(id)
      `).catch(() => {});
    }

    await client.query(`ALTER TABLE public.company_settings DROP CONSTRAINT IF EXISTS company_settings_company_id_fkey`);
    if (!(await conExists(client, "company_settings_company_id_companies_id_fk"))) {
      await client.query(`
        ALTER TABLE public.company_settings ADD CONSTRAINT company_settings_company_id_companies_id_fk
        FOREIGN KEY (company_id) REFERENCES public.companies(id)
      `);
    }
    console.log("[Migration] ✓ company_settings FK OK");

    if (!(await tblExists(client, "pricing_rules"))) {
      await client.query(`
        CREATE TABLE public.pricing_rules (
          id SERIAL PRIMARY KEY,
          region_id INTEGER NOT NULL REFERENCES public.regions(id),
          trade_id INTEGER NOT NULL REFERENCES public.trades(id),
          specialty_id INTEGER REFERENCES public.specialties(id),
          unit TEXT NOT NULL,
          base_price NUMERIC(10,2) NOT NULL,
          anchor_multiplier NUMERIC(5,2) NOT NULL DEFAULT 1.15,
          material_multiplier JSONB NOT NULL DEFAULT '{"basic":1.0,"standard":1.15,"premium":1.35}',
          complexity_multiplier JSONB NOT NULL DEFAULT '{"normal":1.0,"hard":1.2}',
          enabled BOOLEAN NOT NULL DEFAULT true
        )
      `);
      await client.query(`
        CREATE UNIQUE INDEX pricing_rules_unique
        ON public.pricing_rules (region_id, trade_id, specialty_id, unit)
      `);
      console.log("[Migration] ✓ Create pricing_rules table");
    }

    if (!(await tblExists(client, "estimate_photos"))) {
      await client.query(`
        CREATE TABLE public.estimate_photos (
          id SERIAL PRIMARY KEY,
          job_id INTEGER REFERENCES public.jobs(id),
          company_id INTEGER NOT NULL REFERENCES public.companies(id),
          url TEXT NOT NULL, notes TEXT,
          created_at TIMESTAMP DEFAULT NOW()
        )
      `);
      console.log("[Migration] ✓ Create estimate_photos table");
    }

    if (!(await idxExists(client, "company_users_unique"))) {
      await client.query(`CREATE UNIQUE INDEX company_users_unique ON public.company_users (company_id, user_id)`);
    }
    if (!(await idxExists(client, "job_assignments_unique"))) {
      await client.query(`CREATE UNIQUE INDEX job_assignments_unique ON public.job_assignments (job_id, user_id)`);
    }

    await client.query("COMMIT");
    console.log("[Migration] Schema migration completed successfully.");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[Migration] ROLLBACK:", err);
    throw err;
  } finally {
    client.release();
  }
}
