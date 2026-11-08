import type { Metadata } from "next";
import { notFound } from "next/navigation";

const DOCS: Record<string, { title: string; body: string[] }> = {
  terms: {
    title: "Terms of sale",
    body: [
      "Jay's Liquor Store sells alcohol only to persons aged 18 and over. By ordering you confirm you are 18+ and will show a valid ID on delivery or pickup. If ID is not shown, the order is cancelled and refunded per this policy.",
      "Delivery is available on orders of KSh 500 or more (editable by the store) within our delivery zones and licensed delivery hours. Orders placed outside delivery hours are scheduled for the next slot or may be collected in store.",
      "Prices are in Kenya Shillings. Payment is by M-Pesa (STK Push or Till) or Pay on Delivery where available. Orders are confirmed when payment is received.",
      "Stock is limited. If an item becomes unavailable we will contact you and refund any payment made for it.",
      "Please drink responsibly. This page is a draft to be reviewed by a lawyer before launch.",
    ],
  },
  privacy: {
    title: "Privacy policy",
    body: [
      "We collect your name, phone number, delivery location details and order history to fulfil orders, run our rewards programme and keep records, in line with the Kenya Data Protection Act, 2019.",
      "We only send marketing messages if you opt in at checkout, and every marketing message includes an opt-out. You can ask us to delete your data at any time by contacting us.",
      "Your data is used only for Jay's own operations and marketing. We do not sell your data. Payment details are handled by Safaricom M-Pesa; we never see your PIN.",
      "We use analytics (GA4, TikTok Pixel, Meta Pixel) to understand which campaigns bring orders.",
    ],
  },
  "rewards-terms": {
    title: "Rewards terms",
    body: [
      "You earn 1 point per KSh 100 spent on drinks (delivery fees excluded). Points are credited when the order is delivered or picked up and are linked to your phone number.",
      "100 points = KSh 100 off, with a minimum of 100 points per redemption and a maximum of 30% of the order value. Points expire after 6 months without an order.",
      "Bottle rewards are unlocked by buying the stated number of bottles; a voucher code is sent by SMS/WhatsApp. Vouchers apply to a single order. Abuse of offers or points may lead to removal of points. Jay's may change reward values with notice on this site.",
    ],
  },
  "top-buyers-terms": {
    title: "Top Buyers terms",
    body: [
      "The Top Buyers reward is not a lottery or prize draw. Customers are ranked each calendar month by the measure published on the Rewards page (total spend or bottles bought), using paid and delivered orders only. Refunded orders are excluded.",
      "A minimum number of orders applies. Ties are broken by number of orders, then by the earliest qualifying order. The owner reviews and approves the list and may disqualify entries for abuse, with a recorded reason.",
      "Winners are notified by SMS/WhatsApp. Your first name appears on the website only if you gave consent at checkout.",
    ],
  },
};

export async function generateMetadata({ params }: { params: Promise<{ doc: string }> }): Promise<Metadata> {
  const { doc } = await params;
  return { title: DOCS[doc]?.title ?? "Legal" };
}

export default async function LegalPage({ params }: { params: Promise<{ doc: string }> }) {
  const { doc } = await params;
  const d = DOCS[doc];
  if (!d) notFound();
  return (
    <article className="mx-auto max-w-2xl space-y-4">
      <h1 className="h1 !text-3xl">{d.title}</h1>
      {d.body.map((p, i) => (
        <p key={i} className="text-sm leading-relaxed text-mute">{p}</p>
      ))}
      <p className="text-xs text-mute">Drink responsibly. Not for sale to persons under 18.</p>
    </article>
  );
}
