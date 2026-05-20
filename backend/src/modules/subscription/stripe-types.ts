import type { Stripe as StripeTypes } from 'stripe/cjs/stripe.core.js';
import Stripe from 'stripe';

export type StripeClient = StripeTypes;
export type StripeCheckoutSession = StripeTypes.Checkout.Session;
export type StripeEvent = StripeTypes.Event;

export { Stripe as StripeConstructor };
