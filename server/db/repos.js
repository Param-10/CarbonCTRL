/**
 * Repository layer for CarbonCTRL.
 *
 * Thin data-access functions over the Drizzle/SQLite schema. They replace the
 * old Mongoose models and preserve the exact API shape the frontend expects:
 * every row is returned with both `id` (number) and `_id` (string) so existing
 * client code (`response.user._id`, `activity._id`, `assessment._id`) keeps
 * working unchanged.
 *
 * The Mongoose bcrypt `pre('save')` hook no longer exists — password hashing is
 * now explicit in server/routes/auth.js (see hashPassword there).
 */
import { and, asc, desc, eq, isNull, like, ne, or } from 'drizzle-orm';
import { db, sqlite } from './index.js';
import {
  users,
  companyProfiles,
  carbonAssessments,
  carbonActivities,
  emissions,
  recommendationSets,
  actionItems,
} from './schema.js';
import { PROFILE_CONTEXT_FIELDS } from '../config/profileOptions.js';

/** Add `_id` (string) alongside `id` (number) for frontend compatibility. */
export const withId = (row) => (row ? { ...row, _id: String(row.id) } : row);

const now = () => new Date();

/* ------------------------------------------------------------------ */
/* Users                                                               */
/* ------------------------------------------------------------------ */

export const usersRepo = {
  findByEmail(email) {
    return withId(
      db.select().from(users).where(eq(users.email, email)).limit(1).get()
    );
  },

  findById(id) {
    return withId(db.select().from(users).where(eq(users.id, id)).limit(1).get());
  },

  findByGoogleId(googleId) {
    return withId(
      db.select().from(users).where(eq(users.googleId, googleId)).limit(1).get()
    );
  },

  /** Look up a user by the SHA-256 hash of a password-reset token. */
  findByResetTokenHash(tokenHash) {
    return withId(
      db
        .select()
        .from(users)
        .where(eq(users.resetPasswordToken, tokenHash))
        .limit(1)
        .get()
    );
  },

  deleteById(id) {
    const result = db.delete(users).where(eq(users.id, id)).run();
    return result.changes > 0;
  },

  create({ email, password = null, name, firstName, lastName, googleId, isEmailVerified = false }) {
    const row = db
      .insert(users)
      .values({
        email,
        name: name ?? null,
        password,
        firstName: firstName ?? null,
        lastName: lastName ?? null,
        googleId: googleId ?? null,
        isEmailVerified,
        createdAt: now(),
        updatedAt: now(),
      })
      .returning()
      .get();
    return withId(row);
  },

  /** Update only the provided fields; always bumps updatedAt. */
  update(id, fields) {
    const set = { updatedAt: now() };
    const allowed = [
      'password',
      'name',
      'firstName',
      'lastName',
      'isEmailVerified',
      'googleId',
      'lastLogin',
      'resetPasswordToken',
      'resetPasswordExpires',
      'emailVerificationToken',
      'tokenVersion',
      'monthlyReminders',
      'lastReminderMonth',
    ];
    for (const key of allowed) {
      if (fields[key] !== undefined) set[key] = fields[key];
    }
    const row = db.update(users).set(set).where(eq(users.id, id)).returning().get();
    return withId(row);
  },

  /** Users who opted in to monthly reminders and haven't had one for `month` (YYYY-MM). */
  findDueForReminder(month) {
    return db
      .select()
      .from(users)
      .where(and(
        eq(users.monthlyReminders, true),
        or(isNull(users.lastReminderMonth), ne(users.lastReminderMonth, month))
      ))
      .all()
      .map(withId);
  },

  updateLastLogin(id) {
    return this.update(id, { lastLogin: now() });
  },

  /** Strip sensitive fields from a user row (mirrors the old Mongoose toJSON). */
  toSafeUser(row) {
    if (!row) return row;
    const {
      password,
      resetPasswordToken,
      resetPasswordExpires,
      emailVerificationToken,
      tokenVersion,
      ...safe
    } = row;
    // Hint for the UI: accounts created via Google have no password.
    safe.hasPassword = Boolean(row.password);
    return safe;
  },
};

/* ------------------------------------------------------------------ */
/* Company profiles                                                    */
/* ------------------------------------------------------------------ */

