"use client";

import { useEffect } from "react";
import { track } from "@/lib/analytics";

export default function TrackView({ id }: { id: string }) {
  useEffect(() => {
    track("view_item", { item_id: id });
  }, [id]);
  return null;
}
