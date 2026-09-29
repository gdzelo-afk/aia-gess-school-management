import { eq, and, sql } from 'drizzle-orm';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { config } from '../config.js';
import { db } from '../db/client.js';
import * as schema from '../db/schema.js';
export const auth = betterAuth({
  appName: 'AIA-GESS',
  baseURL: config.APP_ORIGIN,
  secret: config.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, { provider: 'pg', schema }),
  trustedOrigins: [config.APP_ORIGIN],
  user: { additionalFields: { disabled: { type: 'boolean', defaultValue: false, input: false } } },
  databaseHooks: {
    session: {
      create: {
        before: async (session) => {
          const rows = await db
            .select()
            .from(schema.user)
            .innerJoin(schema.person, eq(schema.person.userId, schema.user.id))
            .where(
              and(
                eq(schema.user.id, session.userId),
                eq(schema.user.disabled, false),
                sql`${schema.person.archivedAt} is null`,
              ),
            );
          if (!rows.length) return false;
          const employee = await db
            .select()
            .from(schema.staff)
            .where(eq(schema.staff.personId, rows[0]!.person.id));
          if (
            employee[0]?.endsOn &&
            employee[0].endsOn <=
              new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tbilisi' }).format(new Date())
          )
            return false;
          return { data: session };
        },
      },
    },
  },
  emailAndPassword: { enabled: true, disableSignUp: true, minPasswordLength: 12 },
  session: { expiresIn: 60 * 60 * 12, updateAge: 60 * 60, cookieCache: { enabled: false } },
  rateLimit: {
    enabled: true,
    window: 60,
    max: 60,
    customRules: { '/sign-in/email': { window: 60, max: 10 } },
  },
  advanced: {
    ipAddress: { ipAddressHeaders: ['x-aia-client-ip'] },
    useSecureCookies: config.NODE_ENV === 'production',
  },
});