export const profilesRepo = {
  findByUserId(userId) {
    return withId(
      db
        .select()
        .from(companyProfiles)
        .where(eq(companyProfiles.userId, userId))
        .limit(1)
        .get()
    );
  },

  create(userId, data) {
    const row = db
      .insert(companyProfiles)
      .values({
        userId,
        name: data.name,
        industry: data.industry,
        employees: data.employees,
        location: data.location,
        phone: data.phone ?? null,
        email: data.email ?? null,
        founded: data.founded ?? null,
        description: data.description ?? null,
        ...Object.fromEntries(PROFILE_CONTEXT_FIELDS.map((key) => [key, data[key] ?? null])),
        createdAt: now(),
        updatedAt: now(),
      })
      .returning()
      .get();
    return withId(row);
  },

  updateByUserId(userId, data) {
    const set = { updatedAt: now() };
    const allowed = [
      'name', 'industry', 'employees', 'location', 'phone', 'email', 'founded', 'description',
      ...PROFILE_CONTEXT_FIELDS,
    ];
    for (const key of allowed) {
      if (data[key] !== undefined) set[key] = data[key];
    }
    const row = db
      .update(companyProfiles)
      .set(set)
      .where(eq(companyProfiles.userId, userId))
      .returning()
      .get();
    return withId(row);
  },

  /** Insert when missing, update otherwise (POST /company/profile semantics). */
  upsert(userId, data) {
    const existing = this.findByUserId(userId);
    if (existing) {
      return this.updateByUserId(userId, data);
    }
    return this.create(userId, data);
  },

  deleteByUserId(userId) {
    const result = db
      .delete(companyProfiles)
      .where(eq(companyProfiles.userId, userId))
      .run();
    return result.changes > 0;
  },
};

/* ------------------------------------------------------------------ */
/* Carbon assessments                                                  */
/* ------------------------------------------------------------------ */

export const assessmentsRepo = {
  findActiveByUserId(userId) {
    return withId(
      db
        .select()
        .from(carbonAssessments)
        .where(
          and(
            eq(carbonAssessments.userId, userId),
            eq(carbonAssessments.isActive, true)
          )
        )
        .orderBy(desc(carbonAssessments.createdAt))
        .limit(1)
        .get()
    );
  },

  findLatestByUserId(userId) {
    return withId(
      db
        .select()
        .from(carbonAssessments)
        .where(eq(carbonAssessments.userId, userId))
        .orderBy(desc(carbonAssessments.createdAt))
        .limit(1)
        .get()
    );
  },

  findById(id) {
    return withId(
      db.select().from(carbonAssessments).where(eq(carbonAssessments.id, id)).limit(1).get()
    );
  },

  create(userId) {
    const row = db
      .insert(carbonAssessments)
      .values({
        userId,
        totalEmissions: 0,
        grade: 'N/A',
        isActive: true,
        createdAt: now(),
        updatedAt: now(),
      })
      .returning()
      .get();
    return withId(row);
  },

  updateById(id, fields) {
    const set = { updatedAt: now() };
    for (const key of ['totalEmissions', 'grade', 'isActive']) {
      if (fields[key] !== undefined) set[key] = fields[key];
    }
    const row = db
      .update(carbonAssessments)
      .set(set)
      .where(eq(carbonAssessments.id, id))
      .returning()
      .get();
    return withId(row);
  },

  deleteByUserId(userId) {
    return db.delete(carbonAssessments).where(eq(carbonAssessments.userId, userId)).run();
  },
};

/* ------------------------------------------------------------------ */
/* Carbon activities                                                   */
/* ------------------------------------------------------------------ */

