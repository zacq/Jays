const env = process.env;

export const darajaConfigured = () =>
  !!(env.MPESA_CONSUMER_KEY && env.MPESA_CONSUMER_SECRET && env.MPESA_SHORTCODE && env.MPESA_PASSKEY && env.MPESA_CALLBACK_URL);

const base = () => (env.MPESA_ENV === "production" ? "https://api.safaricom.co.ke" : "https://sandbox.safaricom.co.ke");

async function token() {
  const auth = Buffer.from(`${env.MPESA_CONSUMER_KEY}:${env.MPESA_CONSUMER_SECRET}`).toString("base64");
  const res = await fetch(`${base()}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${auth}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Daraja auth failed");
  return ((await res.json()) as { access_token: string }).access_token;
}

export async function stkPush(opts: { phone: string; amount: number; orderNo: string }) {
  const t = await token();
  const d = new Date(Date.now() + 3 * 3600 * 1000);
  const timestamp = d.toISOString().replace(/[-:T]/g, "").slice(0, 14);
  const shortcode = env.MPESA_SHORTCODE!;
  const password = Buffer.from(`${shortcode}${env.MPESA_PASSKEY}${timestamp}`).toString("base64");
  const till = env.MPESA_TILL;
  const cb = env.MPESA_CALLBACK_URL! + (env.MPESA_CALLBACK_TOKEN ? `?token=${env.MPESA_CALLBACK_TOKEN}` : "");
  const res = await fetch(`${base()}/mpesa/stkpush/v1/processrequest`, {
    method: "POST",
    headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      BusinessShortCode: shortcode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: till ? "CustomerBuyGoodsOnline" : "CustomerPayBillOnline",
      Amount: opts.amount,
      PartyA: opts.phone,
      PartyB: till || shortcode,
      PhoneNumber: opts.phone,
      CallBackURL: cb,
      AccountReference: opts.orderNo,
      TransactionDesc: `Jays ${opts.orderNo}`,
    }),
  });
  const data = (await res.json()) as { CheckoutRequestID?: string; ResponseCode?: string; errorMessage?: string; CustomerMessage?: string };
  if (!res.ok || data.ResponseCode !== "0" || !data.CheckoutRequestID) {
    throw new Error(data.errorMessage || data.CustomerMessage || "STK push failed");
  }
  return { checkoutRequestId: data.CheckoutRequestID };
}
