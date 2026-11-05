"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { PageBody } from "@/components/ui/feedback";

export default function ErrorPage({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-dvh bg-surface">
      <PageBody width="narrow">
        <h1 className="text-[22px] font-semibold tracking-[-0.015em] text-ink">This page didn&apos;t load</h1>
        <p className="mt-2 text-[14px] leading-relaxed text-ink-2">
          Something went wrong on our side. Try again, and if it keeps happening, come back in a few minutes.
        </p>
        <Button variant="primary" className="mt-6" onClick={reset}>
          Try again
        </Button>
      </PageBody>
    </div>
  );
}
