import NextAuth from 'next-auth';
import Credentials from '@auth/core/providers/credentials';
import GitHub from 'next-auth/providers/github';
import Google from 'next-auth/providers/google';
import { DynamoDBAdapter } from '@auth/dynamodb-adapter';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';

const dbClient = new DynamoDBClient({
  region: process.env.AWS_REGION || 'ap-southeast-2',
});

const documentClient = DynamoDBDocument.from(dbClient, {
  marshallOptions: {
    convertEmptyValues: true,
    removeUndefinedValues: true,
    convertClassInstanceToMap: true,
  },
});

if (!process.env.AUTH_SECRET && !process.env.NEXTAUTH_SECRET) {
  console.warn(
    '[NextAuth] WARNING: AUTH_SECRET is not set. Magic Link login will fail. Please set it in .env.local'
  );
}

if (!process.env.DYNAMO_TABLE) {
  console.warn(
    '[NextAuth] WARNING: DYNAMO_TABLE is not set. Database operations will fail. Please set it in .env.local'
  );
}

export const { auth, handlers, signIn, signOut } = NextAuth({
  secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
  trustHost: true,
  adapter: DynamoDBAdapter(documentClient, {
    tableName: process.env.DYNAMO_TABLE as string,
    partitionKey: 'PK',
    sortKey: 'SK',
    indexName: 'GSI1',
    indexPartitionKey: 'GSI1PK',
    indexSortKey: 'GSI1SK',
  }),
  providers: [
    {
      id: 'email',
      type: 'email',
      name: 'Email',
      options: {},
      from: process.env.SES_FROM_EMAIL || 'noreply@dev.getaiready.dev',
      maxAge: 24 * 60 * 60,
      async sendVerificationRequest({
        identifier: to,
        url,
        provider,
      }: {
        identifier: string;
        url: string;
        provider: any;
      }) {
        const sesClient = new SESClient({
          region: process.env.AWS_REGION || 'ap-southeast-2',
        });
        const command = new SendEmailCommand({
          Destination: { ToAddresses: [to] },
          Source: provider.from as string,
          Message: {
            Subject: {
              Data: 'Verify your ClawMore Identity',
              Charset: 'UTF-8',
            },
            Body: {
              Text: {
                Data: `Verify your ClawMore Identity by clicking here: ${url}`,
                Charset: 'UTF-8',
              },
              Html: {
                Data: `
                  <body style="background-color: #0a0a0a; color: #ffffff; font-family: 'Inter', system-ui, -apple-system, sans-serif; padding: 40px 20px; text-align: center;">
                    <div style="max-width: 500px; margin: 0 auto; background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(0, 224, 255, 0.2); border-radius: 8px; padding: 40px; box-shadow: 0 0 40px rgba(0, 224, 255, 0.05);">
                      <div style="margin-bottom: 30px;">
                        <h1 style="color: #ffffff; font-size: 28px; font-weight: 900; font-style: italic; letter-spacing: -0.05em; margin: 0; text-transform: uppercase;">CLAW<span style="color: #00e0ff;">MORE</span></h1>
                        <p style="color: #71717a; font-family: monospace; font-size: 10px; text-transform: uppercase; letter-spacing: 0.3em; margin-top: 8px;">Managed Agentic Platform</p>
                      </div>
                      
                      <div style="margin-bottom: 30px; height: 1px; background: linear-gradient(90deg, transparent, rgba(0, 224, 255, 0.3), transparent);"></div>
                      
                      <h2 style="font-size: 20px; font-weight: 700; margin-bottom: 16px;">Verify Identity</h2>
                      <p style="color: #a1a1aa; font-size: 14px; line-height: 1.6; margin-bottom: 32px;">Click the button below to authenticate your access to the ClawMore console. This link will expire in 24 hours.</p>
                      
                      <a href="${url}" style="display: inline-block; padding: 16px 32px; background-color: #00e0ff; color: #000000; text-decoration: none; border-radius: 4px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; transition: all 0.2s;">Authenticate Console</a>
                      
                      <p style="margin-top: 40px; font-size: 12px; color: #52525b; font-family: monospace;">
                        If you did not request this verification, <br/> you can safely ignore this packet.
                      </p>
                    </div>
                  </body>
                `,
                Charset: 'UTF-8',
              },
            },
          },
        });
        await sesClient.send(command);
      },
    } as any,
    GitHub({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
      allowDangerousEmailAccountLinking: true,
      authorization: {
        params: {
          scope: 'read:user user:email repo workflow',
        },
      },
    }),
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      allowDangerousEmailAccountLinking: true,
    }),
    Credentials({
      name: 'Admin Access',
      credentials: {
        password: { label: 'Admin Password', type: 'password' },
      },
      async authorize(credentials) {
        const adminPassword = process.env.ADMIN_PASSWORD;

        if (!adminPassword) {
          if (process.env.NODE_ENV === 'production') {
            throw new Error(
              'ADMIN_PASSWORD environment variable is required in production'
            );
          }
          // Default for dev only if not production
          return null;
        }

        const isCorrectPassword = credentials?.password === adminPassword;

        // Use the first email from ADMIN_EMAILS — no hardcoded fallback
        const adminEmails = process.env.ADMIN_EMAILS
          ? process.env.ADMIN_EMAILS.split(',').map((e) => e.trim())
          : [];
        const primaryAdminEmail = adminEmails[0];

        if (isCorrectPassword && primaryAdminEmail) {
          return {
            id: 'admin-001',
            name: 'ClawMore Admin',
            email: primaryAdminEmail,
          };
        }
        return null;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, account }) {
      if (account) {
        token.accessToken = account.access_token;
      }
      return token;
    },
    async session({ session, token, user }: any) {
      if (session.user) {
        if (token) {
          session.accessToken = token.accessToken;
          session.user.id = token.sub || token.id;
        } else if (user) {
          session.user.id = user.id;
        }

        const adminEmails = process.env.ADMIN_EMAILS
          ? process.env.ADMIN_EMAILS.split(',').map((e) => e.trim())
          : [];
        session.user.isAdmin = adminEmails.includes(session.user.email);
      }
      return session;
    },
    async signIn({ user, account, profile }) {
      // _account and _profile are received but not used in this callback
      void account;
      void profile;
      const adminEmails = process.env.ADMIN_EMAILS
        ? process.env.ADMIN_EMAILS.split(',').map((e) => e.trim())
        : [];

      const email = user.email || '';
      if (!email) return false;

      // Always allow admin
      if (adminEmails.includes(email)) return true;

      // Check if user is approved in DynamoDB
      try {
        const res = await documentClient.query({
          TableName: process.env.DYNAMO_TABLE!,
          IndexName: 'GSI1',
          KeyConditionExpression: 'GSI1PK = :pk AND GSI1SK = :sk',
          ExpressionAttributeValues: {
            ':pk': 'USER',
            ':sk': email,
          },
        });

        const foundUser = res.Items?.[0];

        // If user doesn't exist yet, redirect to signup
        if (!foundUser) {
          return `/signup?email=${encodeURIComponent(email)}`;
        }

        // Allow PENDING users through - they'll be redirected to checkout
        if (foundUser.status === 'PENDING') {
          return true;
        }

        if (foundUser.status !== 'APPROVED') {
          return `/unauthorized?email=${encodeURIComponent(email)}`;
        }

        return true;
      } catch (err) {
        console.error('[auth] Error checking user approval:', err);
        return false;
      }
    },
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;

      const adminEmails = process.env.ADMIN_EMAILS
        ? process.env.ADMIN_EMAILS.split(',').map((e) => e.trim())
        : [];

      const userEmail = auth?.user?.email || '';
      const isAdminEmail = adminEmails.includes(userEmail);

      const isOnAdmin = nextUrl.pathname.startsWith('/admin');
      const isOnAdminLogin = nextUrl.pathname === '/admin/login';
      const isOnDashboard = nextUrl.pathname.startsWith('/dashboard');

      if (isOnAdmin && !isOnAdminLogin) {
        if (isLoggedIn && isAdminEmail) return true;
        return false;
      }

      // Dashboard logic: handled by signIn callback primarily, but double check here if needed.
      if (isOnDashboard && !isLoggedIn) {
        return false;
      }

      return true;
    },
  },
  pages: {
    signIn: '/login',
  },
});
