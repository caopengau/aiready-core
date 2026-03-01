import Stripe from 'stripe';

let stripe: Stripe | null = null;

/**
 * Lazy-initialize Stripe client
 */
export function getStripe(): Stripe | null {
  if (!stripe && process.env.STRIPE_SECRET_KEY) {
    stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2026-02-25.clover' as any, // Cast as any if the version is not in the types yet
    });
  }
  return stripe;
}

/**
 * Common billing utility for plan determination
 */
export function determinePlan(session: {
  amount_total?: number | null;
  metadata?: { plan?: string } | null;
}): 'pro' | 'team' {
  const planFromMetadata = session.metadata?.plan;
  if (planFromMetadata === 'team') {
    return 'team';
  } else if (session.amount_total && session.amount_total >= 9900) {
    return 'team';
  }
  return 'pro';
}