export const activitiesRepo = {
  findByAssessmentId(assessmentId, order = 'desc') {
    const rows = db
      .select()
      .from(carbonActivities)
      .where(eq(carbonActivities.assessmentId, assessmentId))
      .orderBy(order === 'asc' ? asc(carbonActivities.createdAt) : desc(carbonActivities.createdAt))
      .all();
    return rows.map(withId);
  },

  findByUserId(userId, order = 'asc') {
    const rows = db
      .select()
      .from(carbonActivities)
      .where(eq(carbonActivities.userId, userId))
      .orderBy(order === 'asc' ? asc(carbonActivities.createdAt) : desc(carbonActivities.createdAt))
      .all();
    return rows.map(withId);
  },

  create({ assessmentId, userId, sector, subsector, activityAmount, activityUnit, activityDate }) {
    const row = db
      .insert(carbonActivities)
      .values({
        assessmentId,
        userId,
        sector,
        subsector,
        activityAmount,
        activityUnit,
        activityDate,
        createdAt: now(),
        updatedAt: now(),
      })
      .returning()
      .get();
    return withId(row);
  },

  /**
   * Set one month's total for each activity type in one transaction: existing
   * entries of that type dated in `month` (YYYY-MM) are replaced by a single
   * entry, so saving the monthly log twice never double counts.
   */
  replaceMonthTotals({ assessmentId, userId, month, activityDate, entries }) {
    const run = sqlite.transaction(() =>
      entries.map((entry) => {
        db.delete(carbonActivities)
          .where(and(
            eq(carbonActivities.assessmentId, assessmentId),
            eq(carbonActivities.sector, entry.sector),
            eq(carbonActivities.subsector, entry.subsector),
            like(carbonActivities.activityDate, `${month}-%`)
          ))
          .run();
        return db
          .insert(carbonActivities)
          .values({ assessmentId, userId, ...entry, activityDate, createdAt: now(), updatedAt: now() })
          .returning()
          .get();
      })
    );
    return run().map(withId);
  },

  /** True if the user has any activity dated in `month` (YYYY-MM). */
  hasActivityInMonth(userId, month) {
    return Boolean(
      db
        .select({ id: carbonActivities.id })
        .from(carbonActivities)
        .where(and(eq(carbonActivities.userId, userId), like(carbonActivities.activityDate, `${month}-%`)))
        .limit(1)
        .get()
    );
  },

  /** Find an activity only if it belongs to the given user. */
  findByIdAndUser(id, userId) {
    return withId(
      db
        .select()
        .from(carbonActivities)
        .where(and(eq(carbonActivities.id, id), eq(carbonActivities.userId, userId)))
        .limit(1)
        .get()
    );
  },

  /** Update an activity only if it belongs to the given user; null otherwise. */
  updateByIdAndUser(id, userId, fields) {
    const set = { updatedAt: now() };
    for (const key of ['sector', 'subsector', 'activityAmount', 'activityUnit', 'activityDate']) {
      if (fields[key] !== undefined) set[key] = fields[key];
    }
    const row = db
      .update(carbonActivities)
      .set(set)
      .where(and(eq(carbonActivities.id, id), eq(carbonActivities.userId, userId)))
      .returning()
      .get();
    return row ? withId(row) : null;
  },

  /** Delete an activity only if it belongs to the given user. */
  deleteByIdAndUser(id, userId) {
    const result = db
      .delete(carbonActivities)
      .where(and(eq(carbonActivities.id, id), eq(carbonActivities.userId, userId)))
      .run();
    return result.changes > 0;
  },

  deleteByUserId(userId) {
    return db.delete(carbonActivities).where(eq(carbonActivities.userId, userId)).run();
  },
};

/* ------------------------------------------------------------------ */
/* Emissions                                                           */
/* ------------------------------------------------------------------ */

export const emissionsRepo = {
  findByUserId(userId, order = 'desc') {
    const rows = db
      .select()
      .from(emissions)
      .where(eq(emissions.userId, userId))
      .orderBy(order === 'asc' ? asc(emissions.createdAt) : desc(emissions.createdAt))
      .all();
    return rows.map(withId);
  },

  /** All emissions except the synthetic 'total' row. */
  findNonTotalByUserId(userId, order = 'desc') {
    const rows = db
      .select()
      .from(emissions)
      .where(and(eq(emissions.userId, userId), ne(emissions.type, 'total')))
      .orderBy(order === 'asc' ? asc(emissions.createdAt) : desc(emissions.createdAt))
      .all();
    return rows.map(withId);
  },

  deleteByUserId(userId) {
    return db.delete(emissions).where(eq(emissions.userId, userId)).run();
  },

  /**
   * Atomically replace all of a user's emissions rows (delete + insert in one
   * transaction). Used when a new assessment score is saved.
   */
  replaceAll(userId, entries) {
    const run = sqlite.transaction(() => {
      db.delete(emissions).where(eq(emissions.userId, userId)).run();
      if (entries.length > 0) {
        const stamped = entries.map((entry) => ({
          userId,
          type: entry.type,
          amount: entry.amount,
          createdAt: now(),
          updatedAt: now(),
        }));
        db.insert(emissions).values(stamped).run();
      }
    });
    run();
  },
};

