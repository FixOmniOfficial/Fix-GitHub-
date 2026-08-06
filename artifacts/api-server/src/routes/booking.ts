import { Router, type IRouter } from "express";
import { eq, desc, and } from "drizzle-orm";
import { db, professionalsTable, bookingsTable } from "@workspace/db";

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

export default router;
