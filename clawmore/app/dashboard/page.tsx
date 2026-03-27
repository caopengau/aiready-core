import { auth } from '../../auth';
import { redirect } from 'next/navigation';
import DashboardClient from './DashboardClient';
import {
  getManagedAccountsForUser,
  getUserMetadata,
  getRecentMutationsForUser,
  getUserStatus,
} from '../../lib/db';

export default async function DashboardPage() {
  const session = await auth();

  if (!session?.user?.email) {
    redirect('/api/auth/signin');
  }

  const userEmail = session.user.email;

  const adminEmails = process.env.ADMIN_EMAILS
    ? process.env.ADMIN_EMAILS.split(',').map((e) => e.trim())
    : [];
  const isAdmin = session?.user?.email
    ? adminEmails.includes(session.user.email)
    : false;

  // Access Control: Check user status
  const status = await getUserStatus(userEmail);

  // PENDING users need to complete checkout — show onboarding view
  const isPendingCheckout = status === 'PENDING';

  // Block truly unauthorized users (not PENDING, not APPROVED, not admin)
  if (!isPendingCheckout && status !== 'APPROVED' && !isAdmin) {
    redirect(`/unauthorized?email=${encodeURIComponent(userEmail)}`);
  }

  // 1. Fetch Managed Accounts
  const accounts = await getManagedAccountsForUser(userEmail);

  // 2. Fetch User Metadata (Credits, Settings)
  const metadata = await getUserMetadata(userEmail);

  // 3. Fetch Recent Mutations
  const mutations = await getRecentMutationsForUser(userEmail);

  // 4. Aggregate stats
  const totalSpendCents = accounts.reduce(
    (sum, acc) => sum + (acc.currentMonthlySpendCents || 0),
    0
  );

  // Derive real account data
  const primaryAccount = accounts[0];
  const awsAccountId = primaryAccount?.awsAccountId || null;
  const repoUrl = primaryAccount?.repoUrl || null;
  const provisioningStatus = primaryAccount?.provisioningStatus || null;

  // Determine plan display status
  const planStatus = metadata?.stripeSubscriptionId ? 'MANAGED' : 'FREE';

  const statusData = {
    awsSpendCents: totalSpendCents,
    awsInclusionCents: 1500, // $15.00 base inclusion
    aiTokenBalanceCents: metadata?.aiTokenBalanceCents ?? 0,
    aiRefillThresholdCents: metadata?.aiRefillThresholdCents ?? 100,
    mutationCount: mutations.length,
    coEvolutionOptIn: metadata?.coEvolutionOptIn ?? false,
    autoTopupEnabled: metadata?.autoTopupEnabled ?? true,
    recentMutations: mutations,
    // Real account data
    activeRepos: accounts.length,
    awsAccountId,
    repoUrl,
    provisioningStatus,
    planStatus,
  };

  return (
    <DashboardClient
      user={session.user}
      status={statusData as any}
      isAdmin={isAdmin}
      pendingCheckout={isPendingCheckout}
    />
  );
}
