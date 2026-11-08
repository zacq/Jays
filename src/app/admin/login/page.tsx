import { loginAction } from "@/app/admin/actions";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ err?: string }> }) {
  const s = await getSession();
  if (s) redirect(s.role === "rider" ? "/admin/orders" : "/admin");
  const sp = await searchParams;
  return (
    <div className="mx-auto mt-16 max-w-sm">
      <form action={loginAction} className="a-card space-y-3">
        <h1 className="text-xl font-black">Jay&apos;s Admin</h1>
        <p className="text-sm text-slate-500">Owner, attendant and rider sign-in.</p>
        {sp.err && <p className="rounded bg-red-50 p-2 text-sm text-red-600">Wrong username or password.</p>}
        <div>
          <label className="a-lbl" htmlFor="u">Username</label>
          <input id="u" name="username" className="a-in" autoCapitalize="none" required />
        </div>
        <div>
          <label className="a-lbl" htmlFor="p">Password</label>
          <input id="p" name="password" type="password" className="a-in" required />
        </div>
        <button className="a-btn w-full">Sign in</button>
      </form>
    </div>
  );
}
