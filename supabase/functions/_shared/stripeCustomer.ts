// Resolves (and caches) the Stripe Customer for a ShinePoint user.
//
// WHY THIS EXISTS: create-payment-intent has always set
// setup_future_usage: 'off_session' to "save the card" for the post-job tip
// — but a PaymentMethod is only actually saved if the PaymentIntent names a
// Customer. Without one Stripe attaches it to nothing, and any later reuse
// fails with:
//
//   "The provided PaymentMethod cannot be attached. To reuse a
//    PaymentMethod, you must attach it to a Customer first."
//
// That went unnoticed because nothing had ever reused a card in production:
// users.stripe_customer_id was populated for zero users and zero tips had
// ever been charged. The deposit balance (086) is simply the first feature
// to try, and charge-tip would have failed the same way on the first real
// tip.
//
// users.stripe_customer_id has existed since 001 and is server-managed
// (guarded in 009/022), so this is filling in a column the schema always
// intended, not adding one.
import type Stripe from 'npm:stripe@^18'
import type { SupabaseClient } from 'npm:@supabase/supabase-js@^2'

export async function ensureStripeCustomer(
  admin: SupabaseClient,
  stripe: Stripe,
  userId: string
): Promise<string | null> {
  const { data: row } = await admin
    .from('users')
    .select('id, email, full_name, stripe_customer_id')
    .eq('id', userId)
    .single()
  if (!row) return null
  if (row.stripe_customer_id) return row.stripe_customer_id as string

  const customer = await stripe.customers.create(
    {
      email: row.email ?? undefined,
      name: row.full_name ?? undefined,
      metadata: { user_id: userId },
    },
    // One Customer per user even if two bookings race to create it.
    { idempotencyKey: `customer-${userId}` }
  )

  const { error } = await admin
    .from('users')
    .update({ stripe_customer_id: customer.id })
    .eq('id', userId)
  if (error) {
    // The Customer exists in Stripe either way; losing the cache just means
    // the idempotency key returns the same one next time.
    console.error('ensureStripeCustomer: failed to cache id:', error.message)
  }
  return customer.id
}

// Makes a saved card reusable by this Customer. Needed for cards saved
// BEFORE the fix above, where setup_future_usage stored a PaymentMethod
// that was never attached to anyone. Already-attached is not an error.
export async function attachPaymentMethod(
  stripe: Stripe,
  paymentMethodId: string,
  customerId: string
): Promise<void> {
  try {
    const pm = await stripe.paymentMethods.retrieve(paymentMethodId)
    if (pm.customer === customerId) return
    if (pm.customer && pm.customer !== customerId) {
      // Attached to someone else — refuse rather than move another
      // account's card onto this one.
      throw new Error('Saved card belongs to a different customer')
    }
    await stripe.paymentMethods.attach(paymentMethodId, { customer: customerId })
  } catch (e) {
    const msg = (e as Error).message ?? ''
    if (/already been attached/i.test(msg)) return
    throw e
  }
}
