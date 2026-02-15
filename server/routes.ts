import type { Express, Request, Response, NextFunction } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { loginSchema, permissionsSchema, insertPricingRuleSchema, insertCompanySettingsSchema, isSupportAdmin } from "@shared/schema";
import crypto from "crypto";

async function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    return res.status(401).json({ message: "Not authenticated" });
  }
  if (!req.session.companyId) {
    const companyId = await storage.getUserCompanyId(req.session.userId);
    if (!companyId) {
      return res.status(403).json({ message: "No company assigned" });
    }
    req.session.companyId = companyId;
  }
  next();
}

function assertCanViewPrices(perms: any) {
  if (!perms?.canViewPrices) {
    const err: any = new Error("FORBIDDEN_PRICING");
    err.status = 403;
    throw err;
  }
}

function stripPrices(services: any[]) {
  return services.map(s => ({ ...s, unitPrice: null }));
}

function assertCanEditPrices(perms: any) {
  if (!perms?.canEditPrices) {
    const err: any = new Error("FORBIDDEN_PRICING");
    err.status = 403;
    throw err;
  }
}

function requireAdminOrOwner(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    return res.status(401).json({ message: "Not authenticated" });
  }
  if (req.session.role !== "ADMIN" && req.session.role !== "OWNER") {
    return res.status(403).json({ message: "Admin or owner access required" });
  }
  next();
}

function requireSupport(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    return res.status(401).json({ message: "Not authenticated" });
  }
  if (req.session.role !== "SUPPORT" && req.session.role !== "ADMIN" && req.session.role !== "OWNER") {
    return res.status(403).json({ message: "Support access required" });
  }
  next();
}

async function requireSupportAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    return res.status(401).json({ message: "Not authenticated" });
  }
  const user = await storage.getUserById(req.session.userId);
  if (!user || !isSupportAdmin(user.username, user.globalRole)) {
    return res.status(403).json({ message: "Support admin access required" });
  }
  next();
}

const SEED_TRADES = [
  { slug: "carpentry", name: "Carpentry" },
  { slug: "painting", name: "Painting" },
  { slug: "tile", name: "Tile" },
  { slug: "house_cleaning", name: "House Cleaning" },
];

const SEED_SPECIALTIES = [
  { tradeSlug: "carpentry", slug: "finish", name: "Finish Carpentry", tradeId: 0 },
  { tradeSlug: "carpentry", slug: "deck", name: "Deck", tradeId: 0 },
  { tradeSlug: "carpentry", slug: "stairs", name: "Stairs", tradeId: 0 },
  { tradeSlug: "carpentry", slug: "doors", name: "Doors", tradeId: 0 },
  { tradeSlug: "carpentry", slug: "windows", name: "Windows", tradeId: 0 },
  { tradeSlug: "carpentry", slug: "baseboard", name: "Baseboard / Trim", tradeId: 0 },
  { tradeSlug: "carpentry", slug: "flooring", name: "Floor", tradeId: 0 },
  { tradeSlug: "carpentry", slug: "framing", name: "Frame", tradeId: 0 },
  { tradeSlug: "carpentry", slug: "roofing", name: "Roof", tradeId: 0 },
  { tradeSlug: "painting", slug: "general", name: "Painting", tradeId: 0 },
  { tradeSlug: "tile", slug: "general", name: "Tile", tradeId: 0 },
  { tradeSlug: "house_cleaning", slug: "general", name: "House Cleaning", tradeId: 0 },
];

