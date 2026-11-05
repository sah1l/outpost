"use client";

import * as Dropdown from "@radix-ui/react-dropdown-menu";
import Link from "next/link";
import type { ReactNode } from "react";

export const Menu = Dropdown.Root;
export const MenuTrigger = Dropdown.Trigger;

export function MenuContent({
  children,
  align = "end",
  side,
}: {
  children: ReactNode;
  align?: "start" | "end";
  side?: "top" | "bottom";
}) {
  return (
    <Dropdown.Portal>
      <Dropdown.Content className="menu-panel" align={align} side={side} sideOffset={4} collisionPadding={8}>
        {children}
      </Dropdown.Content>
    </Dropdown.Portal>
  );
}

export function MenuItem({
  icon,
  danger,
  onSelect,
  children,
}: {
  icon?: ReactNode;
  danger?: boolean;
  onSelect: () => void;
  children: ReactNode;
}) {
  return (
    <Dropdown.Item className="menu-item" data-danger={danger ? "" : undefined} onSelect={onSelect}>
      {icon}
      {children}
    </Dropdown.Item>
  );
}

export function MenuLink({
  icon,
  href,
  newTab,
  children,
}: {
  icon?: ReactNode;
  href: string;
  newTab?: boolean;
  children: ReactNode;
}) {
  return (
    <Dropdown.Item asChild className="menu-item">
      {newTab ? (
        <a href={href} target="_blank" rel="noreferrer">
          {icon}
          {children}
        </a>
      ) : (
        <Link href={href}>
          {icon}
          {children}
        </Link>
      )}
    </Dropdown.Item>
  );
}

export function MenuSeparator() {
  return <Dropdown.Separator className="my-1 h-px bg-line" />;
}

export function MenuLabel({ children }: { children: ReactNode }) {
  return <Dropdown.Label className="px-2.5 pb-1.5 pt-1 text-[12px] text-ink-3">{children}</Dropdown.Label>;
}
