import { db } from "./db";
import {
  users, companies, companyUsers, trades, specialties, userSpecialties,
  services, jobs, jobItems, jobAssignments, auditLog, companySettings,
  regions, pricingRules, estimatePhotos, inviteTokens,
  type Job, type InsertJob, type JobItem, type InsertJobItem,
  type CompanySettings, type InsertCompanySettings, type Service, type Trade,
  type Specialty, type User, type SafeUser, type JobWithItems, type AuditLogEntry,
  type Company, type CompanyUser,
  type Region, type PricingRule, type InsertPricingRule, type EstimatePhoto,
  type Permissions, DEFAULT_EMPLOYEE_PERMISSIONS, OWNER_PERMISSIONS, capPermissions,
  type InviteToken, type InsertInviteToken, isSupportAdmin,
} from "@shared/schema";
import { eq, ne, asc, desc, and, inArray } from "drizzle-orm";
import bcrypt from "bcrypt";

function toSafeUser(user: User): SafeUser {
  const { passwordHash, ...safe } = user;
  return safe;
}

function parsePermissions(raw: string | null): Permissions {
  try {
    if (!raw) return { ...DEFAULT_EMPLOYEE_PERMISSIONS };
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_EMPLOYEE_PERMISSIONS, ...parsed };
  } catch {
    return { ...DEFAULT_EMPLOYEE_PERMISSIONS };
  }
}

export interface JobsListResponse {
  items: Job[];
  stats: { total: number; drafts: number; sent: number; approved: number; inProgress: number; done: number };
}

export interface IStorage {
  getJobs(userId: number, role: string, companyId: number): Promise<JobsListResponse>;
  getJob(id: number, userId: number, role: string, companyId: number): Promise<(JobWithItems & { myRole?: string }) | undefined>;
  createJob(job: InsertJob & { items?: Omit<InsertJobItem, "jobId">[] }, userId: number, companyId: number): Promise<Job>;
  updateJob(id: number, updates: Partial<InsertJob> & { items?: (Omit<InsertJobItem, "jobId"> & { id?: number })[] }, userId: number, role: string, companyId: number): Promise<Job | undefined>;
  deleteJob(id: number, companyId: number): Promise<void>;
  getCompanySettings(companyId: number): Promise<CompanySettings>;
  updateCompanySettings(companyId: number, settings: Partial<InsertCompanySettings>): Promise<CompanySettings>;
  getCompanyTradeId(companyId: number): Promise<number>;
  getTrades(): Promise<Trade[]>;
  getSpecialties(tradeId?: number): Promise<Specialty[]>;
  getServices(opts: { companyId: number; userId: number; role: string; specialtyId?: number }): Promise<Service[]>;
  getUserSpecialties(userId: number, companyId: number): Promise<Specialty[]>;
  setUserSpecialties(userId: number, companyId: number, specialtyIds: number[]): Promise<void>;
  getAllowedSpecialtyIds(userId: number, companyId: number, role: string): Promise<number[]>;
  seedTrades(tradesList: Omit<Trade, "id">[]): Promise<void>;
  seedSpecialties(list: (Omit<Specialty, "id"> & { tradeSlug: string })[]): Promise<void>;
  seedServices(servicesList: { specialtySlug: string; tradeSlug?: string; category: string; name: string; pricingUnit: string; unitPrice: string; active: boolean }[], companyId: number): Promise<void>;
  createUser(username: string, password: string, role: string): Promise<SafeUser>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserById(id: number): Promise<SafeUser | undefined>;
  verifyPassword(password: string, hash: string): Promise<boolean>;
  seedDefaultUsers(): Promise<void>;
  getCompanyUsers(companyId: number): Promise<(Omit<CompanyUser, "permissions"> & { username: string; permissions: Permissions })[]>;
  getCompanyUserPermissions(companyId: number, userId: number): Promise<Permissions>;
  updateCompanyUserPermissions(companyId: number, userId: number, permissions: Partial<Permissions>): Promise<void>;
  setUserActive(companyId: number, userId: number, isActive: boolean): Promise<void>;
  resetUserPassword(userId: number, newPassword: string): Promise<void>;
  updateServicePricing(serviceId: number, companyId: number, pricingUnit: string, unitPrice: string): Promise<Service | undefined>;
  assignJobUser(jobId: number, userId: number, permissions?: Partial<Permissions>): Promise<void>;
  getJobAssignments(jobId: number, companyId?: number): Promise<any[]>;
  updateAssignmentPermissions(jobId: number, userId: number, permissions: Partial<Permissions>): Promise<void>;
  logAudit(companyId: number, actorUserId: number, action: string, jobId?: number, meta?: string): Promise<void>;
  getAuditLog(jobId: number): Promise<AuditLogEntry[]>;
  getUserCompanyId(userId: number): Promise<number | undefined>;
  getRegions(): Promise<Region[]>;
  getPricingRules(opts: { regionId?: number; tradeId?: number; specialtyId?: number; unit?: string }): Promise<PricingRule[]>;
  createPricingRule(rule: InsertPricingRule): Promise<PricingRule>;
  updatePricingRule(id: number, updates: Partial<InsertPricingRule>): Promise<PricingRule | undefined>;
  createEstimatePhoto(data: { jobId?: number; companyId: number; url: string; notes?: string }): Promise<EstimatePhoto>;
  getEstimatePhotos(jobId: number): Promise<EstimatePhoto[]>;
  seedRegions(): Promise<void>;
  seedPricingRules(): Promise<void>;
  createInviteToken(data: { companyId: number; createdBy: number; role: string; expiresAt: Date; token: string }): Promise<InviteToken>;
  getInviteToken(token: string): Promise<InviteToken | undefined>;
  markInviteTokenUsed(token: string, userId: number): Promise<void>;
  getInvitesByCompany(companyId: number): Promise<InviteToken[]>;
  renameUser(userId: number, newUsername: string): Promise<void>;
  searchCompanyUserByUsername(companyId: number, username: string): Promise<any>;
  isUserInCompany(userId: number, companyId: number): Promise<boolean>;
  getAllCompanyUsers(companyId: number): Promise<any[]>;
  assignUserToCompany(userId: number, companyId: number, role: string): Promise<void>;
  getCompanyById(companyId: number): Promise<Company | undefined>;
}