const SEED_SERVICES: any[] = [
  // BASEBOARD / TRIM (specialty: baseboard)
  { specialtySlug: "baseboard", category: "Trim", name: "Baseboard", pricingUnit: "LF", unitPrice: "6.00", active: true },
  { specialtySlug: "baseboard", category: "Trim", name: "Crown Molding", pricingUnit: "LF", unitPrice: "10.00", active: true },
  { specialtySlug: "baseboard", category: "Trim", name: "Interior Door Trim (only)", pricingUnit: "EA", unitPrice: "140.00", active: true },
  { specialtySlug: "baseboard", category: "Trim", name: "Interior Window Trim (only)", pricingUnit: "EA", unitPrice: "120.00", active: true },
  { specialtySlug: "baseboard", category: "Trim Ext", name: "Exterior Window Trim (PVC/EZ)", pricingUnit: "EA", unitPrice: "110.00", active: true },
  { specialtySlug: "baseboard", category: "Trim Ext", name: "Exterior Door Trim (PVC/EZ)", pricingUnit: "EA", unitPrice: "140.00", active: true },
  { specialtySlug: "baseboard", category: "Trim Ext", name: "Gable / Frontão (trim + detail)", pricingUnit: "JOB", unitPrice: "1200.00", active: true },
  { specialtySlug: "baseboard", category: "Trim Ext", name: "Exterior Shiplap", pricingUnit: "SF", unitPrice: "18.00", active: true },
  { specialtySlug: "baseboard", category: "Trim Ext", name: "Exterior Bigboard", pricingUnit: "SF", unitPrice: "18.00", active: true },
  // DOORS (specialty: doors)
  { specialtySlug: "doors", category: "Doors", name: "Install/Adjust Interior Door (no trim)", pricingUnit: "EA", unitPrice: "120.00", active: true },
  { specialtySlug: "doors", category: "Doors", name: "Interior Door Complete (install + trim)", pricingUnit: "EA", unitPrice: "180.00", active: true },
  { specialtySlug: "doors", category: "Doors Ext", name: "Install Exterior Door (standard)", pricingUnit: "EA", unitPrice: "450.00", active: true },
  { specialtySlug: "doors", category: "Doors Ext", name: "Large Door (French/Slider/Double)", pricingUnit: "EA", unitPrice: "700.00", active: true },
  { specialtySlug: "doors", category: "Jamb", name: "2\" Extension – Door/Slider (standard)", pricingUnit: "EA", unitPrice: "90.00", active: true },
  { specialtySlug: "doors", category: "Jamb", name: "Full Interior Box – Exterior Door", pricingUnit: "EA", unitPrice: "220.00", active: true },
  // WINDOWS (specialty: windows)
  { specialtySlug: "windows", category: "Windows", name: "Interior Window Complete (box + trim)", pricingUnit: "EA", unitPrice: "280.00", active: true },
  { specialtySlug: "windows", category: "Windows", name: "Window Installation", pricingUnit: "EA", unitPrice: "280.00", active: true },
  { specialtySlug: "windows", category: "Windows", name: "Window Int + Ext Package", pricingUnit: "EA", unitPrice: "650.00", active: true },
  { specialtySlug: "windows", category: "Jamb", name: "2\" Extension – Window (standard)", pricingUnit: "EA", unitPrice: "60.00", active: true },
  { specialtySlug: "windows", category: "Jamb", name: "Full Interior Box – Window", pricingUnit: "EA", unitPrice: "180.00", active: true },
  // STAIRS (specialty: stairs)
  { specialtySlug: "stairs", category: "Stairs", name: "Treads / Steps", pricingUnit: "EA", unitPrice: "75.00", active: true },
  { specialtySlug: "stairs", category: "Stairs", name: "Risers", pricingUnit: "EA", unitPrice: "45.00", active: true },
  { specialtySlug: "stairs", category: "Stairs", name: "Skirt / Lateral (1 side)", pricingUnit: "EA", unitPrice: "65.00", active: true },
  { specialtySlug: "stairs", category: "Stairs", name: "Skirt Double (2 sides)", pricingUnit: "EA", unitPrice: "120.00", active: true },
  { specialtySlug: "stairs", category: "Stairs", name: "Skirt Top Molding", pricingUnit: "LF", unitPrice: "18.00", active: true },
  { specialtySlug: "stairs", category: "Handrail", name: "Handrail – Wood (interior)", pricingUnit: "LF", unitPrice: "70.00", active: true },
  { specialtySlug: "stairs", category: "Handrail", name: "Handrail – with Curve/Angle", pricingUnit: "LF", unitPrice: "95.00", active: true },
  { specialtySlug: "stairs", category: "Handrail", name: "Handrail Bracket (standard)", pricingUnit: "EA", unitPrice: "25.00", active: true },
  { specialtySlug: "stairs", category: "Handrail", name: "Handrail Bracket (hard wall)", pricingUnit: "EA", unitPrice: "40.00", active: true },
  // FINISH CARPENTRY (specialty: finish)
  { specialtySlug: "finish", category: "Shiplap", name: "Shiplap – Wall (interior)", pricingUnit: "SF", unitPrice: "10.00", active: true },
  { specialtySlug: "finish", category: "Shiplap", name: "Shiplap – Ceiling (interior)", pricingUnit: "SF", unitPrice: "14.00", active: true },
  { specialtySlug: "finish", category: "Shiplap", name: "Bigboard / Wood Ceiling", pricingUnit: "SF", unitPrice: "14.00", active: true },
  { specialtySlug: "finish", category: "Kitchen", name: "Cabinets Install – Simple", pricingUnit: "LF", unitPrice: "80.00", active: true },
  { specialtySlug: "finish", category: "Kitchen", name: "Cabinets Install – Medium", pricingUnit: "LF", unitPrice: "120.00", active: true },
  { specialtySlug: "finish", category: "Kitchen", name: "Cabinets Install – High End", pricingUnit: "LF", unitPrice: "160.00", active: true },
  { specialtySlug: "finish", category: "Kitchen", name: "Kitchen Trim / Finish", pricingUnit: "JOB", unitPrice: "250.00", active: true },
  { specialtySlug: "finish", category: "Kitchen", name: "Microwave Installation", pricingUnit: "EA", unitPrice: "150.00", active: true },
  { specialtySlug: "finish", category: "Kitchen", name: "Range Hood / Coifa Install", pricingUnit: "EA", unitPrice: "180.00", active: true },
  { specialtySlug: "finish", category: "Flooring", name: "LVP / Vinyl – Installation", pricingUnit: "SF", unitPrice: "3.00", active: true },
  { specialtySlug: "finish", category: "Flooring", name: "Floor Transitions / Trim", pricingUnit: "EA", unitPrice: "35.00", active: true },
  { specialtySlug: "finish", category: "Extras", name: "Shelf / Prateleira", pricingUnit: "EA", unitPrice: "180.00", active: true },
  { specialtySlug: "finish", category: "Extras", name: "Fireplace Frame (frame only)", pricingUnit: "JOB", unitPrice: "850.00", active: true },
  { specialtySlug: "finish", category: "Extras", name: "Small Fixes / Hourly", pricingUnit: "HR", unitPrice: "65.00", active: true },
  { specialtySlug: "finish", category: "Other", name: "Custom Item (free text)", pricingUnit: "EA", unitPrice: "0.00", active: true },
  // DECK (specialty: deck)
  { specialtySlug: "deck", category: "Deck", name: "Deck – Wood (PT/Pine/Cedar)", pricingUnit: "SF", unitPrice: "45.00", active: true },
  { specialtySlug: "deck", category: "Deck", name: "Deck – PVC/Synthetic (Trex/Azek)", pricingUnit: "SF", unitPrice: "65.00", active: true },
  { specialtySlug: "deck", category: "Deck", name: "Deck – Hardwood (Garapa/Ipe/Cumaru)", pricingUnit: "SF", unitPrice: "75.00", active: true },
  { specialtySlug: "deck", category: "Deck", name: "Deck – Hardwood Premium (oil/finish)", pricingUnit: "SF", unitPrice: "95.00", active: true },
  { specialtySlug: "deck", category: "Deck", name: "Deck Frame (structure)", pricingUnit: "SF", unitPrice: "18.00", active: true },
  { specialtySlug: "deck", category: "Deck", name: "Steps – Exterior Deck", pricingUnit: "EA", unitPrice: "180.00", active: true },
  { specialtySlug: "deck", category: "Deck", name: "Frame – Exterior Stairs", pricingUnit: "JOB", unitPrice: "900.00", active: true },
  { specialtySlug: "deck", category: "Deck", name: "Soffit / Ceiling – Wood", pricingUnit: "SF", unitPrice: "14.00", active: true },
  { specialtySlug: "deck", category: "Deck", name: "Soffit / Ceiling – PVC", pricingUnit: "SF", unitPrice: "18.00", active: true },
  { specialtySlug: "deck", category: "Deck", name: "Soffit / Ceiling – Hardwood (Garapa)", pricingUnit: "SF", unitPrice: "22.00", active: true },
  { specialtySlug: "deck", category: "Deck", name: "EZ / Fascia / Side Wrap", pricingUnit: "LF", unitPrice: "14.00", active: true },
  { specialtySlug: "deck", category: "Railing", name: "Railing – Exterior Wood", pricingUnit: "LF", unitPrice: "90.00", active: true },
  { specialtySlug: "deck", category: "Railing", name: "Railing – Exterior PVC/EZ", pricingUnit: "LF", unitPrice: "120.00", active: true },
  { specialtySlug: "deck", category: "Railing", name: "Railing – Exterior Metal", pricingUnit: "LF", unitPrice: "130.00", active: true },
  { specialtySlug: "deck", category: "Railing", name: "Railing – Interior Wood", pricingUnit: "LF", unitPrice: "70.00", active: true },
  { specialtySlug: "deck", category: "Railing", name: "Railing – Interior Metal", pricingUnit: "LF", unitPrice: "90.00", active: true },
  { specialtySlug: "deck", category: "Railing", name: "Railing – Interior PVC", pricingUnit: "LF", unitPrice: "95.00", active: true },
  // FLOOR (specialty: flooring)
  { specialtySlug: "flooring", category: "Flooring", name: "LVP / Vinyl – Installation", pricingUnit: "SF", unitPrice: "3.00", active: true },
  { specialtySlug: "flooring", category: "Flooring", name: "Hardwood Floor – Install", pricingUnit: "SF", unitPrice: "8.00", active: true },
  { specialtySlug: "flooring", category: "Flooring", name: "Hardwood Floor – Sand & Finish", pricingUnit: "SF", unitPrice: "5.00", active: true },
  { specialtySlug: "flooring", category: "Flooring", name: "Engineered Wood – Install", pricingUnit: "SF", unitPrice: "6.00", active: true },
  { specialtySlug: "flooring", category: "Flooring", name: "Laminate – Install", pricingUnit: "SF", unitPrice: "3.50", active: true },
  { specialtySlug: "flooring", category: "Flooring", name: "Subfloor Repair / Leveling", pricingUnit: "SF", unitPrice: "4.00", active: true },
  { specialtySlug: "flooring", category: "Transitions", name: "Floor Transitions / Trim", pricingUnit: "EA", unitPrice: "35.00", active: true },
  { specialtySlug: "flooring", category: "Transitions", name: "Threshold / Reducer Strip", pricingUnit: "EA", unitPrice: "40.00", active: true },
  { specialtySlug: "flooring", category: "Other", name: "Floor Removal (existing)", pricingUnit: "SF", unitPrice: "2.50", active: true },
  { specialtySlug: "flooring", category: "Other", name: "Custom Item (free text)", pricingUnit: "EA", unitPrice: "0.00", active: true },
  // FRAME (specialty: framing)
  { specialtySlug: "framing", category: "Framing", name: "Wall Framing – Interior", pricingUnit: "LF", unitPrice: "12.00", active: true },
  { specialtySlug: "framing", category: "Framing", name: "Wall Framing – Exterior", pricingUnit: "LF", unitPrice: "18.00", active: true },
  { specialtySlug: "framing", category: "Framing", name: "Header / Beam Install", pricingUnit: "EA", unitPrice: "350.00", active: true },
  { specialtySlug: "framing", category: "Framing", name: "Sistering / Joist Repair", pricingUnit: "EA", unitPrice: "120.00", active: true },
  { specialtySlug: "framing", category: "Framing", name: "Blocking / Backing", pricingUnit: "EA", unitPrice: "25.00", active: true },
  { specialtySlug: "framing", category: "Structure", name: "Floor Joist – Install / Replace", pricingUnit: "LF", unitPrice: "14.00", active: true },
  { specialtySlug: "framing", category: "Structure", name: "Subfloor – Install / Replace", pricingUnit: "SF", unitPrice: "5.00", active: true },
  { specialtySlug: "framing", category: "Structure", name: "Ceiling Joist / Rafter", pricingUnit: "LF", unitPrice: "16.00", active: true },
  { specialtySlug: "framing", category: "Structure", name: "Post / Column Install", pricingUnit: "EA", unitPrice: "280.00", active: true },
  { specialtySlug: "framing", category: "Other", name: "Custom Item (free text)", pricingUnit: "EA", unitPrice: "0.00", active: true },
  // ROOF (specialty: roofing)
  { specialtySlug: "roofing", category: "Roofing", name: "Shingle Install – Standard (3-tab)", pricingUnit: "SQ", unitPrice: "350.00", active: true },
  { specialtySlug: "roofing", category: "Roofing", name: "Shingle Install – Architectural", pricingUnit: "SQ", unitPrice: "450.00", active: true },
  { specialtySlug: "roofing", category: "Roofing", name: "Roof Tear-Off (1 layer)", pricingUnit: "SQ", unitPrice: "150.00", active: true },
  { specialtySlug: "roofing", category: "Roofing", name: "Underlayment / Felt", pricingUnit: "SQ", unitPrice: "80.00", active: true },
  { specialtySlug: "roofing", category: "Roofing", name: "Ice & Water Shield", pricingUnit: "LF", unitPrice: "8.00", active: true },
  { specialtySlug: "roofing", category: "Flashing", name: "Ridge Cap", pricingUnit: "LF", unitPrice: "12.00", active: true },
  { specialtySlug: "roofing", category: "Flashing", name: "Step Flashing", pricingUnit: "LF", unitPrice: "10.00", active: true },
  { specialtySlug: "roofing", category: "Flashing", name: "Drip Edge", pricingUnit: "LF", unitPrice: "6.00", active: true },
  { specialtySlug: "roofing", category: "Flashing", name: "Pipe Boot / Flashing", pricingUnit: "EA", unitPrice: "75.00", active: true },
  { specialtySlug: "roofing", category: "Other", name: "Skylight Install / Replace", pricingUnit: "EA", unitPrice: "800.00", active: true },
  { specialtySlug: "roofing", category: "Other", name: "Custom Item (free text)", pricingUnit: "EA", unitPrice: "0.00", active: true },
  // PAINTING (specialty: general)
  { tradeSlug: "painting", specialtySlug: "general", category: "Interior Paint", name: "Interior Walls – Standard", pricingUnit: "SF", unitPrice: "2.00", active: true },
  { tradeSlug: "painting", specialtySlug: "general", category: "Interior Paint", name: "Interior Walls – Accent/Dark", pricingUnit: "SF", unitPrice: "2.50", active: true },
  { tradeSlug: "painting", specialtySlug: "general", category: "Interior Paint", name: "Ceiling Paint", pricingUnit: "SF", unitPrice: "2.00", active: true },
  { tradeSlug: "painting", specialtySlug: "general", category: "Interior Paint", name: "Trim / Baseboard Paint", pricingUnit: "LF", unitPrice: "3.00", active: true },
  { tradeSlug: "painting", specialtySlug: "general", category: "Interior Paint", name: "Door Paint (per side)", pricingUnit: "EA", unitPrice: "100.00", active: true },
  { tradeSlug: "painting", specialtySlug: "general", category: "Interior Paint", name: "Cabinet Paint – Per Door/Drawer", pricingUnit: "EA", unitPrice: "60.00", active: true },
  { tradeSlug: "painting", specialtySlug: "general", category: "Exterior Paint", name: "Exterior Walls – Standard", pricingUnit: "SF", unitPrice: "3.00", active: true },
  { tradeSlug: "painting", specialtySlug: "general", category: "Exterior Paint", name: "Exterior Trim Paint", pricingUnit: "LF", unitPrice: "4.00", active: true },
  { tradeSlug: "painting", specialtySlug: "general", category: "Exterior Paint", name: "Deck / Fence Stain", pricingUnit: "SF", unitPrice: "3.00", active: true },
  { tradeSlug: "painting", specialtySlug: "general", category: "Prep", name: "Pressure Wash – Surface Prep", pricingUnit: "SF", unitPrice: "0.75", active: true },
  { tradeSlug: "painting", specialtySlug: "general", category: "Prep", name: "Scraping / Sanding Prep", pricingUnit: "HR", unitPrice: "65.00", active: true },
  { tradeSlug: "painting", specialtySlug: "general", category: "Prep", name: "Primer / Seal Coat", pricingUnit: "SF", unitPrice: "1.00", active: true },
  { tradeSlug: "painting", specialtySlug: "general", category: "Prep", name: "Caulking / Patching", pricingUnit: "HR", unitPrice: "65.00", active: true },
  // HOUSE CLEANING (specialty: general)
  { tradeSlug: "house_cleaning", specialtySlug: "general", category: "Standard Clean", name: "Standard House Clean – Small (up to 1500 SF)", pricingUnit: "JOB", unitPrice: "180.00", active: true },
  { tradeSlug: "house_cleaning", specialtySlug: "general", category: "Standard Clean", name: "Standard House Clean – Medium (1500–2500 SF)", pricingUnit: "JOB", unitPrice: "280.00", active: true },
  { tradeSlug: "house_cleaning", specialtySlug: "general", category: "Standard Clean", name: "Standard House Clean – Large (2500+ SF)", pricingUnit: "JOB", unitPrice: "400.00", active: true },
  { tradeSlug: "house_cleaning", specialtySlug: "general", category: "Deep Clean", name: "Deep Clean – Small (up to 1500 SF)", pricingUnit: "JOB", unitPrice: "350.00", active: true },
  { tradeSlug: "house_cleaning", specialtySlug: "general", category: "Deep Clean", name: "Deep Clean – Medium (1500–2500 SF)", pricingUnit: "JOB", unitPrice: "480.00", active: true },
  { tradeSlug: "house_cleaning", specialtySlug: "general", category: "Deep Clean", name: "Deep Clean – Large (2500+ SF)", pricingUnit: "JOB", unitPrice: "650.00", active: true },
  { tradeSlug: "house_cleaning", specialtySlug: "general", category: "Move-Out", name: "Move-Out Clean – Standard", pricingUnit: "JOB", unitPrice: "380.00", active: true },
  { tradeSlug: "house_cleaning", specialtySlug: "general", category: "Move-Out", name: "Move-Out Clean – Deep", pricingUnit: "JOB", unitPrice: "550.00", active: true },
  { tradeSlug: "house_cleaning", specialtySlug: "general", category: "Extras", name: "Window Cleaning (per window)", pricingUnit: "EA", unitPrice: "12.00", active: true },
  { tradeSlug: "house_cleaning", specialtySlug: "general", category: "Extras", name: "Oven / Appliance Deep Clean", pricingUnit: "EA", unitPrice: "55.00", active: true },
  { tradeSlug: "house_cleaning", specialtySlug: "general", category: "Extras", name: "Garage / Basement Cleanout", pricingUnit: "HR", unitPrice: "65.00", active: true },
  // TILE (specialty: general)
  { tradeSlug: "tile", specialtySlug: "general", category: "Floor Tile", name: "Floor Tile – Standard (up to 12x24)", pricingUnit: "SF", unitPrice: "10.00", active: true },
  { tradeSlug: "tile", specialtySlug: "general", category: "Floor Tile", name: "Floor Tile – Large Format (24x24+)", pricingUnit: "SF", unitPrice: "14.00", active: true },
  { tradeSlug: "tile", specialtySlug: "general", category: "Floor Tile", name: "Floor Tile – Pattern / Herringbone", pricingUnit: "SF", unitPrice: "18.00", active: true },
  { tradeSlug: "tile", specialtySlug: "general", category: "Wall Tile", name: "Wall Tile – Backsplash", pricingUnit: "SF", unitPrice: "14.00", active: true },
  { tradeSlug: "tile", specialtySlug: "general", category: "Wall Tile", name: "Wall Tile – Shower/Tub Surround", pricingUnit: "SF", unitPrice: "16.00", active: true },
  { tradeSlug: "tile", specialtySlug: "general", category: "Wall Tile", name: "Wall Tile – Accent / Mosaic", pricingUnit: "SF", unitPrice: "22.00", active: true },
  { tradeSlug: "tile", specialtySlug: "general", category: "Grout & Prep", name: "Grout – Standard (sanded/unsanded)", pricingUnit: "SF", unitPrice: "2.50", active: true },
  { tradeSlug: "tile", specialtySlug: "general", category: "Grout & Prep", name: "Grout – Epoxy", pricingUnit: "SF", unitPrice: "5.00", active: true },
  { tradeSlug: "tile", specialtySlug: "general", category: "Grout & Prep", name: "Surface Prep / Leveling", pricingUnit: "SF", unitPrice: "3.00", active: true },
  { tradeSlug: "tile", specialtySlug: "general", category: "Grout & Prep", name: "Waterproofing Membrane", pricingUnit: "SF", unitPrice: "4.00", active: true },
  { tradeSlug: "tile", specialtySlug: "general", category: "Extras", name: "Tile Removal (existing)", pricingUnit: "SF", unitPrice: "4.50", active: true },
  { tradeSlug: "tile", specialtySlug: "general", category: "Extras", name: "Threshold / Transition Strip", pricingUnit: "EA", unitPrice: "50.00", active: true },
];

