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
  twoFactorSecret: text('two_factor_secret'),
  twoFactorEnabled: integer('two_factor_enabled', { mode: 'boolean' }).notNull().default(false),
  // JWT session version. Bumped on password change / reset / discard so old
  // tokens are immediately invalidated (see middleware/auth.js).
  tokenVersion: integer('token_version').notNull().default(0),
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
    phone: text('phone'),
    email: text('email'),
    founded: text('founded'),
    description: text('description'),
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