import { Router, type IRouter } from "express";
import { eq, desc, and, asc, inArray } from "drizzle-orm";
import { db, professionalsTable, bookingsTable, marketRatesTable, helplineMessagesTable, appRatingsTable, serviceCategoriesTable, homeConfigTable, appCustomersTable, techFormConfigsTable, techFormSubmissionsTable, techCustomersTable, techRemindersTable, techPaymentsTable, techPaymentEntriesTable } from "@workspace/db";
import bcrypt from "bcryptjs";

// OTP helper — generates 6-digit code, returns plain text (demo: returned to client)
function genOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

// Unique code generator: prefix + 6 random uppercase alphanumeric (no confusable chars)
function genCode(prefix: string): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = prefix + '-';
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

const router: IRouter = Router();

// ── Professionals ──────────────────────────────────────────────

router.get("/booking/professionals", async (req, res): Promise<void> => {
  try {
    const conditions: any[] = [];
    if (req.query.professionType)
      conditions.push(eq(professionalsTable.professionType, req.query.professionType as string));
    if (req.query.isActive !== undefined)
      conditions.push(eq(professionalsTable.isActive, req.query.isActive === "true"));

    const rows = await db
      .select()
      .from(professionalsTable)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(professionalsTable.name);

    res.json(rows);
  } catch {
    res.status(500).json({ error: "Failed to fetch professionals" });
  }
});

router.post("/booking/professionals", async (req, res): Promise<void> => {
  try {
    const { name, professionType, phone, avatarEmoji, visitingCharge, isActive } = req.body;
    const [professional] = await db
      .insert(professionalsTable)
      .values({ name, professionType, phone, avatarEmoji: avatarEmoji ?? "👤", visitingCharge, isActive: isActive !== false })
      .returning();
    res.status(201).json(professional);
  } catch {
    res.status(500).json({ error: "Failed to create professional" });
  }
});

router.patch("/booking/professionals/:id", async (req, res): Promise<void> => {
  try {
    const id = parseInt(req.params.id);
    const [professional] = await db
      .update(professionalsTable)
      .set(req.body)
      .where(eq(professionalsTable.id, id))
      .returning();
    if (!professional) { res.status(404).json({ error: "Not found" }); return; }
    res.json(professional);
  } catch {
    res.status(500).json({ error: "Failed to update professional" });
  }
});

router.delete("/booking/professionals/:id", async (req, res): Promise<void> => {
  try {
    await db.delete(professionalsTable).where(eq(professionalsTable.id, parseInt(req.params.id)));
    res.status(204).end();
  } catch {
    res.status(500).json({ error: "Failed to delete professional" });
  }
});

// ── Bookings ──────────────────────────────────────────────

router.get("/booking/bookings", async (req, res): Promise<void> => {
  try {
    const conditions: any[] = [];
    if (req.query.professionalId)
      conditions.push(eq(bookingsTable.professionalId, parseInt(req.query.professionalId as string)));
    if (req.query.professionType)
      conditions.push(eq(bookingsTable.professionType, req.query.professionType as string));
    if (req.query.rating)
      conditions.push(eq(bookingsTable.rating, req.query.rating as string));

    const rows = await db
      .select({
        id: bookingsTable.id,
        bookingUid: bookingsTable.bookingUid,
        customerName: bookingsTable.customerName,
        phone: bookingsTable.phone,
        whatsappPhone: bookingsTable.whatsappPhone,
        houseNumber: bookingsTable.houseNumber,
        floorNumber: bookingsTable.floorNumber,
        address: bookingsTable.address,
        location: bookingsTable.location,
        bookingTime: bookingsTable.bookingTime,
        visitingCharge: bookingsTable.visitingCharge,
        professionalId: bookingsTable.professionalId,
        professionType: bookingsTable.professionType,
        rating: bookingsTable.rating,
        notes: bookingsTable.notes,
        createdAt: bookingsTable.createdAt,
        updatedAt: bookingsTable.updatedAt,
        professionalName: professionalsTable.name,
        professionalEmoji: professionalsTable.avatarEmoji,
      })
      .from(bookingsTable)
      .leftJoin(professionalsTable, eq(bookingsTable.professionalId, professionalsTable.id))
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(bookingsTable.createdAt));

    res.json(rows.map((r) => ({
      ...r,
      bookingTime: r.bookingTime ? r.bookingTime.toISOString() : null,
      visitingCharge: r.visitingCharge ? parseFloat(r.visitingCharge) : null,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    })));
  } catch {
    res.status(500).json({ error: "Failed to fetch bookings" });
  }
});

