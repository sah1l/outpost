import type { Metadata } from "next";
import Link from "next/link";
import { AppShell } from "@/components/app/app-shell";
import { SimpleHeader } from "@/components/chrome/simple-header";
import { buttonClass } from "@/components/ui/button";
import { PageBody, PageHeader } from "@/components/ui/feedback";
import { getSessionUser } from "@/lib/auth";
import { UploadForm } from "./upload-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Upload" };

export default async function UploadPage() {
  const user = await getSessionUser();

  if (user) {
    return (
      <AppShell user={user}>
        <PageBody width="narrow">
          <PageHeader
            title="Upload a file"
            description="It starts private. You can edit HTML and Markdown after uploading."
          />
          <UploadForm loggedIn />
        </PageBody>
      </AppShell>
    );
  }

  return (
    <div className="min-h-dvh bg-surface">
      <SimpleHeader
        width="narrow"
        actions={
          <Link href="/login" className={buttonClass()}>
            Sign in
          </Link>
        }
      />
      <PageBody width="narrow">
        <PageHeader
          title="Upload a file"
          description="You don't need an account. Anyone with the link can open it."
        />
        <UploadForm loggedIn={false} />
      </PageBody>
    </div>
  );
}
