"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ShareDialog } from "./share-dialog";

export function ShareButton({
  slug,
  title,
  isPublic,
}: {
  slug: string;
  title: string;
  isPublic: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" variant="primary" onClick={() => setOpen(true)}>
        Share
      </Button>
      {open && (
        <ShareDialog slug={slug} title={title} isPublic={isPublic} onClose={() => setOpen(false)} />
      )}
    </>
  );
}
