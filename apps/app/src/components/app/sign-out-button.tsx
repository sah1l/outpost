"use client";

import { Button } from "@/components/ui/button";
import { signOutAndLeave } from "@/lib/sign-out";

export function SignOutButton() {
  return <Button onClick={() => void signOutAndLeave()}>Sign out</Button>;
}
