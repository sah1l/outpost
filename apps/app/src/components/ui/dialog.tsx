"use client";

import * as RadixDialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Button } from "./button";
import { Banner } from "./feedback";

export function Modal({
  title,
  description,
  onClose,
  children,
  width = "28rem",
}: {
  title: ReactNode;
  description?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  width?: string;
}) {
  return (
    <RadixDialog.Root
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="dialog-overlay" />
        <RadixDialog.Content
          className="dialog-panel"
          style={{ maxWidth: width }}
          {...(description ? {} : { "aria-describedby": undefined })}
          // Radix would pick the first focusable thing, which is the close button.
          onOpenAutoFocus={(e) => {
            const wanted = (e.target as HTMLElement).querySelector<HTMLElement>("[data-autofocus]");
            if (wanted) {
              e.preventDefault();
              wanted.focus();
            }
          }}
        >
          <div className="flex items-start gap-3 px-5 pt-5">
            <div className="min-w-0 flex-1">
              <RadixDialog.Title className="truncate text-[16px] font-semibold text-ink">
                {title}
              </RadixDialog.Title>
              {description && (
                <RadixDialog.Description className="mt-1 text-[13px] leading-relaxed text-ink-2">
                  {description}
                </RadixDialog.Description>
              )}
            </div>
            <RadixDialog.Close asChild>
              <Button variant="ghost" size="sm" icon aria-label="Close" className="-mr-1.5 -mt-1">
                <X size={16} aria-hidden="true" />
              </Button>
            </RadixDialog.Close>
          </div>
          <div className="px-5 pb-5 pt-4">{children}</div>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}

// Replaces window.confirm. Stays open if the action fails, so the reason can be read.
export function ConfirmDialog({
  title,
  description,
  confirmLabel,
  destructive = false,
  onConfirm,
  onClose,
}: {
  title: ReactNode;
  description: ReactNode;
  confirmLabel: string;
  destructive?: boolean;
  onConfirm: () => Promise<void>;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      await onConfirm();
    } catch (e) {
      setError(e instanceof Error ? e.message : "That didn't work. Try again.");
      setBusy(false);
    }
  }

  return (
    <Modal title={title} description={description} onClose={onClose} width="26rem">
      {error && <Banner className="mb-3">{error}</Banner>}
      <div className="flex justify-end gap-2">
        <Button data-autofocus onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button variant={destructive ? "danger" : "primary"} onClick={() => void confirm()} disabled={busy}>
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
