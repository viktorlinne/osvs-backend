import Stripe from "stripe";

const stripeSecret = process.env.STRIPE_SECRET_KEY ?? null;
if (!stripeSecret) {
  // runtime: will throw if used without config
}

const stripe = stripeSecret
  ? new Stripe(stripeSecret, { apiVersion: "2025-11-17.clover" })
  : null;

export async function createPaymentIntent(opts: {
  amount: number; // in major units (e.g. 600 for SEK 600)
  currency?: string;
  metadata?: Record<string, string>;
}) {
  if (!stripe)
    throw new Error("Stripe not configured (STRIPE_SECRET_KEY missing)");
  const currency = (opts.currency ?? "sek").toLowerCase();
  const amountMinor = Math.round(opts.amount * 100); // convert to cents
  const intent = await stripe.paymentIntents.create({
    amount: amountMinor,
    currency,
    metadata: opts.metadata ?? {},
    automatic_payment_methods: { enabled: true, allow_redirects: "never" },
  });
  return intent;
}

export async function createCheckoutSession(opts: {
  line_items: Array<{ price: string; quantity?: number }>; // price ids
  mode?: "payment" | "subscription" | "setup";
  success_url: string;
  cancel_url?: string;
  metadata?: Record<string, string>;
  ui_mode?: "embedded" | "hosted";
}) {
  if (!stripe)
    throw new Error("Stripe not configured (STRIPE_SECRET_KEY missing)");
  const params: Stripe.Checkout.SessionCreateParams = {
    line_items: opts.line_items.map((li) => ({
      price: li.price,
      quantity: li.quantity ?? 1,
    })) as Stripe.Checkout.SessionCreateParams.LineItem[],
    mode: opts.mode ?? "payment",
    success_url: opts.success_url,
    cancel_url: opts.cancel_url ?? opts.success_url,
    metadata: opts.metadata ?? {},
    ui_mode: (opts.ui_mode ?? undefined) as
      | Stripe.Checkout.SessionCreateParams.UiMode
      | undefined,
  };
  const session = await stripe.checkout.sessions.create(params);
  return session;
}

export async function retrieveCheckoutSession(id: string) {
  if (!stripe)
    throw new Error("Stripe not configured (STRIPE_SECRET_KEY missing)");
  const session = await stripe.checkout.sessions.retrieve(id, {
    expand: ["customer_details"],
  });
  return session;
}

export { Stripe };

export default {
  createPaymentIntent,
  createCheckoutSession,
  retrieveCheckoutSession,
};