/* ------------------------------------------------------------------ */
/* Saved recommendations                                               */
/* ------------------------------------------------------------------ */

export const recommendationSetsRepo = {
  findByUserId(userId) {
    return withId(
      db.select().from(recommendationSets).where(eq(recommendationSets.userId, userId)).limit(1).get()
    );
  },

  /** Replace the user's saved recommendations with a new set. */
  save(userId, { payload, inputFingerprint }) {
    const row = db
      .insert(recommendationSets)
      .values({ userId, payload, inputFingerprint, createdAt: now(), updatedAt: now() })
      .onConflictDoUpdate({
        target: recommendationSets.userId,
        set: { payload, inputFingerprint, updatedAt: now() },
      })
      .returning()
      .get();
    return withId(row);
  },
};

/* ------------------------------------------------------------------ */
/* Action plan                                                         */
/* ------------------------------------------------------------------ */

const ACTION_FIELDS = ['title', 'description', 'sector', 'annualImpact', 'cost', 'timeline', 'priority', 'status'];

export const actionItemsRepo = {
  findByUserId(userId) {
    return db
      .select()
      .from(actionItems)
      .where(eq(actionItems.userId, userId))
      .orderBy(desc(actionItems.createdAt))
      .all()
      .map(withId);
  },

  create(userId, fields) {
    const values = Object.fromEntries(ACTION_FIELDS.filter((k) => fields[k] !== undefined).map((k) => [k, fields[k]]));
    const row = db
      .insert(actionItems)
      .values({ ...values, userId, createdAt: now(), updatedAt: now() })
      .returning()
      .get();
    return withId(row);
  },

  /** Update an action only if it belongs to the given user; null otherwise. */
  updateByIdAndUser(id, userId, fields) {
    const set = { updatedAt: now() };
    for (const key of ACTION_FIELDS) {
      if (fields[key] !== undefined) set[key] = fields[key];
    }
    if (fields.status !== undefined) {
      set.completedAt = fields.status === 'done' ? now() : null;
    }
    const row = db
      .update(actionItems)
      .set(set)
      .where(and(eq(actionItems.id, id), eq(actionItems.userId, userId)))
      .returning()
      .get();
    return row ? withId(row) : null;
  },

  deleteByIdAndUser(id, userId) {
    return db
      .delete(actionItems)
      .where(and(eq(actionItems.id, id), eq(actionItems.userId, userId)))
      .run().changes > 0;
  },
};

/* ------------------------------------------------------------------ */
/* Combined operations                                                 */
/* ------------------------------------------------------------------ */

/** Delete all carbon data for a user (activities, assessments, emissions, saved recommendations). */
export function resetUserData(userId) {
  const run = sqlite.transaction(() => {
    db.delete(carbonActivities).where(eq(carbonActivities.userId, userId)).run();
    db.delete(carbonAssessments).where(eq(carbonAssessments.userId, userId)).run();
    db.delete(emissions).where(eq(emissions.userId, userId)).run();
    db.delete(recommendationSets).where(eq(recommendationSets.userId, userId)).run();
  });
  run();
}

/**
 * Permanently delete a user's account and every row owned by them, in one
 * transaction (profile, activities, assessments, emissions, saved
 * recommendations, action plan, then the user).
 * New sign-ups/activities are impossible while the transaction runs, so this
 * cannot leak rows to the auth middleware mid-delete.
 */
export function deleteUserAccount(userId) {
  const run = sqlite.transaction(() => {
    db.delete(carbonActivities).where(eq(carbonActivities.userId, userId)).run();
    db.delete(carbonAssessments).where(eq(carbonAssessments.userId, userId)).run();
    db.delete(emissions).where(eq(emissions.userId, userId)).run();
    db.delete(recommendationSets).where(eq(recommendationSets.userId, userId)).run();
    db.delete(actionItems).where(eq(actionItems.userId, userId)).run();
    db.delete(companyProfiles).where(eq(companyProfiles.userId, userId)).run();
    db.delete(users).where(eq(users.id, userId)).run();
  });
  run();
}