export class DatabaseStorage implements IStorage {
  async getJobs(userId: number, role: string, companyId: number): Promise<JobsListResponse> {
    if (role === "SUPPORT") {
      return { items: [], stats: { total: 0, drafts: 0, sent: 0, approved: 0, inProgress: 0, done: 0 } };
    }
    let jobsList: Job[];
    if (role === "OWNER" || role === "ADMIN") {
      jobsList = await db.select().from(jobs)
        .where(eq(jobs.companyId, companyId))
        .orderBy(jobs.createdAt);
    } else {
      const companyPerms = await this.getCompanyUserPermissions(companyId, userId);
      const assignments = await db.select().from(jobAssignments)
        .where(eq(jobAssignments.userId, userId));
      const jobIds = assignments.map(a => a.jobId);

      const userSpecIds = await this.getAllowedSpecialtyIds(userId, companyId, role);

      if (jobIds.length === 0 && userSpecIds.length === 0) {
        return { items: [], stats: { total: 0, drafts: 0, sent: 0, approved: 0, inProgress: 0, done: 0 } };
      }

      const allJobs = await db.select().from(jobs)
        .where(eq(jobs.companyId, companyId))
        .orderBy(jobs.createdAt);

      jobsList = allJobs.filter(j =>
        jobIds.includes(j.id) ||
        (j.specialtyId && userSpecIds.includes(j.specialtyId))
      );

      const assignmentMap = new Map(assignments.map(a => [a.jobId, a]));
      jobsList = jobsList.map(j => {
        const assignment = assignmentMap.get(j.id);
        const jobPerms = parsePermissions(assignment?.permissions ?? null);
        const perms = capPermissions(jobPerms, companyPerms);
        return { ...j };
      });
    }
    const stats = {
      total: jobsList.length,
      drafts: jobsList.filter(j => j.status === "DRAFT").length,
      sent: jobsList.filter(j => j.status === "SENT").length,
      approved: jobsList.filter(j => j.status === "APPROVED").length,
      inProgress: jobsList.filter(j => j.status === "IN_PROGRESS").length,
      done: jobsList.filter(j => j.status === "DONE").length,
    };
    return { items: jobsList, stats };
  }

  async getJob(id: number, userId: number, role: string, companyId: number): Promise<(JobWithItems & { myRole?: string }) | undefined> {
    if (role === "SUPPORT") return undefined;
    const job = await db.query.jobs.findFirst({
      where: and(eq(jobs.id, id), eq(jobs.companyId, companyId)),
      with: { items: true },
    });
    if (!job) return undefined;

    if (role === "OWNER" || role === "ADMIN") {
      return { ...job, myRole: "OWNER" };
    }

    const [assignment] = await db.select().from(jobAssignments)
      .where(and(eq(jobAssignments.jobId, id), eq(jobAssignments.userId, userId)))
      .limit(1);
    if (!assignment) return undefined;

    const companyPerms = await this.getCompanyUserPermissions(companyId, userId);
    const jobPerms = parsePermissions(assignment.permissions);
    const perms = capPermissions(jobPerms, companyPerms);
    const result: any = { ...job, myRole: "USER", permissions: perms, companyPermissions: companyPerms };
    if (!perms.canViewPrices && result.items) {
      result.items = result.items.map((item: any) => ({
        ...item,
        unitPrice: "0",
        lineTotal: "0",
      }));
    }
    return result;
  }

  async createJob(insertJob: InsertJob & { items?: Omit<InsertJobItem, "jobId">[] }, userId: number, companyId: number): Promise<Job> {
    return await db.transaction(async (tx) => {
      const { items, ...jobData } = insertJob;
      const [newJob] = await tx.insert(jobs).values({
        ...jobData,
        createdBy: userId,
        companyId,
      }).returning();

      if (items && items.length > 0) {
        await tx.insert(jobItems).values(
          items.map((item) => ({ ...item, jobId: newJob.id }))
        );
      }

      await tx.insert(auditLog).values({
        companyId,
        actorUserId: userId,
        action: "JOB_CREATED",
        jobId: newJob.id,
      });

      return newJob;
    });
  }

