import { NextResponse } from 'next/server';
import { auth } from '../../../../auth';
import { getProvisioningStatus } from '../../../../lib/db';

export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = await getProvisioningStatus(session.user.email);

    return NextResponse.json({
      status: result.status,
      accounts: result.accounts.map((acc) => ({
        awsAccountId: acc.awsAccountId,
        repoName: acc.repoName,
        repoUrl: acc.repoUrl || null,
        provisioningStatus: acc.provisioningStatus || 'complete',
        provisioningError: acc.provisioningError || null,
      })),
    });
  } catch (error) {
    console.error('Error fetching account status:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
