"use client";

import { useEffect, useState } from "react";
import { track } from "@/lib/analytics";

export default function AgeGate({ verified }: { verified: boolean }) {
  const [ok, setOk] = useState(verified);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    if (!verified && localStorage.getItem("jays_age") === "1") {
      document.cookie = "jays_age=1; path=/; max-age=31536000; samesite=lax";
      setOk(true);
    }
  }, [verified]);

  if (ok) return null;

  function yes() {
    localStorage.setItem("jays_age", "1");
    document.cookie = "jays_age=1; path=/; max-age=31536000; samesite=lax";
    track("age_gate_pass");
    setOk(true);
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 p-5 backdrop-blur" role="dialog" aria-modal="true" aria-label="Age check">
      <div className="card w-full max-w-sm p-7 text-center">
        <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-gold text-2xl font-black text-black">J</div>
        {denied ? (
          <>
            <h1 className="h2">Sorry, you can&apos;t enter</h1>
            <p className="mt-3 text-sm text-mute">Jay&apos;s sells alcohol to adults aged 18 and over only. Please come back when you&apos;re old enough. Drink responsibly.</p>
            <button className="btn-ghost mt-5 w-full" onClick={() => setDenied(false)}>
              I tapped the wrong button
            </button>
          </>
        ) : (
          <>
            <h1 className="h2">Are you 18 or older?</h1>
            <p className="mt-3 text-sm text-mute">You must be of legal drinking age to enter Jay&apos;s Liquor Store, Kiamunyi. We check ID on delivery.</p>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <button className="btn-gold" onClick={yes}>
                Yes, I&apos;m 18+
              </button>
              <button className="btn-ghost" onClick={() => setDenied(true)}>
                No
              </button>
            </div>
            <p className="mt-5 text-[11px] text-mute">Drink responsibly. Not for sale to persons under 18.</p>
          </>
        )}
      </div>
    </div>
  );
}