  async updateJob(id: number, updates: Partial<InsertJob> & { items?: (Omit<InsertJobItem, "jobId"> & { id?: number })[] }, userId: number, role: string, companyId: number): Promise<Job | undefined> {
    const access = await this.getJob(id, userId, role, companyId);
    if (!access) return undefined;

    return await db.transaction(async (tx) => {
      const { items, ...jobUpdates } = updates;

      if (Object.keys(jobUpdates).length > 0) {
        await tx.update(jobs).set({ ...jobUpdates, updatedAt: new Date() }).where(eq(jobs.id, id));
      }

      if (items) {
        await tx.delete(jobItems).where(eq(jobItems.jobId, id));
        if (items.length > 0) {
          await tx.insert(jobItems).values(
            items.map((item) => ({
              ...item,
              jobId: id,
              id: undefined,
            }))
          );
        }
      }

      const actions: string[] = [];
      if (jobUpdates.status) actions.push(`STATUS_CHANGED:${jobUpdates.status}`);
      if (items) actions.push("LINE_ITEMS_UPDATED");

      for (const action of actions) {
        await tx.insert(auditLog).values({
          companyId,
          actorUserId: userId,
          action,
          jobId: id,
        });
      }

      const [updatedJob] = await tx.select().from(jobs).where(eq(jobs.id, id));
      return updatedJob;
    });
  }

  async deleteJob(id: number, companyId: number): Promise<void> {
    const [job] = await db.select().from(jobs).where(and(eq(jobs.id, id), eq(jobs.companyId, companyId)));
    if (!job) return;
    await db.transaction(async (tx) => {
      await tx.delete(jobItems).where(eq(jobItems.jobId, id));
      await tx.delete(jobAssignments).where(eq(jobAssignments.jobId, id));
      await tx.delete(jobs).where(eq(jobs.id, id));
    });
  }

  async getCompanySettings(companyId: number): Promise<CompanySettings> {
    const [existing] = await db.select().from(companySettings).where(eq(companySettings.companyId, companyId));
    if (existing) return existing;
    const [newSettings] = await db.insert(companySettings).values({ companyId }).returning();
    return newSettings;
  }

