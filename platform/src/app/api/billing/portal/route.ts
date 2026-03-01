import { NextResponse } from 'next/server';
import { auth } from '@/app/api/auth/[...nextauth]/route';
import { getStripe } from '@/lib/billing';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const stripeClient = getStripe();
    if (!stripeClient) {
      return NextResponse.json(
        {
          error:
            'Billing not configured. Please add STRIPE_SECRET_KEY to your environment.',
        },
        { status: 400 }
      );
    }

    // For now, return a message that billing is not configured
    // In production, you would retrieve the customer ID from the database
    return NextResponse.json(
      {
        error:
          'Billing not configured for this user. Please set up billing in the dashboard.',
      },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error creating portal session:', error);
    return NextResponse.json(
      { error: 'Failed to create portal session' },
      { status: 500 }
    );
  }
}
