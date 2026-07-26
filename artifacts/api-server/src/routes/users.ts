import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, appUsersTable } from "@workspace/db";
import {
  ListUsersResponse,
  CreateUserBody,
  CreateUserResponse,
  UpdateUserParams,
  UpdateUserBody,
  UpdateUserResponse,
  DeleteUserParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

function serializeUser(u: typeof appUsersTable.$inferSelect) {
  return {
    ...u,
    createdAt: u.createdAt.toISOString(),
  };
}

router.get("/users", async (_req, res): Promise<void> => {
  const users = await db.select().from(appUsersTable);
  res.json(ListUsersResponse.parse(users.map(serializeUser)));
});

router.post("/users", async (req, res): Promise<void> => {
  const parsed = CreateUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [user] = await db.insert(appUsersTable).values(parsed.data).returning();
  res.status(201).json(CreateUserResponse.parse(serializeUser(user)));
});

router.patch("/users/:id", async (req, res): Promise<void> => {
  const params = UpdateUserParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [user] = await db
    .update(appUsersTable)
    .set(parsed.data)
    .where(eq(appUsersTable.id, params.data.id))
    .returning();

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  res.json(UpdateUserResponse.parse(serializeUser(user)));
});

router.delete("/users/:id", async (req, res): Promise<void> => {
  const params = DeleteUserParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [user] = await db
    .delete(appUsersTable)
    .where(eq(appUsersTable.id, params.data.id))
    .returning();

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