async function seedData() {
  await storage.seedTrades(SEED_TRADES);
  await storage.seedSpecialties(SEED_SPECIALTIES);
  await storage.seedDefaultUsers();
  await storage.seedServices(SEED_SERVICES, 1);
  await storage.seedRegions();
  await storage.seedPricingRules();

  const allTrades = await storage.getTrades();
  const allSpecs = await storage.getSpecialties();
  console.log(`[Seed] ${allTrades.length} trades (${allTrades.map(t => t.slug).join(", ")}), ${allSpecs.length} specialties`);
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  await seedData();

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { username, password } = loginSchema.parse(req.body);
      const user = await storage.getUserByUsername(username);
      if (!user) {
        return res.status(401).json({ message: "Invalid credentials" });
      }
      const valid = await storage.verifyPassword(password, user.passwordHash);
      if (!valid) {
        return res.status(401).json({ message: "Invalid credentials" });
      }
      const companyId = await storage.getUserCompanyId(user.id);
      req.session.userId = user.id;
      req.session.role = user.role;
      req.session.companyId = companyId;
      const { passwordHash, ...safeUser } = user;
      const needsOnboarding = companyId
        ? (await storage.getAllowedSpecialtyIds(user.id, companyId, user.role)).length === 0
        : true;
      const permissions = companyId
        ? await storage.getCompanyUserPermissions(companyId, user.id)
        : undefined;
      let tradeSlug: string | null = null;
      if (companyId) {
        const tradeId = await storage.getCompanyTradeId(companyId);
        const allTrades = await storage.getTrades();
        tradeSlug = allTrades.find(t => t.id === tradeId)?.slug || null;
      }
      res.json({ ...safeUser, companyId, needsOnboarding, permissions, tradeSlug, isSupportAdmin: isSupportAdmin(safeUser.username, safeUser.globalRole) });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: "Username and password are required" });
      }
      throw err;
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ message: "Logout failed" });
      }
      res.clearCookie("connect.sid");
      res.json({ message: "Logged out" });
    });
  });

  app.get("/api/auth/me", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const user = await storage.getUserById(req.session.userId);
    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }
    const companyId = await storage.getUserCompanyId(user.id);
    const needsOnboarding = companyId
      ? (await storage.getAllowedSpecialtyIds(user.id, companyId, user.role)).length === 0
      : true;
    const permissions = companyId
      ? await storage.getCompanyUserPermissions(companyId, user.id)
      : undefined;
    let tradeSlug: string | null = null;
    if (companyId) {
      const tradeId = await storage.getCompanyTradeId(companyId);
      const allTrades = await storage.getTrades();
      tradeSlug = allTrades.find(t => t.id === tradeId)?.slug || null;
    }
    res.json({ ...user, companyId, needsOnboarding, permissions, tradeSlug, isSupportAdmin: isSupportAdmin(user.username, user.globalRole) });
  });

  const registerSchema = z.object({
    username: z.string().min(3, "Username must be at least 3 characters"),
    password: z.string().min(4, "Password must be at least 4 characters"),
    role: z.enum(["ADMIN", "OWNER", "USER", "SUPPORT"]).default("USER"),
  });

  app.post("/api/auth/register", requireAdminOrOwner, async (req, res) => {
    try {
      const { username, password, role } = registerSchema.parse(req.body);
      const existing = await storage.getUserByUsername(username);
      if (existing) {
        return res.status(409).json({ message: "Username already exists" });
      }
      const user = await storage.createUser(username, password, role);
      res.status(201).json(user);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.get(api.jobs.list.path, requireAuth, async (req, res) => {
    const result = await storage.getJobs(req.session.userId!, req.session.role!, req.session.companyId!);
    res.json(result);
  });

  app.get(api.jobs.get.path, requireAuth, async (req, res) => {
    const id = Number(req.params.id);
    const job = await storage.getJob(id, req.session.userId!, req.session.role!, req.session.companyId!);
    if (!job) {
      return res.status(404).json({ message: "Job not found" });
    }
    res.json(job);
  });

  app.post(api.jobs.create.path, requireAuth, async (req, res) => {
    try {
      const companyTradeId = await storage.getCompanyTradeId(req.session.companyId!);
      if (!companyTradeId) return res.status(400).json({ message: "No trade configured for your company" });
      const body = { ...req.body, companyId: req.session.companyId!, createdBy: req.session.userId!, tradeId: companyTradeId };
      const input = api.jobs.create.input.parse(body);
      const job = await storage.createJob(input as any, req.session.userId!, req.session.companyId!);
      res.status(201).json(job);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message, field: err.errors[0].path.join(".") });
      }
      throw err;
    }
  });

  app.put(api.jobs.update.path, requireAuth, async (req, res) => {
    try {
      const companyTradeId = await storage.getCompanyTradeId(req.session.companyId!);
      if (!companyTradeId) return res.status(400).json({ message: "No trade configured for your company" });
      const body = { ...req.body, companyId: req.session.companyId!, createdBy: req.session.userId!, tradeId: companyTradeId };
      const input = api.jobs.update.input.parse(body);
      const job = await storage.updateJob(Number(req.params.id), input as any, req.session.userId!, req.session.role!, req.session.companyId!);
      if (!job) {
        return res.status(404).json({ message: "Job not found" });
      }
      res.json(job);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message, field: err.errors[0].path.join(".") });
      }
      throw err;
    }
  });

  app.delete(api.jobs.delete.path, requireAuth, async (req, res) => {
    await storage.deleteJob(Number(req.params.id), req.session.companyId!);
    res.status(204).send();
  });

  app.get(api.trades.list.path, requireAuth, async (req, res) => {
    const tradesList = await storage.getTrades();
    res.json(tradesList);
  });

  app.get(api.specialties.list.path, requireAuth, async (req, res) => {
    const tradeId = req.query.tradeId ? Number(req.query.tradeId) : undefined;
    const specList = await storage.getSpecialties(tradeId);
    res.json(specList);
  });

  app.get(api.specialties.byTrade.path, requireAuth, async (req, res) => {
    const tradeId = Number(req.params.tradeId);
    const specList = await storage.getSpecialties(tradeId);
    res.json(specList);
  });

  app.get(api.services.list.path, requireAuth, async (req, res) => {
    const servicesList = await storage.getServices({
      companyId: req.session.companyId!,
      userId: req.session.userId!,
      role: req.session.role!,
    });
    const perms = await storage.getCompanyUserPermissions(req.session.companyId!, req.session.userId!);
    res.json(perms.canViewPrices ? servicesList : stripPrices(servicesList));
  });

  app.get(api.services.byTrade.path, requireAuth, async (req, res) => {
    const servicesList = await storage.getServices({
      companyId: req.session.companyId!,
      userId: req.session.userId!,
      role: req.session.role!,
    });
    const perms = await storage.getCompanyUserPermissions(req.session.companyId!, req.session.userId!);
    res.json(perms.canViewPrices ? servicesList : stripPrices(servicesList));
  });

  app.get(api.services.bySpecialty.path, requireAuth, async (req, res) => {
    const specialtyId = Number(req.params.specialtyId);
    const servicesList = await storage.getServices({
      companyId: req.session.companyId!,
      userId: req.session.userId!,
      role: req.session.role!,
      specialtyId,
    });
    const perms = await storage.getCompanyUserPermissions(req.session.companyId!, req.session.userId!);
    res.json(perms.canViewPrices ? servicesList : stripPrices(servicesList));
  });

  app.get("/api/user/specialties", requireAuth, async (req, res) => {
    const specs = await storage.getUserSpecialties(req.session.userId!, req.session.companyId!);
    res.json(specs);
  });

  app.post("/api/onboarding/specialties", requireAuth, async (req, res) => {
    const userId = req.session.userId!;
    const { specialtyIds } = req.body as { specialtyIds: number[] };
    if (!Array.isArray(specialtyIds)) {
      return res.status(400).json({ message: "specialtyIds must be an array" });
    }
    await storage.setUserSpecialties(userId, req.session.companyId!, specialtyIds);
    res.json({ ok: true });
  });

  app.put("/api/admin/users/:userId/specialties", requireAuth, requireAdminOrOwner, async (req, res) => {
    const targetUserId = Number(req.params.userId);
    const { specialtyIds } = req.body as { specialtyIds: number[] };
    if (!Array.isArray(specialtyIds)) {
      return res.status(400).json({ message: "specialtyIds must be an array" });
    }
    const companyId = req.session.companyId!;
    const members = await storage.getCompanyUsers(companyId);
    const isMember = members.some(m => m.userId === targetUserId);
    if (!isMember) {
      return res.status(404).json({ message: "User not in your company" });
    }
    if (specialtyIds.length > 0) {
      const companyTradeId = await storage.getCompanyTradeId(companyId);
      const validSpecs = await storage.getSpecialties(companyTradeId);
      const validIds = new Set(validSpecs.map(s => s.id));
      const allValid = specialtyIds.every(id => validIds.has(id));
      if (!allValid) {
        return res.status(400).json({ message: "Invalid specialty IDs for company trade" });
      }
    }
    await storage.setUserSpecialties(targetUserId, companyId, specialtyIds);
    res.json({ ok: true });
  });

  app.get("/api/admin/users/:userId/specialties", requireAuth, requireAdminOrOwner, async (req, res) => {
    const targetUserId = Number(req.params.userId);
    const companyId = req.session.companyId!;
    const specs = await storage.getUserSpecialties(targetUserId, companyId);
    res.json(specs);
  });

  app.get("/api/services/available", requireAuth, async (req, res) => {
    const servicesList = await storage.getServices({
      companyId: req.session.companyId!,
      userId: req.session.userId!,
      role: req.session.role!,
    });
    const perms = await storage.getCompanyUserPermissions(req.session.companyId!, req.session.userId!);
    res.json(perms.canViewPrices ? servicesList : stripPrices(servicesList));
  });

  app.post("/api/jobs/:id/assignments", requireAuth, async (req, res) => {
    const jobId = Number(req.params.id);
    const job = await storage.getJob(jobId, req.session.userId!, req.session.role!, req.session.companyId!);
    if (!job) return res.status(404).json({ message: "Job not found" });

    const { userId } = req.body;
    if (!userId) return res.status(400).json({ message: "userId required" });

    await storage.assignJobUser(jobId, userId);
    res.status(201).json({ message: "Assigned" });
  });

  app.get("/api/jobs/:id/assignments", requireAuth, async (req, res) => {
    const jobId = Number(req.params.id);
    const assignments = await storage.getJobAssignments(jobId, req.session.companyId!);
    res.json(assignments);
  });

  app.patch("/api/jobs/:id/assignments/:userId/permissions", requireAuth, async (req, res) => {
    const jobId = Number(req.params.id);
    const userId = Number(req.params.userId);
    try {
      const permissions = permissionsSchema.partial().parse(req.body);
      await storage.updateAssignmentPermissions(jobId, userId, permissions);
      res.json({ message: "Updated" });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid permissions" });
      }
      throw err;
    }
  });

  app.get(api.settings.get.path, requireAuth, async (req, res) => {
    const settings = await storage.getCompanySettings(req.session.companyId!);
    res.json(settings);
  });

  app.post(api.settings.update.path, requireAuth, requireAdminOrOwner, async (req, res) => {
    const validFields = insertCompanySettingsSchema.partial().safeParse(req.body);
    if (!validFields.success) {
      return res.status(400).json({ message: "Invalid settings data", errors: validFields.error.flatten() });
    }
    const { companyId: _ignore, ...safeUpdates } = validFields.data;
    const settings = await storage.updateCompanySettings(req.session.companyId!, safeUpdates);
    res.json(settings);
  });

  app.get("/api/users", requireAuth, async (req, res) => {
    const cuList = await storage.getCompanyUsers(req.session.companyId!);
    res.json(cuList.map(cu => ({ id: cu.userId, username: cu.username, role: cu.role })));
  });

  app.patch("/api/admin/services/:id/pricing", requireAuth, async (req, res) => {
    const perms = await storage.getCompanyUserPermissions(req.session.companyId!, req.session.userId!);
    if (!perms.canEditPrices) {
      return res.status(403).json({ message: "Requires canEditPrices permission" });
    }
    const serviceId = Number(req.params.id);
    const { pricingUnit, unitPrice } = req.body;
    const validUnits = ["EA", "LF", "SF", "HR", "JOB"];
    if (!pricingUnit || !validUnits.includes(pricingUnit)) {
      return res.status(400).json({ message: `pricingUnit must be one of: ${validUnits.join(", ")}` });
    }
    if (unitPrice == null || isNaN(Number(unitPrice)) || Number(unitPrice) < 0) {
      return res.status(400).json({ message: "unitPrice must be a number >= 0" });
    }
    const updated = await storage.updateServicePricing(serviceId, req.session.companyId!, pricingUnit, String(unitPrice));
    if (!updated) {
      return res.status(404).json({ message: "Service not found" });
    }
    res.json(updated);
  });

  app.get("/api/admin/users", requireAuth, async (req, res) => {
    const perms = await storage.getCompanyUserPermissions(req.session.companyId!, req.session.userId!);
    if (!perms.canManageUsers) {
      return res.status(403).json({ message: "Requires canManageUsers permission" });
    }
    const cuList = await storage.getCompanyUsers(req.session.companyId!);
    res.json(cuList.map(cu => ({
      id: cu.userId,
      username: cu.username,
      role: cu.role,
      isActive: cu.isActive,
      permissions: cu.permissions,
    })));
  });

  app.get("/api/admin/users/:userId/permissions", requireAuth, async (req, res) => {
    const callerPerms = await storage.getCompanyUserPermissions(req.session.companyId!, req.session.userId!);
    if (!callerPerms.canManageUsers) {
      return res.status(403).json({ message: "Requires canManageUsers permission" });
    }
    const userId = Number(req.params.userId);
    const perms = await storage.getCompanyUserPermissions(req.session.companyId!, userId);
    res.json(perms);
  });

  app.patch("/api/admin/users/:userId/active", requireAuth, async (req, res) => {
    const callerPerms = await storage.getCompanyUserPermissions(req.session.companyId!, req.session.userId!);
    if (!callerPerms.canManageUsers) {
      return res.status(403).json({ message: "Requires canManageUsers permission" });
    }
    const userId = Number(req.params.userId);
    if (userId === req.session.userId) {
      return res.status(400).json({ message: "Cannot deactivate yourself" });
    }
    const { isActive } = req.body;
    if (typeof isActive !== "boolean") {
      return res.status(400).json({ message: "isActive must be a boolean" });
    }
    await storage.setUserActive(req.session.companyId!, userId, isActive);
    res.json({ message: "Updated" });
  });

  app.patch("/api/admin/users/:userId/reset-password", requireAuth, async (req, res) => {
    const callerPerms = await storage.getCompanyUserPermissions(req.session.companyId!, req.session.userId!);
    if (!callerPerms.canManageUsers) {
      return res.status(403).json({ message: "Requires canManageUsers permission" });
    }
    const userId = Number(req.params.userId);
    const { newPassword } = req.body;
    if (!newPassword || typeof newPassword !== "string" || newPassword.length < 4) {
      return res.status(400).json({ message: "Password must be at least 4 characters" });
    }
    const companyUsers = await storage.getCompanyUsers(req.session.companyId!);
    if (!companyUsers.some(cu => cu.userId === userId)) {
      return res.status(404).json({ message: "User not found in this company" });
    }
    await storage.resetUserPassword(userId, newPassword);
    res.json({ message: "Password reset" });
  });

  app.patch("/api/admin/users/:userId/permissions", requireAuth, async (req, res) => {
    const callerPerms = await storage.getCompanyUserPermissions(req.session.companyId!, req.session.userId!);
    if (!callerPerms.canManageUsers) {
      return res.status(403).json({ message: "Requires canManageUsers permission" });
    }
    const userId = Number(req.params.userId);
    try {
      const permissions = permissionsSchema.partial().parse(req.body);
      await storage.updateCompanyUserPermissions(req.session.companyId!, userId, permissions);
      res.json({ message: "Updated" });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid permissions" });
      }
      throw err;
    }
  });

  app.get(api.regions.list.path, requireAuth, async (req, res) => {
    const regionsList = await storage.getRegions();
    res.json(regionsList);
  });

  app.get(api.pricingRules.list.path, requireAuth, async (req, res) => {
    const opts: { regionId?: number; tradeId?: number; specialtyId?: number; unit?: string } = {};
    if (req.query.regionId) opts.regionId = Number(req.query.regionId);
    if (req.query.tradeId) opts.tradeId = Number(req.query.tradeId);
    if (req.query.specialtyId) opts.specialtyId = Number(req.query.specialtyId);
    if (req.query.unit) opts.unit = String(req.query.unit);
    const rules = await storage.getPricingRules(opts);
    res.json(rules);
  });

  app.post(api.pricingRules.create.path, requireAuth, requireAdminOrOwner, async (req, res) => {
    try {
      const data = insertPricingRuleSchema.parse(req.body);
      const rule = await storage.createPricingRule(data);
      res.status(201).json(rule);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message, field: err.errors[0].path.join(".") });
      }
      throw err;
    }
  });

  app.put(api.pricingRules.update.path, requireAuth, requireAdminOrOwner, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const updates = insertPricingRuleSchema.partial().parse(req.body);
      const rule = await storage.updatePricingRule(id, updates);
      if (!rule) {
        return res.status(404).json({ message: "Pricing rule not found" });
      }
      res.json(rule);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message, field: err.errors[0].path.join(".") });
      }
      throw err;
    }
  });

  app.post("/api/support/reset-password", requireAuth, requireSupportAdmin, async (req, res) => {
    try {
      const { userId, newPassword } = z.object({
        userId: z.number(),
        newPassword: z.string().min(4, "Password must be at least 4 characters"),
      }).parse(req.body);

      const targetUser = await storage.getUserById(userId);
      if (!targetUser) {
        return res.status(404).json({ message: "User not found" });
      }

      const inCompany = await storage.isUserInCompany(userId, req.session.companyId!);
      if (!inCompany) {
        return res.status(403).json({ message: "Cannot reset password for users outside your company" });
      }

      await storage.resetUserPassword(userId, newPassword);
      await storage.logAudit(req.session.companyId!, req.session.userId!, "PASSWORD_RESET", undefined, `target_user=${userId}`);
      res.json({ message: "Password reset successfully" });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.get("/api/support/users", requireAuth, requireSupportAdmin, async (req, res) => {
    const usersList = await storage.getAllCompanyUsers(req.session.companyId!);
    res.json(usersList.map(u => ({ id: u.userId, username: u.username, role: u.role, isActive: u.isActive, permissions: u.permissions })));
  });

  app.get("/api/support/users/search", requireAuth, requireSupportAdmin, async (req, res) => {
    const username = String(req.query.username || "").trim();
    if (!username) {
      return res.status(400).json({ message: "username query parameter required" });
    }
    const user = await storage.searchCompanyUserByUsername(req.session.companyId!, username);
    if (!user) {
      return res.status(404).json({ message: "User not found in your company" });
    }
    const userSpecialtyIds = await storage.getAllowedSpecialtyIds(user.userId, req.session.companyId!, user.role);
    res.json({ id: user.userId, username: user.username, role: user.role, isActive: user.isActive, permissions: user.permissions, specialtyIds: userSpecialtyIds });
  });

  app.put("/api/support/users/:userId/rename", requireAuth, requireSupportAdmin, async (req, res) => {
    try {
      const userId = Number(req.params.userId);
      const { newUsername } = z.object({
        newUsername: z.string().min(2, "Username must be at least 2 characters").max(50).regex(/^[a-zA-Z0-9_]+$/, "Only letters, numbers, and underscores"),
      }).parse(req.body);

      const inCompany = await storage.isUserInCompany(userId, req.session.companyId!);
      if (!inCompany) {
        return res.status(403).json({ message: "Cannot modify users outside your company" });
      }

      const existing = await storage.getUserByUsername(newUsername);
      if (existing && existing.id !== userId) {
        return res.status(409).json({ message: "Username already taken" });
      }

      await storage.renameUser(userId, newUsername);
      await storage.logAudit(req.session.companyId!, req.session.userId!, "USER_RENAME", undefined, `target_user=${userId},new_username=${newUsername}`);
      res.json({ message: "Username updated" });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.put("/api/support/users/:userId/active", requireAuth, requireSupportAdmin, async (req, res) => {
    const userId = Number(req.params.userId);
    const { isActive } = z.object({ isActive: z.boolean() }).parse(req.body);

    const inCompany = await storage.isUserInCompany(userId, req.session.companyId!);
    if (!inCompany) {
      return res.status(403).json({ message: "Cannot modify users outside your company" });
    }

    if (userId === req.session.userId) {
      return res.status(400).json({ message: "Cannot deactivate yourself" });
    }

    await storage.setUserActive(req.session.companyId!, userId, isActive);
    await storage.logAudit(req.session.companyId!, req.session.userId!, isActive ? "USER_ACTIVATE" : "USER_DEACTIVATE", undefined, `target_user=${userId}`);
    res.json({ message: isActive ? "User activated" : "User deactivated" });
  });

  app.get("/api/support/users/:userId/specialties", requireAuth, requireSupportAdmin, async (req, res) => {
    const userId = Number(req.params.userId);
    const inCompany = await storage.isUserInCompany(userId, req.session.companyId!);
    if (!inCompany) {
      return res.status(403).json({ message: "Cannot view users outside your company" });
    }
    const targetUser = await storage.getUserById(userId);
    const specIds = await storage.getAllowedSpecialtyIds(userId, req.session.companyId!, targetUser?.role || "USER");
    res.json(specIds);
  });

  app.put("/api/support/users/:userId/specialties", requireAuth, requireSupportAdmin, async (req, res) => {
    const userId = Number(req.params.userId);
    const { specialtyIds } = z.object({ specialtyIds: z.array(z.number()) }).parse(req.body);

    const inCompany = await storage.isUserInCompany(userId, req.session.companyId!);
    if (!inCompany) {
      return res.status(403).json({ message: "Cannot modify users outside your company" });
    }

    await storage.setUserSpecialties(userId, req.session.companyId!, specialtyIds);
    await storage.logAudit(req.session.companyId!, req.session.userId!, "SPECIALTIES_UPDATED", undefined, `target_user=${userId}`);
    res.json({ message: "Specialties updated" });
  });

  app.post(api.estimatePhotos.create.path, requireAuth, async (req, res) => {
    const { jobId, url, notes } = req.body;
    if (!url) {
      return res.status(400).json({ message: "url is required" });
    }
    const photo = await storage.createEstimatePhoto({
      jobId: jobId || undefined,
      companyId: req.session.companyId!,
      url,
      notes: notes || undefined,
    });
    res.status(201).json(photo);
  });

  app.get(api.estimatePhotos.byJob.path, requireAuth, async (req, res) => {
    const jobId = Number(req.params.id);
    const photos = await storage.getEstimatePhotos(jobId);
    res.json(photos);
  });

  app.post("/api/support/create-test-user", requireAuth, requireSupportAdmin, async (req, res) => {
    try {
      const { username, password, role } = z.object({
        username: z.string().min(2).max(50).regex(/^[a-zA-Z0-9_]+$/),
        password: z.string().min(4),
        role: z.enum(["USER", "ADMIN", "OWNER", "SUPPORT"]).default("USER"),
      }).parse(req.body);

      const existing = await storage.getUserByUsername(username);
      if (existing) {
        return res.status(409).json({ message: "Username already taken" });
      }

      const newUser = await storage.createUser(username, password, role);
      const companyId = req.session.companyId!;
      await storage.assignUserToCompany(newUser.id, companyId, role);
      await storage.logAudit(companyId, req.session.userId!, "CREATE_TEST_USER", undefined, `new_user=${newUser.id},username=${username}`);
      res.status(201).json({ id: newUser.id, username: newUser.username, role: newUser.role });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.post("/api/support/generate-signup-link", requireAuth, requireSupportAdmin, async (req, res) => {
    try {
      const { role, expiresDays } = z.object({
        role: z.enum(["USER", "ADMIN", "OWNER"]).default("USER"),
        expiresDays: z.number().min(1).max(30).default(7),
      }).parse(req.body);

      const token = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + expiresDays * 24 * 60 * 60 * 1000);
      const invite = await storage.createInviteToken({
        token,
        companyId: req.session.companyId!,
        createdBy: req.session.userId!,
        role,
        expiresAt,
      });
      await storage.logAudit(req.session.companyId!, req.session.userId!, "GENERATE_SIGNUP_LINK", undefined, `token_id=${invite.id},role=${role}`);
      res.status(201).json({ token: invite.token, expiresAt: invite.expiresAt });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.post("/api/invite/create", requireAuth, requireAdminOrOwner, async (req, res) => {
    try {
      const { role, expiresDays } = z.object({
        role: z.enum(["USER", "ADMIN"]).default("USER"),
        expiresDays: z.number().min(1).max(30).default(7),
      }).parse(req.body);

      const token = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + expiresDays * 24 * 60 * 60 * 1000);
      const invite = await storage.createInviteToken({
        token,
        companyId: req.session.companyId!,
        createdBy: req.session.userId!,
        role,
        expiresAt,
      });
      await storage.logAudit(req.session.companyId!, req.session.userId!, "CREATE_INVITE", undefined, `token_id=${invite.id},role=${role}`);
      res.status(201).json({ token: invite.token, expiresAt: invite.expiresAt });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.get("/api/invite/list", requireAuth, requireAdminOrOwner, async (req, res) => {
    const invites = await storage.getInvitesByCompany(req.session.companyId!);
    res.json(invites);
  });

  app.get("/api/invite/validate/:token", async (req, res) => {
    const invite = await storage.getInviteToken(req.params.token);
    if (!invite) {
      return res.status(404).json({ message: "Invalid invite link" });
    }
    if (invite.usedAt) {
      return res.status(410).json({ message: "This invite link has already been used" });
    }
    if (new Date() > new Date(invite.expiresAt)) {
      return res.status(410).json({ message: "This invite link has expired" });
    }
    const company = await storage.getCompanyById(invite.companyId);
    res.json({ valid: true, companyName: company?.name || "Unknown", role: invite.role });
  });

  app.post("/api/invite/signup/:token", async (req, res) => {
    try {
      const { username, password } = z.object({
        username: z.string().min(2).max(50).regex(/^[a-zA-Z0-9_]+$/, "Only letters, numbers, and underscores"),
        password: z.string().min(4, "Password must be at least 4 characters"),
      }).parse(req.body);

      const invite = await storage.getInviteToken(req.params.token);
      if (!invite) {
        return res.status(404).json({ message: "Invalid invite link" });
      }
      if (invite.usedAt) {
        return res.status(410).json({ message: "This invite link has already been used" });
      }
      if (new Date() > new Date(invite.expiresAt)) {
        return res.status(410).json({ message: "This invite link has expired" });
      }

      const existing = await storage.getUserByUsername(username);
      if (existing) {
        return res.status(409).json({ message: "Username already taken" });
      }

      const newUser = await storage.createUser(username, password, invite.role);
      await storage.assignUserToCompany(newUser.id, invite.companyId, invite.role);
      await storage.markInviteTokenUsed(invite.token, newUser.id);
      await storage.logAudit(invite.companyId, newUser.id, "SIGNUP_VIA_INVITE", undefined, `token_id=${invite.id}`);

      req.session.userId = newUser.id;
      req.session.companyId = invite.companyId;
      req.session.role = invite.role;

      res.status(201).json({
        ...newUser,
        companyId: invite.companyId,
        needsOnboarding: true,
      });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.get("/api/employees", requireAuth, requireAdminOrOwner, async (req, res) => {
    const usersList = await storage.getCompanyUsers(req.session.companyId!);
    res.json(usersList.map(u => ({
      id: u.userId,
      username: u.username,
      role: u.role,
      isActive: u.isActive,
      permissions: u.permissions,
    })));
  });

  app.put("/api/employees/:userId/active", requireAuth, requireAdminOrOwner, async (req, res) => {
    const userId = Number(req.params.userId);
    const { isActive } = z.object({ isActive: z.boolean() }).parse(req.body);

    const inCompany = await storage.isUserInCompany(userId, req.session.companyId!);
    if (!inCompany) {
      return res.status(403).json({ message: "User not in your company" });
    }
    if (userId === req.session.userId) {
      return res.status(400).json({ message: "Cannot deactivate yourself" });
    }

    await storage.setUserActive(req.session.companyId!, userId, isActive);
    await storage.logAudit(req.session.companyId!, req.session.userId!, isActive ? "EMPLOYEE_ACTIVATE" : "EMPLOYEE_DEACTIVATE", undefined, `target_user=${userId}`);
    res.json({ message: isActive ? "Employee activated" : "Employee deactivated" });
  });

  app.get("/api/schedule/jobs", requireAuth, async (req, res) => {
    const { start, end } = req.query;
    if (!start || !end) {
      return res.status(400).json({ message: "start and end query params required (YYYY-MM-DD)" });
    }
    const allJobs = await storage.getJobs(req.session.userId!, req.session.role!, req.session.companyId!);
    const filtered = allJobs.items.filter(job => {
      if (!job.scheduledAt) return false;
      const d = job.scheduledAt.slice(0, 10);
      return d >= String(start) && d <= String(end);
    });
    const withAssignments = await Promise.all(filtered.map(async (job) => {
      const assignments = await storage.getJobAssignments(job.id, req.session.companyId!);
      return { ...job, assignments };
    }));
    res.json(withAssignments);
  });

  return httpServer;
}