  async updateCompanySettings(companyId: number, updates: Partial<InsertCompanySettings>): Promise<CompanySettings> {
    const existing = await this.getCompanySettings(companyId);
    const [updated] = await db.update(companySettings)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(companySettings.companyId, companyId))
      .returning();
    return updated;
  }

  async getCompanyTradeId(companyId: number): Promise<number> {
    const [co] = await db.select().from(companies).where(eq(companies.id, companyId)).limit(1);
    return co?.tradeId || 0;
  }

  async getTrades(): Promise<Trade[]> {
    return await db.select().from(trades).orderBy(asc(trades.id));
  }

  async getSpecialties(tradeId?: number): Promise<Specialty[]> {
    if (tradeId) {
      return await db.select().from(specialties)
        .where(eq(specialties.tradeId, tradeId))
        .orderBy(asc(specialties.id));
    }
    return await db.select().from(specialties).orderBy(asc(specialties.id));
  }

  async getServices(opts: { companyId: number; userId: number; role: string; specialtyId?: number }): Promise<Service[]> {
    const { companyId, userId, role, specialtyId } = opts;
    if (role === "SUPPORT") return [];
    const allowedIds = await this.getAllowedSpecialtyIds(userId, companyId, role);
    if (allowedIds.length === 0) return [];

    const conditions = [
      eq(services.companyId, companyId),
      eq(services.active, true),
    ];

    if (specialtyId) {
      if (!allowedIds.includes(specialtyId)) return [];
      conditions.push(eq(services.specialtyId, specialtyId));
    } else {
      conditions.push(inArray(services.specialtyId, allowedIds));
    }

    return await db.select().from(services)
      .where(and(...conditions))
      .orderBy(asc(services.id));
  }

  async getUserSpecialties(userId: number, companyId: number): Promise<Specialty[]> {
    const rows = await db.select().from(userSpecialties)
      .where(and(eq(userSpecialties.userId, userId), eq(userSpecialties.companyId, companyId)));
    if (rows.length === 0) return [];
    const specIds = rows.map(r => r.specialtyId);
    return await db.select().from(specialties)
      .where(inArray(specialties.id, specIds))
      .orderBy(asc(specialties.id));
  }

  async setUserSpecialties(userId: number, companyId: number, specialtyIds: number[]): Promise<void> {
    await db.delete(userSpecialties).where(
      and(eq(userSpecialties.userId, userId), eq(userSpecialties.companyId, companyId))
    );
    if (specialtyIds.length > 0) {
      await db.insert(userSpecialties).values(
        specialtyIds.map(specialtyId => ({ companyId, userId, specialtyId }))
      );
    }
  }

  async getAllowedSpecialtyIds(userId: number, companyId: number, role: string): Promise<number[]> {
    if (role === "SUPPORT") return [];
    const companyTradeId = await this.getCompanyTradeId(companyId);

    if (role === "OWNER" || role === "ADMIN") {
      const perms = await this.getCompanyUserPermissions(companyId, userId);
      if (role === "OWNER" || perms.canViewAllSpecialties) {
        const tradeSpecs = await db.select({ id: specialties.id })
          .from(specialties)
          .where(eq(specialties.tradeId, companyTradeId));
        return tradeSpecs.map(s => s.id);
      }
    }
    const rows = await db.select({ specialtyId: userSpecialties.specialtyId })
      .from(userSpecialties)
      .where(and(eq(userSpecialties.userId, userId), eq(userSpecialties.companyId, companyId)));
    return rows.map(r => r.specialtyId);
  }

  async seedTrades(tradesList: Omit<Trade, "id">[]): Promise<void> {
    for (const t of tradesList) {
      const existing = await db.select().from(trades).where(eq(trades.slug, t.slug)).limit(1);
      if (existing.length === 0) {
        await db.insert(trades).values(t);
      } else {
        await db.update(trades).set({ name: t.name }).where(eq(trades.slug, t.slug));
      }
    }
  }

  async seedSpecialties(list: (Omit<Specialty, "id"> & { tradeSlug: string })[]): Promise<void> {
    const allTrades = await db.select().from(trades);
    const tradeMap = new Map(allTrades.map(t => [t.slug, t.id]));

    for (const spec of list) {
      const tradeId = tradeMap.get(spec.tradeSlug);
      if (!tradeId) continue;
      const existing = await db.select().from(specialties)
        .where(and(eq(specialties.tradeId, tradeId), eq(specialties.slug, spec.slug)))
        .limit(1);
      if (existing.length === 0) {
        await db.insert(specialties).values({ tradeId, slug: spec.slug, name: spec.name });
      } else {
        await db.update(specialties).set({ name: spec.name }).where(eq(specialties.id, existing[0].id));
      }
    }
  }

  async seedServices(servicesList: { specialtySlug: string; tradeSlug?: string; category: string; name: string; pricingUnit: string; unitPrice: string; active: boolean }[], companyId: number): Promise<void> {
    const allTrades = await db.select().from(trades);
    const tradeMap = new Map(allTrades.map(t => [t.slug, t.id]));
    const allSpecs = await db.select().from(specialties);
    const specMap = new Map<string, number>();
    for (const s of allSpecs) {
      specMap.set(`${s.tradeId}:${s.slug}`, s.id);
    }

    for (const svc of servicesList) {
      let specialtyId: number | undefined;
      if (svc.tradeSlug) {
        const tradeId = tradeMap.get(svc.tradeSlug);
        if (tradeId) {
          specialtyId = specMap.get(`${tradeId}:${svc.specialtySlug}`);
        }
      } else {
        const entries = Array.from(specMap.entries());
        for (const [key, id] of entries) {
          if (key.endsWith(`:${svc.specialtySlug}`)) {
            specialtyId = id;
            break;
          }
        }
      }
      if (!specialtyId) continue;
      const { specialtySlug, tradeSlug, ...svcData } = svc;
      const existing = await db.select().from(services)
        .where(and(eq(services.companyId, companyId), eq(services.name, svc.name)))
        .limit(1);
      if (existing.length === 0) {
        await db.insert(services).values({ ...svcData, companyId, specialtyId });
      } else {
        await db.update(services)
          .set({ ...svcData, companyId, specialtyId })
          .where(eq(services.id, existing[0].id));
      }
    }
  }

  async createUser(username: string, password: string, role: string): Promise<SafeUser> {
    const passwordHash = await bcrypt.hash(password, 10);
    const [user] = await db.insert(users).values({ username, passwordHash, role }).returning();
    return toSafeUser(user);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async getUserById(id: number): Promise<SafeUser | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user ? toSafeUser(user) : undefined;
  }

  async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  async getUserCompanyId(userId: number): Promise<number | undefined> {
    const [cu] = await db.select().from(companyUsers)
      .where(and(eq(companyUsers.userId, userId), eq(companyUsers.isActive, true)))
      .limit(1);
    return cu?.companyId;
  }

  async isUserInCompany(userId: number, companyId: number): Promise<boolean> {
    const [cu] = await db.select().from(companyUsers)
      .where(and(eq(companyUsers.userId, userId), eq(companyUsers.companyId, companyId)))
      .limit(1);
    return !!cu;
  }

  async seedDefaultUsers(): Promise<void> {
    const seedAccounts = [
      { username: "admin", password: "admin123", role: "ADMIN", globalRole: "support_admin" },
      { username: "user", password: "user123", role: "USER", globalRole: "user" },
      { username: "mateus", password: "owner123", role: "OWNER", globalRole: "support_admin" },
      { username: "brother", password: "owner123", role: "OWNER", globalRole: "user" },
    ];
    const results: string[] = [];
    for (const acct of seedAccounts) {
      const existing = await db.select().from(users).where(eq(users.username, acct.username)).limit(1);
      if (existing.length === 0) {
        await this.createUser(acct.username, acct.password, acct.role);
        await db.update(users).set({ globalRole: acct.globalRole }).where(eq(users.username, acct.username));
        results.push(`${acct.username} (${acct.role}) created`);
      } else {
        const updates: Record<string, any> = {};
        if (existing[0].role !== acct.role) updates.role = acct.role;
        if (existing[0].globalRole !== acct.globalRole) updates.globalRole = acct.globalRole;
        if (Object.keys(updates).length > 0) {
          await db.update(users).set(updates).where(eq(users.username, acct.username));
          results.push(`${acct.username} (${acct.role}) updated`);
        } else {
          results.push(`${acct.username} (${acct.role}) exists`);
        }
      }
    }
    console.log(`[User Seed] ${results.join(", ")}`);

    const carpentryTrade = await db.select().from(trades).where(eq(trades.slug, "carpentry")).limit(1);
    const carpentryTradeId = carpentryTrade[0]?.id;
    if (!carpentryTradeId) {
      console.error("[Seed] Carpentry trade not found, cannot create companies");
      return;
    }

    const seedCompanies = [
      { name: "Mateus Santana Finish Carpentry", ownerUsername: "mateus", tradeId: carpentryTradeId },
      { name: "Brother's Carpentry", ownerUsername: "brother", tradeId: carpentryTradeId },
    ];

    for (const co of seedCompanies) {
      const owner = await this.getUserByUsername(co.ownerUsername);
      if (!owner) continue;
      const existingCo = await db.select().from(companies).where(eq(companies.ownerUserId, owner.id)).limit(1);
      let companyId: number;
      if (existingCo.length === 0) {
        const [newCo] = await db.insert(companies).values({ name: co.name, tradeId: co.tradeId, ownerUserId: owner.id }).returning();
        companyId = newCo.id;
      } else {
        companyId = existingCo[0].id;
        await db.update(companies).set({ tradeId: co.tradeId }).where(eq(companies.id, companyId));
      }

      const existingCU = await db.select().from(companyUsers)
        .where(and(eq(companyUsers.companyId, companyId), eq(companyUsers.userId, owner.id)))
        .limit(1);
      if (existingCU.length === 0) {
        await db.insert(companyUsers).values({ companyId, userId: owner.id, role: "OWNER" });
      }
    }

    const adminUser = await this.getUserByUsername("admin");
    const regularUser = await this.getUserByUsername("user");
    const mateusCompany = await db.select().from(companies).where(eq(companies.name, "Mateus Santana Finish Carpentry")).limit(1);
    if (mateusCompany.length > 0 && adminUser) {
      const existing = await db.select().from(companyUsers)
        .where(and(eq(companyUsers.companyId, mateusCompany[0].id), eq(companyUsers.userId, adminUser.id)))
        .limit(1);
      if (existing.length === 0) {
        await db.insert(companyUsers).values({ companyId: mateusCompany[0].id, userId: adminUser.id, role: "ADMIN" });
      }
    }
    if (mateusCompany.length > 0 && regularUser) {
      const existing = await db.select().from(companyUsers)
        .where(and(eq(companyUsers.companyId, mateusCompany[0].id), eq(companyUsers.userId, regularUser.id)))
        .limit(1);
      if (existing.length === 0) {
        await db.insert(companyUsers).values({ companyId: mateusCompany[0].id, userId: regularUser.id, role: "USER" });
      }
    }

    const oldComboUsernames = ["carpentertest", "rooftest", "frametest", "floortest", "paintertest", "cleantest", "roof_finish_test", "frame_finish_test", "clean_owner_test", "clean_staff_test"];
    for (const uname of oldComboUsernames) {
      const u = await db.select().from(users).where(eq(users.username, uname)).limit(1);
      if (u.length > 0) {
        await db.delete(userSpecialties).where(eq(userSpecialties.userId, u[0].id));
        await db.delete(jobAssignments).where(eq(jobAssignments.userId, u[0].id));
        await db.delete(companyUsers).where(eq(companyUsers.userId, u[0].id));
        await db.delete(users).where(eq(users.id, u[0].id));
      }
    }

    if (mateusCompany.length > 0) {
      const mainCompanyId = mateusCompany[0].id;
      const allSpecs = await db.select().from(specialties);
      const specBySlug = (slug: string) => allSpecs.find(s => s.slug === slug);

      const testAccounts: { username: string; role: string; specialtySlugs: string[] }[] = [
        { username: "admin_test", role: "OWNER", specialtySlugs: ["finish", "deck", "stairs", "doors", "windows", "baseboard", "flooring", "framing", "roofing"] },
        { username: "test1", role: "USER", specialtySlugs: [] },
        { username: "test2", role: "USER", specialtySlugs: [] },
        { username: "test3", role: "USER", specialtySlugs: [] },
        { username: "test4", role: "USER", specialtySlugs: [] },
      ];

      const testPassword = "test1234";
      const testResults: string[] = [];

      for (const ta of testAccounts) {
        const existingRow = await db.select().from(users).where(eq(users.username, ta.username)).limit(1);
        let userId: number;
        const targetGlobalRole = ta.username === "admin_test" ? "support_admin" : "user";
        if (existingRow.length === 0) {
          const created = await this.createUser(ta.username, testPassword, ta.role);
          userId = created.id;
          await db.update(users).set({ globalRole: targetGlobalRole }).where(eq(users.id, userId));
          testResults.push(`${ta.username} created`);
        } else {
          userId = existingRow[0].id;
          const passwordHash = await bcrypt.hash(testPassword, 10);
          await db.update(users).set({ passwordHash, role: ta.role, globalRole: targetGlobalRole }).where(eq(users.id, userId));
          testResults.push(`${ta.username} password reset`);
        }

        if (ta.username !== "admin_test") {
          await db.delete(companyUsers).where(eq(companyUsers.userId, userId));
          await db.insert(companyUsers).values({ companyId: mainCompanyId, userId, role: ta.role });
        } else {
          const existingCU = await db.select().from(companyUsers)
            .where(and(eq(companyUsers.companyId, mainCompanyId), eq(companyUsers.userId, userId)))
            .limit(1);
          if (existingCU.length === 0) {
            await db.insert(companyUsers).values({ companyId: mainCompanyId, userId, role: ta.role });
          } else if (existingCU[0].role !== ta.role) {
            await db.update(companyUsers).set({ role: ta.role })
              .where(and(eq(companyUsers.companyId, mainCompanyId), eq(companyUsers.userId, userId)));
          }
        }

        if (ta.specialtySlugs.length > 0) {
          const specIds: number[] = [];
          for (const slug of ta.specialtySlugs) {
            const spec = specBySlug(slug);
            if (spec) specIds.push(spec.id);
          }
          if (specIds.length > 0) {
            await this.setUserSpecialties(userId, mainCompanyId, specIds);
          }
        }
      }
      console.log(`[Test User Seed] ${testResults.join(", ")}`);
    }

    const cleaningTrade = await db.select().from(trades).where(eq(trades.slug, "house_cleaning")).limit(1);
    if (cleaningTrade.length > 0) {
      const cleanTradeId = cleaningTrade[0].id;
      const cleanPassword = "test1234";
      const cleanResults: string[] = [];

      const hcRow = await db.select().from(users).where(eq(users.username, "houseclean1")).limit(1);
      let hcUserId: number;
      if (hcRow.length === 0) {
        const created = await this.createUser("houseclean1", cleanPassword, "OWNER");
        hcUserId = created.id;
        cleanResults.push("houseclean1 created");
      } else {
        hcUserId = hcRow[0].id;
        const ph = await bcrypt.hash(cleanPassword, 10);
        await db.update(users).set({ passwordHash: ph, role: "OWNER" }).where(eq(users.id, hcUserId));
        cleanResults.push("houseclean1 password reset");
      }

      const existingCleanCo = await db.select().from(companies).where(eq(companies.name, "Clean Pro House Cleaning")).limit(1);
      let cleanCompanyId: number;
      if (existingCleanCo.length === 0) {
        const [newCo] = await db.insert(companies).values({ name: "Clean Pro House Cleaning", tradeId: cleanTradeId, ownerUserId: hcUserId }).returning();
        cleanCompanyId = newCo.id;
      } else {
        cleanCompanyId = existingCleanCo[0].id;
        await db.update(companies).set({ tradeId: cleanTradeId, ownerUserId: hcUserId }).where(eq(companies.id, cleanCompanyId));
      }

      const hcCU = await db.select().from(companyUsers)
        .where(and(eq(companyUsers.companyId, cleanCompanyId), eq(companyUsers.userId, hcUserId)))
        .limit(1);
      if (hcCU.length === 0) {
        await db.insert(companyUsers).values({ companyId: cleanCompanyId, userId: hcUserId, role: "OWNER" });
      }

      const allCleanSpecs = await db.select().from(specialties).where(eq(specialties.tradeId, cleanTradeId));
      if (allCleanSpecs.length > 0) {
        await this.setUserSpecialties(hcUserId, cleanCompanyId, allCleanSpecs.map(s => s.id));
      }

      console.log(`[Clean Test Seed] ${cleanResults.join(", ")}`);
    }
  }

  async getCompanyUsers(companyId: number): Promise<(Omit<CompanyUser, "permissions"> & { username: string; permissions: Permissions })[]> {
    const cuList = await db.select().from(companyUsers)
      .where(and(eq(companyUsers.companyId, companyId), eq(companyUsers.isActive, true)));
    const result: (Omit<CompanyUser, "permissions"> & { username: string; permissions: Permissions })[] = [];
    for (const cu of cuList) {
      const user = await this.getUserById(cu.userId);
      if (user) {
        const perms = parsePermissions(cu.permissions);
        const { permissions: _raw, ...rest } = cu;
        result.push({ ...rest, username: user.username, permissions: perms });
      }
    }
    return result;
  }

  async getAllCompanyUsers(companyId: number): Promise<(Omit<CompanyUser, "permissions"> & { username: string; permissions: Permissions })[]> {
    const cuList = await db.select().from(companyUsers)
      .where(eq(companyUsers.companyId, companyId));
    const result: (Omit<CompanyUser, "permissions"> & { username: string; permissions: Permissions })[] = [];
    for (const cu of cuList) {
      const user = await this.getUserById(cu.userId);
      if (user) {
        const perms = parsePermissions(cu.permissions);
        const { permissions: _raw, ...rest } = cu;
        result.push({ ...rest, username: user.username, permissions: perms });
      }
    }
    return result;
  }

  async renameUser(userId: number, newUsername: string): Promise<void> {
    await db.update(users)
      .set({ username: newUsername })
      .where(eq(users.id, userId));
  }

  async searchCompanyUserByUsername(companyId: number, username: string): Promise<(Omit<CompanyUser, "permissions"> & { username: string; permissions: Permissions }) | undefined> {
    const allUsers = await this.getAllCompanyUsers(companyId);
    return allUsers.find(u => u.username.toLowerCase() === username.toLowerCase());
  }

  async getCompanyUserPermissions(companyId: number, userId: number): Promise<Permissions> {
    const [cu] = await db.select().from(companyUsers)
      .where(and(eq(companyUsers.companyId, companyId), eq(companyUsers.userId, userId)))
      .limit(1);
    if (!cu) return { ...DEFAULT_EMPLOYEE_PERMISSIONS };
    return parsePermissions(cu.permissions);
  }

  async updateCompanyUserPermissions(companyId: number, userId: number, permissions: Partial<Permissions>): Promise<void> {
    const [cu] = await db.select().from(companyUsers)
      .where(and(eq(companyUsers.companyId, companyId), eq(companyUsers.userId, userId)))
      .limit(1);
    if (!cu) return;
    const existing = parsePermissions(cu.permissions);
    const updated = { ...existing, ...permissions };
    await db.update(companyUsers)
      .set({ permissions: JSON.stringify(updated) })
      .where(eq(companyUsers.id, cu.id));
  }

  async setUserActive(companyId: number, userId: number, isActive: boolean): Promise<void> {
    await db.update(companyUsers)
      .set({ isActive })
      .where(and(eq(companyUsers.companyId, companyId), eq(companyUsers.userId, userId)));
  }

  async updateServicePricing(serviceId: number, companyId: number, pricingUnit: string, unitPrice: string): Promise<Service | undefined> {
    const result = await db.update(services)
      .set({ pricingUnit, unitPrice })
      .where(and(eq(services.id, serviceId), eq(services.companyId, companyId)))
      .returning();
    return result[0];
  }

  async resetUserPassword(userId: number, newPassword: string): Promise<void> {
    const hash = await bcrypt.hash(newPassword, 10);
    await db.update(users)
      .set({ passwordHash: hash })
      .where(eq(users.id, userId));
  }

  async assignJobUser(jobId: number, userId: number, permissions?: Partial<Permissions>): Promise<void> {
    const perms = { ...DEFAULT_EMPLOYEE_PERMISSIONS, ...(permissions || {}) };
    const permissionsJson = JSON.stringify(perms);
    const existing = await db.select().from(jobAssignments)
      .where(and(eq(jobAssignments.jobId, jobId), eq(jobAssignments.userId, userId)))
      .limit(1);
    if (existing.length > 0) {
      await db.update(jobAssignments)
        .set({ permissions: permissionsJson })
        .where(eq(jobAssignments.id, existing[0].id));
    } else {
      await db.insert(jobAssignments).values({ jobId, userId, permissions: permissionsJson });
    }
  }

  async getJobAssignments(jobId: number, companyId?: number): Promise<any[]> {
    const assignments = await db.select().from(jobAssignments)
      .where(eq(jobAssignments.jobId, jobId));
    const result = [];
    for (const a of assignments) {
      const user = await this.getUserById(a.userId);
      if (user) {
        const jobPerms = parsePermissions(a.permissions);
        let companyPerms: Permissions | undefined;
        if (companyId) {
          companyPerms = await this.getCompanyUserPermissions(companyId, a.userId);
        }
        result.push({
          ...a,
          permissions: jobPerms,
          companyPermissions: companyPerms,
          username: user.username,
        });
      }
    }
    return result;
  }

  async updateAssignmentPermissions(jobId: number, userId: number, permissions: Partial<Permissions>): Promise<void> {
    const [assignment] = await db.select().from(jobAssignments)
      .where(and(eq(jobAssignments.jobId, jobId), eq(jobAssignments.userId, userId)))
      .limit(1);
    if (!assignment) return;
    const existing = parsePermissions(assignment.permissions);
    const updated = { ...existing, ...permissions };
    await db.update(jobAssignments)
      .set({ permissions: JSON.stringify(updated) })
      .where(eq(jobAssignments.id, assignment.id));
  }

  async logAudit(companyId: number, actorUserId: number, action: string, jobId?: number, meta?: string): Promise<void> {
    await db.insert(auditLog).values({ companyId, actorUserId, action, jobId, meta });
  }

  async getAuditLog(jobId: number): Promise<AuditLogEntry[]> {
    return await db.select().from(auditLog)
      .where(eq(auditLog.jobId, jobId))
      .orderBy(auditLog.createdAt);
  }

  async getRegions(): Promise<Region[]> {
    return await db.select().from(regions).orderBy(asc(regions.id));
  }

  async getPricingRules(opts: { regionId?: number; tradeId?: number; specialtyId?: number; unit?: string }): Promise<PricingRule[]> {
    const conditions = [];
    if (opts.regionId) conditions.push(eq(pricingRules.regionId, opts.regionId));
    if (opts.tradeId) conditions.push(eq(pricingRules.tradeId, opts.tradeId));
    if (opts.specialtyId) conditions.push(eq(pricingRules.specialtyId, opts.specialtyId));
    if (opts.unit) conditions.push(eq(pricingRules.unit, opts.unit));

    if (conditions.length > 0) {
      return await db.select().from(pricingRules)
        .where(and(...conditions))
        .orderBy(asc(pricingRules.id));
    }
    return await db.select().from(pricingRules).orderBy(asc(pricingRules.id));
  }

  async createPricingRule(rule: InsertPricingRule): Promise<PricingRule> {
    const [created] = await db.insert(pricingRules).values(rule).returning();
    return created;
  }

  async updatePricingRule(id: number, updates: Partial<InsertPricingRule>): Promise<PricingRule | undefined> {
    const [updated] = await db.update(pricingRules)
      .set(updates)
      .where(eq(pricingRules.id, id))
      .returning();
    return updated;
  }

  async createEstimatePhoto(data: { jobId?: number; companyId: number; url: string; notes?: string }): Promise<EstimatePhoto> {
    const [created] = await db.insert(estimatePhotos).values(data).returning();
    return created;
  }

  async getEstimatePhotos(jobId: number): Promise<EstimatePhoto[]> {
    return await db.select().from(estimatePhotos)
      .where(eq(estimatePhotos.jobId, jobId))
      .orderBy(asc(estimatePhotos.id));
  }

  async seedRegions(): Promise<void> {
    const seedList = [
      { code: "MA", name: "Massachusetts" },
      { code: "RI", name: "Rhode Island" },
    ];
    for (const r of seedList) {
      const existing = await db.select().from(regions).where(eq(regions.code, r.code)).limit(1);
      if (existing.length === 0) {
        await db.insert(regions).values(r);
      }
    }
  }

  async seedPricingRules(): Promise<void> {
    await this.seedRegions();
    const [maRegion] = await db.select().from(regions).where(eq(regions.code, "MA")).limit(1);
    if (!maRegion) return;

    const allTrades = await db.select().from(trades);
    const tradeMap = new Map(allTrades.map(t => [t.slug, t.id]));

    const tradeRules: Record<string, Record<string, string>> = {
      carpentry: { LF: "8.00", EA: "150.00", SF: "12.00", HR: "65.00", JOB: "500.00" },
      painting: { SF: "2.50", LF: "3.50", EA: "80.00", HR: "65.00" },
      tile: { SF: "12.00", EA: "50.00", HR: "65.00" },
      house_cleaning: { JOB: "300.00", EA: "30.00", HR: "65.00" },
    };

    for (const [slug, unitPrices] of Object.entries(tradeRules)) {
      const tradeId = tradeMap.get(slug);
      if (!tradeId) continue;
      for (const [unit, basePrice] of Object.entries(unitPrices)) {
        const existing = await db.select().from(pricingRules)
          .where(and(
            eq(pricingRules.regionId, maRegion.id),
            eq(pricingRules.tradeId, tradeId),
            eq(pricingRules.unit, unit),
          ))
          .limit(1);
        if (existing.length === 0) {
          await db.insert(pricingRules).values({
            regionId: maRegion.id,
            tradeId,
            specialtyId: null,
            unit,
            basePrice,
            anchorMultiplier: "1.15",
            enabled: true,
          });
        }
      }
    }
  }

  async createInviteToken(data: { companyId: number; createdBy: number; role: string; expiresAt: Date; token: string }): Promise<InviteToken> {
    const [created] = await db.insert(inviteTokens).values(data).returning();
    return created;
  }

  async getInviteToken(token: string): Promise<InviteToken | undefined> {
    const [row] = await db.select().from(inviteTokens).where(eq(inviteTokens.token, token)).limit(1);
    return row;
  }

  async markInviteTokenUsed(token: string, userId: number): Promise<void> {
    await db.update(inviteTokens)
      .set({ usedAt: new Date(), usedBy: userId })
      .where(eq(inviteTokens.token, token));
  }

  async getInvitesByCompany(companyId: number): Promise<InviteToken[]> {
    return await db.select().from(inviteTokens)
      .where(eq(inviteTokens.companyId, companyId))
      .orderBy(desc(inviteTokens.createdAt));
  }

  async assignUserToCompany(userId: number, companyId: number, role: string): Promise<void> {
    const existing = await db.select().from(companyUsers)
      .where(and(eq(companyUsers.companyId, companyId), eq(companyUsers.userId, userId)))
      .limit(1);
    if (existing.length === 0) {
      await db.insert(companyUsers).values({ companyId, userId, role });
    }
  }

  async getCompanyById(companyId: number): Promise<Company | undefined> {
    const [company] = await db.select().from(companies).where(eq(companies.id, companyId));
    return company;
  }
}

export const storage = new DatabaseStorage();