router.post("/booking/bookings", async (req, res): Promise<void> => {
  try {
    const { customerName, phone, whatsappPhone, houseNumber, floorNumber, address, location, bookingTime, visitingCharge, professionalId, professionType, notes } = req.body;

    // Generate unique booking ID
    const now = new Date();
    const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
    const rand = Math.random().toString(36).substr(2, 5).toUpperCase();
    const bookingUid = `BK-${dateStr}-${rand}`;

    const [booking] = await db
      .insert(bookingsTable)
      .values({
        bookingUid,
        customerName,
        phone,
        whatsappPhone: whatsappPhone || null,
        houseNumber: houseNumber || null,
        floorNumber: floorNumber || null,
        address: address || null,
        location: location || null,
        bookingTime: bookingTime ? new Date(bookingTime) : null,
        visitingCharge: visitingCharge ?? null,
        professionalId: professionalId ? parseInt(professionalId) : null,
        professionType,
        notes: notes || null,
      })
      .returning();

    // Get professional info for response
    let professionalName: string | null = null;
    let professionalEmoji: string | null = null;
    if (booking.professionalId) {
      const [prof] = await db.select().from(professionalsTable).where(eq(professionalsTable.id, booking.professionalId));
      professionalName = prof?.name ?? null;
      professionalEmoji = prof?.avatarEmoji ?? null;
    }

    res.status(201).json({
      ...booking,
      bookingTime: booking.bookingTime ? booking.bookingTime.toISOString() : null,
      visitingCharge: booking.visitingCharge ? parseFloat(booking.visitingCharge) : null,
      createdAt: booking.createdAt.toISOString(),
      updatedAt: booking.updatedAt.toISOString(),
      professionalName,
      professionalEmoji,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create booking" });
  }
});

router.get("/booking/bookings/:id", async (req, res): Promise<void> => {
  try {
    const id = parseInt(req.params.id);
    const [row] = await db
      .select({
        id: bookingsTable.id,
        bookingUid: bookingsTable.bookingUid,
        customerName: bookingsTable.customerName,
        phone: bookingsTable.phone,
        whatsappPhone: bookingsTable.whatsappPhone,
        houseNumber: bookingsTable.houseNumber,
        floorNumber: bookingsTable.floorNumber,
        address: bookingsTable.address,
        location: bookingsTable.location,
        bookingTime: bookingsTable.bookingTime,
        visitingCharge: bookingsTable.visitingCharge,
        professionalId: bookingsTable.professionalId,
        professionType: bookingsTable.professionType,
        rating: bookingsTable.rating,
        notes: bookingsTable.notes,
        createdAt: bookingsTable.createdAt,
        updatedAt: bookingsTable.updatedAt,
        professionalName: professionalsTable.name,
        professionalEmoji: professionalsTable.avatarEmoji,
      })
      .from(bookingsTable)
      .leftJoin(professionalsTable, eq(bookingsTable.professionalId, professionalsTable.id))
      .where(eq(bookingsTable.id, id));

    if (!row) { res.status(404).json({ error: "Not found" }); return; }
    res.json({
      ...row,
      bookingTime: row.bookingTime ? row.bookingTime.toISOString() : null,
      visitingCharge: row.visitingCharge ? parseFloat(row.visitingCharge) : null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    });
  } catch {
    res.status(500).json({ error: "Failed to fetch booking" });
  }
});

router.patch("/booking/bookings/:id", async (req, res): Promise<void> => {
  try {
    const id = parseInt(req.params.id);
    const { rating, notes, bookingTime, visitingCharge } = req.body;
    const updates: Record<string, unknown> = {};
    if (rating !== undefined) updates.rating = rating;
    if (notes !== undefined) updates.notes = notes;
    if (bookingTime !== undefined) updates.bookingTime = bookingTime ? new Date(bookingTime) : null;
    if (visitingCharge !== undefined) updates.visitingCharge = visitingCharge;

    const [booking] = await db
      .update(bookingsTable)
      .set(updates)
      .where(eq(bookingsTable.id, id))
      .returning();
    if (!booking) { res.status(404).json({ error: "Not found" }); return; }

    let professionalName: string | null = null;
    let professionalEmoji: string | null = null;
    if (booking.professionalId) {
      const [prof] = await db.select().from(professionalsTable).where(eq(professionalsTable.id, booking.professionalId));
      professionalName = prof?.name ?? null;
      professionalEmoji = prof?.avatarEmoji ?? null;
    }

    res.json({
      ...booking,
      bookingTime: booking.bookingTime ? booking.bookingTime.toISOString() : null,
      visitingCharge: booking.visitingCharge ? parseFloat(booking.visitingCharge) : null,
      createdAt: booking.createdAt.toISOString(),
      updatedAt: booking.updatedAt.toISOString(),
      professionalName,
      professionalEmoji,
    });
  } catch {
    res.status(500).json({ error: "Failed to update booking" });
  }
});

router.delete("/booking/bookings/:id", async (req, res): Promise<void> => {
  try {
    await db.delete(bookingsTable).where(eq(bookingsTable.id, parseInt(req.params.id)));
    res.status(204).end();
  } catch {
    res.status(500).json({ error: "Failed to delete booking" });
  }
});

// ── Technician Auth ──────────────────────────────────────────────

router.post("/booking/technician/signup", async (req, res): Promise<void> => {
  try {
    const { name, phone, professionType, avatarEmoji, visitingCharge } = req.body;
    if (!name?.trim() || !professionType?.trim()) {
      res.status(400).json({ error: "name and professionType are required" }); return;
    }
    let uniqueCode: string;
    // Retry until unique
    for (;;) {
      uniqueCode = genCode('TECH');
      const existing = await db.select().from(professionalsTable).where(eq(professionalsTable.uniqueCode, uniqueCode)).limit(1);
      if (existing.length === 0) break;
    }
    const [row] = await db.insert(professionalsTable).values({
      name: name.trim(), phone: phone?.trim() || null,
      professionType: professionType.trim(),
      avatarEmoji: avatarEmoji?.trim() || '🔧',
      visitingCharge: visitingCharge ? String(visitingCharge) : null,
      uniqueCode,
    }).returning();
    res.status(201).json({ ...row, visitingCharge: row.visitingCharge ? parseFloat(row.visitingCharge) : null, createdAt: row.createdAt.toISOString() });
  } catch {
    res.status(500).json({ error: "Signup failed" });
  }
});

router.post("/booking/technician/login", async (req, res): Promise<void> => {
  try {
    const { uniqueCode } = req.body;
    if (!uniqueCode) { res.status(400).json({ error: "uniqueCode required" }); return; }
    const [row] = await db.select().from(professionalsTable).where(eq(professionalsTable.uniqueCode, uniqueCode.trim().toUpperCase())).limit(1);
    if (!row) { res.status(404).json({ error: "Invalid code" }); return; }
    res.json({ ...row, visitingCharge: row.visitingCharge ? parseFloat(row.visitingCharge) : null, createdAt: row.createdAt.toISOString() });
  } catch {
    res.status(500).json({ error: "Login failed" });
  }
});

// Step 1 — validate TECH code, issue OTP (returned in response for demo; replace with SMS in production)
router.post("/booking/technician/request-otp", async (req, res): Promise<void> => {
  try {
    const { uniqueCode, phone } = req.body;
    if (!uniqueCode) { res.status(400).json({ error: "uniqueCode required" }); return; }
    if (!phone?.trim()) { res.status(400).json({ error: "Registered mobile number जरूरी है" }); return; }

    const [row] = await db.select().from(professionalsTable)
      .where(eq(professionalsTable.uniqueCode, uniqueCode.trim().toUpperCase())).limit(1);

    // Use a generic error so attackers can't enumerate valid TECH codes via phone mismatch
    const MISMATCH_ERR = "TECH code या mobile number गलत है। Account से registered number दर्ज करें।";

    if (!row) { res.status(401).json({ error: MISMATCH_ERR }); return; }

    // Account must have a registered phone — no phone = cannot use OTP login
    if (!row.phone) {
      res.status(403).json({ error: "इस account में mobile number register नहीं है। Admin से संपर्क करें।" }); return;
    }

    // Normalize both to last 10 digits and compare
    const normProvided  = phone.trim().replace(/\D/g, '').slice(-10);
    const normRegistered = row.phone.replace(/\D/g, '').slice(-10);
    if (normProvided !== normRegistered) {
      res.status(401).json({ error: MISMATCH_ERR }); return;
    }

    const otp = genOtp();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 min
    await db.update(professionalsTable)
      .set({ otpCode: otp, otpExpiresAt: expiresAt, otpAttempts: 0 } as any)
      .where(eq(professionalsTable.id, row.id));

    // Mask phone for response: show only last 4 digits  e.g. XXXXXX4321
    const masked = normRegistered.slice(0, -4).replace(/\d/g, 'X') + normRegistered.slice(-4);

    // TODO: send via SMS (e.g. MSG91/Twilio) — for now returned in response (demo mode)
    res.json({ success: true, name: row.name, maskedPhone: masked, demoOtp: otp });
  } catch { res.status(500).json({ error: "OTP request failed" }); }
});

// Step 2 — verify OTP and return technician profile
router.post("/booking/technician/verify-otp", async (req, res): Promise<void> => {
  try {
    const { uniqueCode, otp } = req.body;
    if (!uniqueCode || !otp) { res.status(400).json({ error: "uniqueCode and otp required" }); return; }
    const [row] = await db.select().from(professionalsTable)
      .where(eq(professionalsTable.uniqueCode, uniqueCode.trim().toUpperCase())).limit(1);
    if (!row) { res.status(404).json({ error: "Invalid code" }); return; }
    if (!row.otpCode || !row.otpExpiresAt) { res.status(400).json({ error: "OTP not requested" }); return; }
    if (new Date() > row.otpExpiresAt) { res.status(400).json({ error: "OTP expired — please request a new one" }); return; }
    if ((row.otpAttempts ?? 0) >= 5) { res.status(429).json({ error: "Too many attempts — please request a new OTP" }); return; }
    if (row.otpCode !== otp.trim()) {
      await db.update(professionalsTable).set({ otpAttempts: (row.otpAttempts ?? 0) + 1 } as any).where(eq(professionalsTable.id, row.id));
      res.status(401).json({ error: "Incorrect OTP" }); return;
    }
    // Clear OTP after successful verification
    await db.update(professionalsTable).set({ otpCode: null, otpExpiresAt: null, otpAttempts: 0 } as any).where(eq(professionalsTable.id, row.id));
    res.json({ ...row, visitingCharge: row.visitingCharge ? parseFloat(row.visitingCharge) : null, createdAt: row.createdAt.toISOString() });
  } catch { res.status(500).json({ error: "OTP verification failed" }); }
});

// ── Customer Auth ──────────────────────────────────────────────

router.post("/booking/customer/signup", async (req, res): Promise<void> => {
  try {
    const { name, phone } = req.body;
    if (!name?.trim()) { res.status(400).json({ error: "name is required" }); return; }
    let uniqueCode: string;
    for (;;) {
      uniqueCode = genCode('CUST');
      const existing = await db.select().from(appCustomersTable).where(eq(appCustomersTable.uniqueCode, uniqueCode)).limit(1);
      if (existing.length === 0) break;
    }
    const [row] = await db.insert(appCustomersTable).values({
      name: name.trim(), phone: phone?.trim() || null, uniqueCode,
    }).returning();
    res.status(201).json({ ...row, createdAt: row.createdAt.toISOString() });
  } catch {
    res.status(500).json({ error: "Signup failed" });
  }
});

router.post("/booking/customer/login", async (req, res): Promise<void> => {
  try {
    const { uniqueCode } = req.body;
    if (!uniqueCode) { res.status(400).json({ error: "uniqueCode required" }); return; }
    const [row] = await db.select().from(appCustomersTable).where(eq(appCustomersTable.uniqueCode, uniqueCode.trim().toUpperCase())).limit(1);
    if (!row) { res.status(404).json({ error: "Invalid code" }); return; }
    res.json({ ...row, createdAt: row.createdAt.toISOString() });
  } catch {
    res.status(500).json({ error: "Login failed" });
  }
});

// Email + Password signup
router.post("/booking/customer/signup-email", async (req, res): Promise<void> => {
  try {
    const { name, email, password, phone } = req.body;
    if (!name?.trim()) { res.status(400).json({ error: "name required" }); return; }
    if (!email?.trim()) { res.status(400).json({ error: "email required" }); return; }
    if (!password || password.length < 6) { res.status(400).json({ error: "Password कम से कम 6 characters का होना चाहिए" }); return; }
    const norm = email.trim().toLowerCase();
    const existing = await db.select().from(appCustomersTable).where(eq(appCustomersTable.email, norm)).limit(1);
    if (existing.length) { res.status(409).json({ error: "यह email already registered है" }); return; }
    const passwordHash = await bcrypt.hash(password, 10);
    let uniqueCode: string;
    for (;;) {
      uniqueCode = genCode('CUST');
      const ex = await db.select().from(appCustomersTable).where(eq(appCustomersTable.uniqueCode, uniqueCode)).limit(1);
      if (!ex.length) break;
    }
    const [row] = await db.insert(appCustomersTable).values({ name: name.trim(), email: norm, passwordHash, phone: phone?.trim() || null, uniqueCode }).returning();
    res.status(201).json({ ...row, createdAt: row.createdAt.toISOString() });
  } catch { res.status(500).json({ error: "Signup failed" }); }
});

// Email + Password login
router.post("/booking/customer/login-email", async (req, res): Promise<void> => {
  try {
    const { email, password } = req.body;
    if (!email || !password) { res.status(400).json({ error: "email and password required" }); return; }
    const [row] = await db.select().from(appCustomersTable).where(eq(appCustomersTable.email, email.trim().toLowerCase())).limit(1);
    if (!row || !row.passwordHash) { res.status(401).json({ error: "Email या Password गलत है" }); return; }
    const match = await bcrypt.compare(password, row.passwordHash);
    if (!match) { res.status(401).json({ error: "Email या Password गलत है" }); return; }
    res.json({ ...row, createdAt: row.createdAt.toISOString() });
  } catch { res.status(500).json({ error: "Login failed" }); }
});

// Phone OTP — request (finds or creates customer by phone)
router.post("/booking/customer/request-otp", async (req, res): Promise<void> => {
  try {
    const { phone } = req.body;
    if (!phone?.trim()) { res.status(400).json({ error: "phone required" }); return; }
    const norm = phone.trim().replace(/\D/g, '').slice(-10);
    if (norm.length < 10) { res.status(400).json({ error: "Valid 10-digit phone number दर्ज करें" }); return; }
    let [row] = await db.select().from(appCustomersTable).where(eq(appCustomersTable.phone, norm)).limit(1);
    if (!row) {
      // Auto-create account for new phone number
      let uniqueCode: string;
      for (;;) {
        uniqueCode = genCode('CUST');
        const ex = await db.select().from(appCustomersTable).where(eq(appCustomersTable.uniqueCode, uniqueCode)).limit(1);
        if (!ex.length) break;
      }
      [row] = await db.insert(appCustomersTable).values({ name: `User ${norm.slice(-4)}`, phone: norm, uniqueCode }).returning();
    }
    const otp = genOtp();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await db.update(appCustomersTable).set({ otpCode: otp, otpExpiresAt: expiresAt, otpAttempts: 0 } as any).where(eq(appCustomersTable.id, row.id));
    // TODO: deliver via SMS — returning in response for demo mode
    res.json({ success: true, isNew: !row.passwordHash && !row.email, demoOtp: otp });
  } catch { res.status(500).json({ error: "OTP request failed" }); }
});

// Phone OTP — verify
router.post("/booking/customer/verify-otp", async (req, res): Promise<void> => {
  try {
    const { phone, otp } = req.body;
    if (!phone || !otp) { res.status(400).json({ error: "phone and otp required" }); return; }
    const norm = phone.trim().replace(/\D/g, '').slice(-10);
    const [row] = await db.select().from(appCustomersTable).where(eq(appCustomersTable.phone, norm)).limit(1);
    if (!row) { res.status(404).json({ error: "Phone number not found" }); return; }
    if (!row.otpCode || !row.otpExpiresAt) { res.status(400).json({ error: "OTP not requested" }); return; }
    if (new Date() > row.otpExpiresAt) { res.status(400).json({ error: "OTP expired — please request a new one" }); return; }
    if ((row.otpAttempts ?? 0) >= 5) { res.status(429).json({ error: "Too many attempts" }); return; }
    if (row.otpCode !== otp.trim()) {
      await db.update(appCustomersTable).set({ otpAttempts: (row.otpAttempts ?? 0) + 1 } as any).where(eq(appCustomersTable.id, row.id));
      res.status(401).json({ error: "Incorrect OTP" }); return;
    }
    await db.update(appCustomersTable).set({ otpCode: null, otpExpiresAt: null, otpAttempts: 0 } as any).where(eq(appCustomersTable.id, row.id));
    res.json({ ...row, createdAt: row.createdAt.toISOString() });
  } catch { res.status(500).json({ error: "OTP verification failed" }); }
});

// ── Service Categories ──────────────────────────────────────────────

router.get("/booking/service-categories", async (req, res): Promise<void> => {
  try {
    const rows = await db.select().from(serviceCategoriesTable).orderBy(asc(serviceCategoriesTable.sortOrder));
    res.json(rows.map(r => ({ ...r, createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString() })));
  } catch {
    res.status(500).json({ error: "Failed to fetch service categories" });
  }
});

router.post("/booking/service-categories", async (req, res): Promise<void> => {
  try {
    const { name, icon, accent, professionType, sortOrder, isActive } = req.body;
    const [row] = await db.insert(serviceCategoriesTable).values({ name, icon, accent, professionType, sortOrder: sortOrder ?? 99, isActive: isActive ?? true }).returning();
    res.status(201).json({ ...row, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() });
  } catch {
    res.status(500).json({ error: "Failed to create service category" });
  }
});

router.patch("/booking/service-categories/:id", async (req, res): Promise<void> => {
  try {
    const id = parseInt(req.params.id);
    const { name, icon, accent, professionType, sortOrder, isActive } = req.body;
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (name !== undefined) updates.name = name;
    if (icon !== undefined) updates.icon = icon;
    if (accent !== undefined) updates.accent = accent;
    if (professionType !== undefined) updates.professionType = professionType;
    if (sortOrder !== undefined) updates.sortOrder = sortOrder;
    if (isActive !== undefined) updates.isActive = isActive;
    const [row] = await db.update(serviceCategoriesTable).set(updates).where(eq(serviceCategoriesTable.id, id)).returning();
    if (!row) { res.status(404).json({ error: "Not found" }); return; }
    res.json({ ...row, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() });
  } catch {
    res.status(500).json({ error: "Failed to update service category" });
  }
});

router.delete("/booking/service-categories/:id", async (req, res): Promise<void> => {
  try {
    await db.delete(serviceCategoriesTable).where(eq(serviceCategoriesTable.id, parseInt(req.params.id)));
    res.status(204).end();
  } catch {
    res.status(500).json({ error: "Failed to delete service category" });
  }
});

// ── Home Config ──────────────────────────────────────────────

router.get("/booking/home-config", async (req, res): Promise<void> => {
  try {
    let [row] = await db.select().from(homeConfigTable).limit(1);
    if (!row) {
      [row] = await db.insert(homeConfigTable).values({ helplineNumber: "9999999999", helplineName: "Admin Helpline", isLocked: false }).returning();
    }
    res.json({ ...row, updatedAt: row.updatedAt.toISOString() });
  } catch {
    res.status(500).json({ error: "Failed to fetch home config" });
  }
});

router.patch("/booking/home-config", async (req, res): Promise<void> => {
  try {
    const { helplineNumber, helplineName, isLocked } = req.body;
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (helplineNumber !== undefined) updates.helplineNumber = helplineNumber;
    if (helplineName !== undefined) updates.helplineName = helplineName;
    if (isLocked !== undefined) updates.isLocked = isLocked;
    let [row] = await db.update(homeConfigTable).set(updates).where(eq(homeConfigTable.id, 1)).returning();
    if (!row) {
      [row] = await db.insert(homeConfigTable).values({ helplineNumber: helplineNumber ?? "9999999999", helplineName: helplineName ?? "Admin Helpline", isLocked: isLocked ?? false }).returning();
    }
    res.json({ ...row, updatedAt: row.updatedAt.toISOString() });
  } catch {
    res.status(500).json({ error: "Failed to update home config" });
  }
});

// ── Market Rates ──────────────────────────────────────────────

router.get("/booking/market-rates", async (req, res): Promise<void> => {
  try {
    const conditions: any[] = [];
    if (req.query.professionType)
      conditions.push(eq(marketRatesTable.professionType, req.query.professionType as string));

    const rows = await db
      .select()
      .from(marketRatesTable)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(marketRatesTable.professionType, marketRatesTable.serviceName);

    res.json(rows.map(r => ({ ...r, rate: r.rate ? parseFloat(r.rate) : null, createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString() })));
  } catch {
    res.status(500).json({ error: "Failed to fetch market rates" });
  }
});

router.post("/booking/market-rates", async (req, res): Promise<void> => {
  try {
    const { professionType, serviceName, rate, unit } = req.body;
    const [row] = await db.insert(marketRatesTable).values({ professionType, serviceName, rate, unit }).returning();
    res.status(201).json({ ...row, rate: row.rate ? parseFloat(row.rate) : null, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() });
  } catch {
    res.status(500).json({ error: "Failed to create market rate" });
  }
});

router.patch("/booking/market-rates/:id", async (req, res): Promise<void> => {
  try {
    const id = parseInt(req.params.id);
    const [row] = await db.update(marketRatesTable).set(req.body).where(eq(marketRatesTable.id, id)).returning();
    if (!row) { res.status(404).json({ error: "Not found" }); return; }
    res.json({ ...row, rate: row.rate ? parseFloat(row.rate) : null, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() });
  } catch {
    res.status(500).json({ error: "Failed to update market rate" });
  }
});

router.delete("/booking/market-rates/:id", async (req, res): Promise<void> => {
  try {
    await db.delete(marketRatesTable).where(eq(marketRatesTable.id, parseInt(req.params.id)));
    res.status(204).end();
  } catch {
    res.status(500).json({ error: "Failed to delete market rate" });
  }
});

// ── Helpline ──────────────────────────────────────────────

router.get("/booking/helpline", async (req, res): Promise<void> => {
  try {
    const rows = await db.select().from(helplineMessagesTable).orderBy(desc(helplineMessagesTable.createdAt));
    res.json(rows.map(r => ({ ...r, createdAt: r.createdAt.toISOString() })));
  } catch {
    res.status(500).json({ error: "Failed to fetch helpline messages" });
  }
});

router.post("/booking/helpline", async (req, res): Promise<void> => {
  try {
    const { senderType, senderName, phone, message } = req.body;
    const [row] = await db.insert(helplineMessagesTable).values({ senderType, senderName, phone: phone || null, message }).returning();
    res.status(201).json({ ...row, createdAt: row.createdAt.toISOString() });
  } catch {
    res.status(500).json({ error: "Failed to create helpline message" });
  }
});

router.patch("/booking/helpline/:id", async (req, res): Promise<void> => {
  try {
    const id = parseInt(req.params.id);
    const { isResolved, adminReply } = req.body;
    const updates: Record<string, unknown> = {};
    if (isResolved !== undefined) updates.isResolved = isResolved;
    if (adminReply !== undefined) updates.adminReply = adminReply;
    const [row] = await db.update(helplineMessagesTable).set(updates).where(eq(helplineMessagesTable.id, id)).returning();
    if (!row) { res.status(404).json({ error: "Not found" }); return; }
    res.json({ ...row, createdAt: row.createdAt.toISOString() });
  } catch {
    res.status(500).json({ error: "Failed to update helpline message" });
  }
});

// ── App Ratings ──────────────────────────────────────────────

router.get("/booking/app-ratings", async (req, res): Promise<void> => {
  try {
    const rows = await db.select().from(appRatingsTable).orderBy(desc(appRatingsTable.createdAt));
    res.json(rows.map(r => ({ ...r, createdAt: r.createdAt.toISOString() })));
  } catch {
    res.status(500).json({ error: "Failed to fetch app ratings" });
  }
});

router.post("/booking/app-ratings", async (req, res): Promise<void> => {
  try {
    const { raterType, raterName, rating, comment } = req.body;
    const ratingNum = parseInt(rating);
    if (isNaN(ratingNum) || ratingNum < 1 || ratingNum > 5) {
      res.status(400).json({ error: "Rating must be 1–5" }); return;
    }
    const [row] = await db.insert(appRatingsTable).values({ raterType, raterName: raterName || null, rating: ratingNum, comment: comment || null }).returning();
    res.status(201).json({ ...row, createdAt: row.createdAt.toISOString() });
  } catch {
    res.status(500).json({ error: "Failed to create app rating" });
  }
});

router.get("/booking/app-ratings/summary", async (req, res): Promise<void> => {
  try {
    const rows = await db.select({ rating: appRatingsTable.rating }).from(appRatingsTable);
    const total = rows.length;
    const sum = rows.reduce((acc, r) => acc + r.rating, 0);
    const avg = total > 0 ? sum / total : 0;
    const star: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const r of rows) star[r.rating] = (star[r.rating] ?? 0) + 1;
    res.json({ totalRatings: total, averageRating: Math.round(avg * 10) / 10, star1: star[1], star2: star[2], star3: star[3], star4: star[4], star5: star[5] });
  } catch {
    res.status(500).json({ error: "Failed to get app ratings summary" });
  }
});

// ── Tech Customers ────────────────────────────────────────────────────────────

router.get("/booking/tech-customers", async (req, res): Promise<void> => {
  try {
    const { techCode } = req.query as Record<string, string>;
    if (!techCode) { res.status(400).json({ error: "techCode required" }); return; }
    const rows = await db.select().from(techCustomersTable).where(eq(techCustomersTable.techCode, techCode)).orderBy(desc(techCustomersTable.createdAt));
    res.json(rows.map(r => ({ ...r, createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString() })));
  } catch { res.status(500).json({ error: "Failed to fetch customers" }); }
});

router.post("/booking/tech-customers", async (req, res): Promise<void> => {
  try {
    const { techCode, name, phone, address, jobType, notes } = req.body;
    if (!techCode || !name || !phone) { res.status(400).json({ error: "techCode, name, phone required" }); return; }
    const [row] = await db.insert(techCustomersTable).values({ techCode, name, phone, address: address ?? null, jobType: jobType ?? null, notes: notes ?? null }).returning();
    res.status(201).json({ ...row, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() });
  } catch { res.status(500).json({ error: "Failed to create customer" }); }
});

router.patch("/booking/tech-customers/:id", async (req, res): Promise<void> => {
  try {
    const id = parseInt(req.params.id);
    const [row] = await db.update(techCustomersTable).set(req.body).where(eq(techCustomersTable.id, id)).returning();
    if (!row) { res.status(404).json({ error: "Not found" }); return; }
    res.json({ ...row, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() });
  } catch { res.status(500).json({ error: "Failed to update customer" }); }
});

router.delete("/booking/tech-customers/:id", async (req, res): Promise<void> => {
  try {
    await db.delete(techCustomersTable).where(eq(techCustomersTable.id, parseInt(req.params.id)));
    res.status(204).end();
  } catch { res.status(500).json({ error: "Failed to delete customer" }); }
});

// ── Tech Reminders ────────────────────────────────────────────────────────────

router.get("/booking/tech-reminders", async (req, res): Promise<void> => {
  try {
    const { techCode } = req.query as Record<string, string>;
    if (!techCode) { res.status(400).json({ error: "techCode required" }); return; }
    const rows = await db.select().from(techRemindersTable).where(eq(techRemindersTable.techCode, techCode)).orderBy(desc(techRemindersTable.createdAt));
    res.json(rows.map(r => ({ ...r, createdAt: r.createdAt.toISOString() })));
  } catch { res.status(500).json({ error: "Failed to fetch reminders" }); }
});

router.post("/booking/tech-reminders", async (req, res): Promise<void> => {
  try {
    const { techCode, title, note, reminderAt } = req.body;
    if (!techCode || !title) { res.status(400).json({ error: "techCode, title required" }); return; }
    const [row] = await db.insert(techRemindersTable).values({ techCode, title, note: note ?? null, reminderAt: reminderAt ?? null }).returning();
    res.status(201).json({ ...row, createdAt: row.createdAt.toISOString() });
  } catch { res.status(500).json({ error: "Failed to create reminder" }); }
});

router.patch("/booking/tech-reminders/:id", async (req, res): Promise<void> => {
  try {
    const id = parseInt(req.params.id);
    const [row] = await db.update(techRemindersTable).set(req.body).where(eq(techRemindersTable.id, id)).returning();
    if (!row) { res.status(404).json({ error: "Not found" }); return; }
    res.json({ ...row, createdAt: row.createdAt.toISOString() });
  } catch { res.status(500).json({ error: "Failed to update reminder" }); }
});

router.delete("/booking/tech-reminders/:id", async (req, res): Promise<void> => {
  try {
    await db.delete(techRemindersTable).where(eq(techRemindersTable.id, parseInt(req.params.id)));
    res.status(204).end();
  } catch { res.status(500).json({ error: "Failed to delete reminder" }); }
});

// ── Tech Payments ─────────────────────────────────────────────────────────────

router.get("/booking/tech-payments", async (req, res): Promise<void> => {
  try {
    const { techCode } = req.query as Record<string, string>;
    if (!techCode) { res.status(400).json({ error: "techCode required" }); return; }
    const rows = await db.select().from(techPaymentsTable).where(eq(techPaymentsTable.techCode, techCode)).orderBy(desc(techPaymentsTable.createdAt));
    // Fetch all entries for these payment IDs in one query
    const ids = rows.map(r => r.id);
    const entries = ids.length > 0
      ? await db.select().from(techPaymentEntriesTable).where(inArray(techPaymentEntriesTable.paymentId, ids)).orderBy(desc(techPaymentEntriesTable.createdAt))
      : [];
    const entryMap: Record<number, typeof entries> = {};
    for (const e of entries) {
      if (!entryMap[e.paymentId]) entryMap[e.paymentId] = [];
      entryMap[e.paymentId].push(e);
    }
    res.json(rows.map(r => ({
      ...r,
      amountBilled: parseFloat(r.amountBilled),
      amountReceived: parseFloat(r.amountReceived),
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
      entries: (entryMap[r.id] ?? []).map(e => ({
        ...e,
        amount: parseFloat(e.amount),
        createdAt: e.createdAt.toISOString(),
      })),
    })));
  } catch { res.status(500).json({ error: "Failed to fetch payments" }); }
});

router.post("/booking/tech-payments", async (req, res): Promise<void> => {
  try {
    const { techCode, customerName, customerPhone, jobDescription, amountBilled, amountReceived, status } = req.body;
    if (!techCode || !customerName) { res.status(400).json({ error: "techCode, customerName required" }); return; }
    const [row] = await db.insert(techPaymentsTable).values({
      techCode, customerName, customerPhone: customerPhone ?? null, jobDescription: jobDescription ?? null,
      amountBilled: String(amountBilled ?? 0), amountReceived: String(amountReceived ?? 0), status: status ?? 'pending',
    }).returning();
    res.status(201).json({ ...row, amountBilled: parseFloat(row.amountBilled), amountReceived: parseFloat(row.amountReceived), createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() });
  } catch { res.status(500).json({ error: "Failed to create payment" }); }
});

router.patch("/booking/tech-payments/:id", async (req, res): Promise<void> => {
  try {
    const id = parseInt(req.params.id);
    const updates: Record<string, unknown> = { ...req.body };
    if (updates.amountBilled !== undefined) updates.amountBilled = String(updates.amountBilled);
    if (updates.amountReceived !== undefined) updates.amountReceived = String(updates.amountReceived);
    const [row] = await db.update(techPaymentsTable).set(updates).where(eq(techPaymentsTable.id, id)).returning();
    if (!row) { res.status(404).json({ error: "Not found" }); return; }
    res.json({ ...row, amountBilled: parseFloat(row.amountBilled), amountReceived: parseFloat(row.amountReceived), createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() });
  } catch { res.status(500).json({ error: "Failed to update payment" }); }
});

router.delete("/booking/tech-payments/:id", async (req, res): Promise<void> => {
  try {
    await db.delete(techPaymentsTable).where(eq(techPaymentsTable.id, parseInt(req.params.id)));
    res.status(204).end();
  } catch { res.status(500).json({ error: "Failed to delete payment" }); }
});

// ── Tech Payment Entries (partial payments) ───────────────────────────────────

// Helper: recalculate amountReceived + status for a payment record
async function recalcPayment(paymentId: number) {
  const entries = await db.select().from(techPaymentEntriesTable).where(eq(techPaymentEntriesTable.paymentId, paymentId));
  const totalReceived = entries.reduce((s, e) => s + parseFloat(e.amount), 0);
  const [payment] = await db.select().from(techPaymentsTable).where(eq(techPaymentsTable.id, paymentId)).limit(1);
  if (!payment) return null;
  const billed = parseFloat(payment.amountBilled);
  const status = totalReceived <= 0 ? 'pending' : totalReceived >= billed ? 'paid' : 'partial';
  const [updated] = await db.update(techPaymentsTable)
    .set({ amountReceived: String(totalReceived), status })
    .where(eq(techPaymentsTable.id, paymentId))
    .returning();
  return updated;
}

router.post("/booking/tech-payment-entries", async (req, res): Promise<void> => {
  try {
    const { paymentId, amount, paymentMethod, paidAt, note } = req.body;
    if (!paymentId || !amount || !paidAt) { res.status(400).json({ error: "paymentId, amount, paidAt required" }); return; }
    const [entry] = await db.insert(techPaymentEntriesTable).values({
      paymentId: parseInt(paymentId),
      amount: String(amount),
      paymentMethod: paymentMethod ?? 'cash',
      paidAt,
      note: note ?? null,
    }).returning();
    const updatedPayment = await recalcPayment(parseInt(paymentId));
    res.status(201).json({
      entry: { ...entry, amount: parseFloat(entry.amount), createdAt: entry.createdAt.toISOString() },
      payment: updatedPayment ? {
        ...updatedPayment,
        amountBilled: parseFloat(updatedPayment.amountBilled),
        amountReceived: parseFloat(updatedPayment.amountReceived),
        createdAt: updatedPayment.createdAt.toISOString(),
        updatedAt: updatedPayment.updatedAt.toISOString(),
      } : null,
    });
  } catch { res.status(500).json({ error: "Failed to add entry" }); }
});

router.delete("/booking/tech-payment-entries/:id", async (req, res): Promise<void> => {
  try {
    const id = parseInt(req.params.id);
    const [entry] = await db.select().from(techPaymentEntriesTable).where(eq(techPaymentEntriesTable.id, id)).limit(1);
    if (!entry) { res.status(404).json({ error: "Not found" }); return; }
    await db.delete(techPaymentEntriesTable).where(eq(techPaymentEntriesTable.id, id));
    const updatedPayment = await recalcPayment(entry.paymentId);
    res.json({
      payment: updatedPayment ? {
        ...updatedPayment,
        amountBilled: parseFloat(updatedPayment.amountBilled),
        amountReceived: parseFloat(updatedPayment.amountReceived),
        createdAt: updatedPayment.createdAt.toISOString(),
        updatedAt: updatedPayment.updatedAt.toISOString(),
      } : null,
    });
  } catch { res.status(500).json({ error: "Failed to delete entry" }); }
});

// ── Tech Form Config ──────────────────────────────────────────────

router.get("/booking/tech-form-config/:techCode", async (req, res): Promise<void> => {
  try {
    const tech = await db.select().from(professionalsTable).where(eq(professionalsTable.uniqueCode, req.params.techCode)).limit(1);
    if (!tech[0]) { res.status(404).json({ error: "Technician not found" }); return; }
    const configs = await db.select().from(techFormConfigsTable).where(eq(techFormConfigsTable.professionalId, tech[0].id)).limit(1);
    const cfg = configs[0] ?? null;
    res.json({
      technician: { id: tech[0].id, name: tech[0].name, phone: tech[0].phone, professionType: tech[0].professionType, uniqueCode: tech[0].uniqueCode },
      config: cfg ? { ...cfg, defaultVisitingCharge: cfg.defaultVisitingCharge ? parseFloat(cfg.defaultVisitingCharge) : 0 } : null,
    });
  } catch {
    res.status(500).json({ error: "Failed to fetch form config" });
  }
});

router.post("/booking/tech-form-config", async (req, res): Promise<void> => {
  try {
    const { techCode, defaultVisitingCharge, customMessage } = req.body;
    const tech = await db.select().from(professionalsTable).where(eq(professionalsTable.uniqueCode, techCode)).limit(1);
    if (!tech[0]) { res.status(404).json({ error: "Technician not found" }); return; }
    const existing = await db.select().from(techFormConfigsTable).where(eq(techFormConfigsTable.professionalId, tech[0].id)).limit(1);
    if (existing[0]) {
      const [updated] = await db.update(techFormConfigsTable)
        .set({ defaultVisitingCharge: String(defaultVisitingCharge ?? 0), customMessage: customMessage ?? null })
        .where(eq(techFormConfigsTable.professionalId, tech[0].id))
        .returning();
      res.json({ ...updated, defaultVisitingCharge: updated.defaultVisitingCharge ? parseFloat(updated.defaultVisitingCharge) : 0 });
    } else {
      const [created] = await db.insert(techFormConfigsTable)
        .values({ professionalId: tech[0].id, defaultVisitingCharge: String(defaultVisitingCharge ?? 0), customMessage: customMessage ?? null })
        .returning();
      res.status(201).json({ ...created, defaultVisitingCharge: created.defaultVisitingCharge ? parseFloat(created.defaultVisitingCharge) : 0 });
    }
  } catch {
    res.status(500).json({ error: "Failed to save form config" });
  }
});

// ── Tech Form Submissions ──────────────────────────────────────────────

router.post("/booking/tech-form-submit/:techCode", async (req, res): Promise<void> => {
  try {
    const tech = await db.select().from(professionalsTable).where(eq(professionalsTable.uniqueCode, req.params.techCode)).limit(1);
    if (!tech[0]) { res.status(404).json({ error: "Technician not found" }); return; }
    const { customerName, phone, fullAddress, sector, floorNumber, houseNumber, location, visitingCharge, notes } = req.body;
    if (!customerName || !phone) { res.status(400).json({ error: "customerName and phone required" }); return; }
    const [row] = await db.insert(techFormSubmissionsTable).values({
      professionalId: tech[0].id,
      techCode: req.params.techCode,
      customerName,
      phone,
      fullAddress: fullAddress ?? null,
      sector: sector ?? null,
      floorNumber: floorNumber ?? null,
      houseNumber: houseNumber ?? null,
      location: location ?? null,
      visitingCharge: visitingCharge ? String(visitingCharge) : null,
      notes: notes ?? null,
      status: "pending",
    }).returning();
    res.status(201).json({ ...row, visitingCharge: row.visitingCharge ? parseFloat(row.visitingCharge) : null, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() });
  } catch {
    res.status(500).json({ error: "Failed to submit form" });
  }
});

router.get("/booking/tech-form-submissions", async (req, res): Promise<void> => {
  try {
    const { techCode, phone } = req.query as Record<string, string>;
    if (!techCode) { res.status(400).json({ error: "techCode required" }); return; }
    const conditions: ReturnType<typeof eq>[] = [eq(techFormSubmissionsTable.techCode, techCode)];
    if (phone) conditions.push(eq(techFormSubmissionsTable.phone, phone));
    const rows = await db.select().from(techFormSubmissionsTable).where(and(...conditions)).orderBy(desc(techFormSubmissionsTable.createdAt));
    res.json(rows.map(r => ({ ...r, visitingCharge: r.visitingCharge ? parseFloat(r.visitingCharge) : null, createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString() })));
  } catch {
    res.status(500).json({ error: "Failed to fetch submissions" });
  }
});

router.patch("/booking/tech-form-submissions/:id", async (req, res): Promise<void> => {
  try {
    const id = parseInt(req.params.id);
    const { status } = req.body;
    const [row] = await db.update(techFormSubmissionsTable).set({ status }).where(eq(techFormSubmissionsTable.id, id)).returning();
    if (!row) { res.status(404).json({ error: "Not found" }); return; }
    res.json({ ...row, visitingCharge: row.visitingCharge ? parseFloat(row.visitingCharge) : null, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() });
  } catch {
    res.status(500).json({ error: "Failed to update submission" });
  }
});

export default router;
