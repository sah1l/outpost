import { redirect } from "next/navigation";
import type { DocType } from "@offsprint/shared";
import { getSessionUser } from "@/lib/auth";
import { SiteHeader, Breadcrumb } from "@/components/chrome/site-header";
import { EditorShell } from "../[slug]/editor-shell";

export const dynamic = "force-dynamic";

export default async function NewDraftPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const { type: typeParam } = await searchParams;
  const docType: DocType = typeParam === "html" ? "html" : "md";

  return (
    <div className="flex h-screen min-h-0 flex-col">
      <SiteHeader
        user={user}
        breadcrumb={
          <Breadcrumb
            items={[
              { label: "dashboard", href: "/dashboard" },
              { label: "new draft" },
            ]}
          />
        }
      />
      <EditorShell mode="draft" docType={docType} />
    </div>
  );
}
