import { NextRequest, NextResponse } from 'next/server';
import { updateTeam } from '@/lib/db';
import Stripe from 'stripe';
import { getStripe, determinePlan } from '@/lib/billing';

export async function POST(request: NextRequest) {
  try {
    const stripeClient = getStripe();
    if (!stripeClient) {
      return NextResponse.json(
        { error: 'Billing not configured' },
        { status: 400 }
      );
    }

    const body = await request.text();
    const signature = request.headers.get('stripe-signature');

    if (!signature) {
      return NextResponse.json({ error: 'No signature' }, { status: 400 });
    }

    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';

    // Verify webhook signature
    let event: Stripe.Event;
    try {
      event = stripeClient.webhooks.constructEvent(
        body,
        signature,
        webhookSecret
      );
    } catch (err) {
      console.error('Webhook signature verification failed:', err);
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    // Handle events
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as {
          metadata?: { teamId?: string; plan?: string };
          customer: string;
          subscription: string;
          amount_total?: number;
        };
        const teamId = session.metadata?.teamId;
        const customerId = session.customer as string;
        const subscriptionId = session.subscription as string;

        if (teamId) {
          const plan = determinePlan(session);

          await updateTeam(teamId, {
            stripeCustomerId: customerId,
            stripeSubscriptionId: subscriptionId,
            plan,
          });
          console.log(`Team ${teamId} upgraded to ${plan} plan`);
        }
        break;
      }

      case 'customer.subscription.updated': {
        // Handle subscription updates
        break;
      }

      case 'customer.subscription.deleted': {
        // Downgrade to free plan when subscription is cancelled
        break;
      }

      case 'invoice.paid': {
        const invoice = event.data.object as { id: string };
        console.log('Invoice paid:', invoice.id);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as { id: string };
        console.log('Invoice payment failed:', invoice.id);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Error processing webhook:', error);
    return NextResponse.json({ error: 'Webhook error' }, { status: 500 });
  }
}
