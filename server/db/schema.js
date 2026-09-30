/**
 * SQLite schema (Drizzle ORM) for CarbonCTRL.
 *
 * Replaces the previous MongoDB/Mongoose models. Table/column names keep the
 * same camelCase shape as the old models so the API contract with the
 * frontend is unchanged (totalEmissions, activityAmount, assessmentId, ...).
 *
 * Column types:
 *  - timestamp columns are stored as unix epoch milliseconds and surfaced as
 *    JS Dates by Drizzle ({ mode: 'timestamp_ms' }).
 *  - boolean columns are stored as 0/1 ({ mode: 'boolean' }).
 */
import { sqliteTable, integer, text, real, index } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  email: text('email').notNull().unique(),
  name: text('name'),
  // null for Google OAuth users (matches old schema: password optional when googleId set)
  password: text('password'),
  firstName: text('first_name'),
  lastName: text('last_name'),
  isEmailVerified: integer('is_email_verified', { mode: 'boolean' }).notNull().default(false),
  resetPasswordToken: text('reset_password_token'),
  resetPasswordExpires: integer('reset_password_expires', { mode: 'timestamp_ms' }),
  emailVerificationToken: text('email_verification_token'),
  lastLogin: integer('last_login', { mode: 'timestamp_ms' }),
  googleId: text('google_id').unique(),
  // JWT session version. Bumped on password change / reset / discard so old
  // tokens are immediately invalidated (see middleware/auth.js).
  tokenVersion: integer('token_version').notNull().default(0),
  // Opt-in monthly "log last month" email, and the YYYY-MM it was last sent for
  monthlyReminders: integer('monthly_reminders', { mode: 'boolean' }).notNull().default(false),
  lastReminderMonth: text('last_reminder_month'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
});

export const companyProfiles = sqliteTable(
  'company_profiles',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userId: integer('user_id').notNull().unique(),
    name: text('name').notNull(),
    industry: text('industry').notNull(),
    employees: text('employees').notNull(),
    location: text('location').notNull(),
    // Two-letter US state (or null); sets the grid electricity emission factor
    state: text('state'),
    phone: text('phone'),
    email: text('email'),
    founded: text('founded'),
    description: text('description'),
    // Sustainability context used to tailor Gemini recommendations. All
    // optional so profiles created before these fields existed stay valid.
    // Allowed values live in server/config/profileOptions.js.
    reductionBudget: text('reduction_budget'),
    reductionTargetPercent: integer('reduction_target_percent'),
    reductionTargetYear: integer('reduction_target_year'),
    premisesOwnership: text('premises_ownership'),
    renewableElectricityShare: text('renewable_electricity_share'),
    fleetSize: integer('fleet_size'),
    fleetType: text('fleet_type'),
    workModel: text('work_model'),
    siteCount: integer('site_count'),
    employeeCount: integer('employee_count'),
    existingMeasures: text('existing_measures', { mode: 'json' }),
    reportingObligations: text('reporting_obligations', { mode: 'json' }),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => ({
    userIdIdx: index('company_profiles_user_id_idx').on(table.userId),
  })
);

export const carbonAssessments = sqliteTable(
  'carbon_assessments',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userId: integer('user_id').notNull(),
    totalEmissions: real('total_emissions').notNull().default(0),
    grade: text('grade').notNull().default('N/A'),
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => ({
    userIdCreatedAtIdx: index('carbon_assessments_user_id_created_at_idx').on(
      table.userId,
      table.createdAt
    ),
  })
);

export const carbonActivities = sqliteTable(
  'carbon_activities',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    assessmentId: integer('assessment_id').notNull(),
    userId: integer('user_id').notNull(),
    sector: text('sector').notNull(),
    subsector: text('subsector').notNull(),
    activityAmount: real('activity_amount').notNull(),
    activityUnit: text('activity_unit').notNull(),
    // Calendar date the activity happened (YYYY-MM-DD). Nullable only because
    // SQLite can't add a NOT NULL column to existing rows; migration 0004
    // backfills it and the API always sets it.
    activityDate: text('activity_date'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => ({
    assessmentIdIdx: index('carbon_activities_assessment_id_idx').on(table.assessmentId),
    userIdIdx: index('carbon_activities_user_id_idx').on(table.userId),
  })
);

export const emissions = sqliteTable(
  'emissions',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userId: integer('user_id').notNull(),
    type: text('type').notNull(),
    amount: real('amount').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => ({
    userIdTypeIdx: index('emissions_user_id_type_idx').on(table.userId, table.type),
  })
);

// Latest Gemini recommendations per user, so the page can show them again
// without a new Gemini call. `inputFingerprint` hashes the data they were
// generated from; a different fingerprint now means they are outdated.
export const recommendationSets = sqliteTable('recommendation_sets', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().unique(),
  payload: text('payload', { mode: 'json' }).notNull(),
  inputFingerprint: text('input_fingerprint').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
});

// Actions a company has chosen to take, usually adopted from a recommendation.
// `annualImpact` is tCO2e per year (recommendation impacts cover the recorded
// period, so they are annualized when an action is added).
export const actionItems = sqliteTable(
  'action_items',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userId: integer('user_id').notNull(),
    title: text('title').notNull(),
    description: text('description'),
    sector: text('sector'),
    annualImpact: real('annual_impact').notNull().default(0),
    cost: text('cost'),
    timeline: text('timeline'),
    priority: text('priority'),
    status: text('status').notNull().default('planned'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
    completedAt: integer('completed_at', { mode: 'timestamp_ms' }),
  },
  (table) => ({
    userIdIdx: index('action_items_user_id_idx').on(table.userId),
  })
);
