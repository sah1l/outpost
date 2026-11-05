import { Check, X } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import {
  ANON_DAILY_UPLOAD_LIMIT_PER_IP,
  ANON_DOC_TTL_DAYS,
  MAX_UPLOAD_BYTES_ANON,
  MAX_UPLOAD_BYTES_USER,
} from "@offsprint/shared";
import { SimpleHeader } from "@/components/chrome/simple-header";
import { buttonClass } from "@/components/ui/button";
import { Avatar } from "@/components/ui/feedback";
import { env } from "@/env";
import { getSessionUser } from "@/lib/auth";
import { HeroUpload } from "./hero-upload";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const user = await getSessionUser();
  const baseUrl = env.appBaseUrl();

  return (
    <div className="min-h-dvh bg-surface">
      <SimpleHeader
        actions={
          user ? (
            <Link href="/dashboard" className={buttonClass()}>
              Your docs
            </Link>
          ) : (
            <Link href="/login" className={buttonClass()}>
              Sign in
            </Link>
          )
        }
      />

      <main className="mx-auto w-full max-w-5xl px-4 sm:px-8">
        <section className="pb-20 pt-10 sm:pt-16">
          <h1 className="display text-[clamp(2.5rem,6.5vw,4.25rem)] text-ink">
            <span className="block">Your AI made a page.</span>
            <span className="block">Now share it.</span>
          </h1>
          <p className="mt-5 max-w-xl text-[17px] leading-relaxed text-ink-2">
            Outpost turns HTML and Markdown files into links, named after what&apos;s inside them. Keep
            a page private, share it with your team, or make it public.
          </p>
          <div className="mt-10">
            <HeroUpload baseUrl={baseUrl} signedIn={Boolean(user)} />
          </div>
        </section>

        <div className="divide-y divide-line border-t border-line">
          <Feature
            title="Publish from your terminal, or your agent's"
            body="The CLI takes a file or piped text and prints the link, so an AI agent can publish its own work when it's done."
          >
            <pre className="overflow-x-auto rounded-panel bg-canvas p-4 font-mono text-[13px] leading-relaxed text-ink-2">
              <code>
                <span className="text-ink-3">$ </span>
                <span className="text-ink">npm i -g @offsprint/outpost</span>
                {"\n"}
                <span className="text-ink-3">$ </span>
                <span className="text-ink">outpost login</span>
                {"\n"}
                <span className="text-ink-3">$ </span>
                <span className="text-ink">outpost upload ./report.html</span>
                {"\n\n"}
                {'  Uploaded "report.html"\n  '}
                <span className="text-link">{baseUrl.replace(/\/$/, "")}/s/q3-launch-plan</span>
              </code>
            </pre>
          </Feature>

          <Feature
            title="Private until you share it"
            body="With an account, every doc starts private. Add people by email and choose who can edit, or give a whole team a workspace."
          >
            <div className="space-y-2.5 rounded-panel bg-canvas p-4" aria-hidden="true">
              <Person email="maya@northwind.dev" role="Can edit" />
              <Person email="tom@northwind.dev" role="Can view" />
              <Person email="priya@northwind.dev" role="Can view" />
            </div>
          </Feature>

          <Feature
            title="Safe to open"
            body="Every page runs in a locked-down sandbox on its own domain, so you can open what an AI wrote without worrying what its scripts might do."
          >
            <ul className="space-y-2.5 rounded-panel bg-canvas p-4 text-[13px] text-ink">
              <Ability can>Run its own scripts and charts</Ability>
              <Ability can>Load libraries from a CDN</Ability>
              <Ability>Read your Outpost session</Ability>
              <Ability>Open or change your other docs</Ability>
            </ul>
          </Feature>
        </div>

        <section className="border-t border-line py-14" aria-labelledby="limits-heading">
          <h2 id="limits-heading" className="text-[20px] font-semibold tracking-[-0.012em] text-ink">
            What you get
          </h2>
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[34rem] text-left text-[14px]">
              <thead className="text-[13px] text-ink-3">
                <tr className="border-b border-line">
                  <th scope="col" className="w-1/3 py-2 pr-4 font-medium">
                    <span className="sr-only">Feature</span>
                  </th>
                  <th scope="col" className="w-1/3 py-2 pr-4 font-medium">Without an account</th>
                  <th scope="col" className="w-1/3 py-2 font-medium">With an account</th>
                </tr>
              </thead>
              <tbody className="text-ink-2">
                <Limit
                  label="File size"
                  anon={`${MAX_UPLOAD_BYTES_ANON / 1024 / 1024} MB`}
                  user={`${MAX_UPLOAD_BYTES_USER / 1024 / 1024} MB`}
                />
                <Limit label="Who can open it" anon="Anyone with the link" user="You choose" />
                <Limit
                  label="How long it stays up"
                  anon={`At least ${ANON_DOC_TTL_DAYS} days`}
                  user="Until you delete it"
                />
                <Limit
                  label="Uploads"
                  anon={`${ANON_DAILY_UPLOAD_LIMIT_PER_IP} a day`}
                  user="No daily limit"
                />
                <Limit label="Editing, sharing, workspaces" anon="Not included" user="Included" />
              </tbody>
            </table>
          </div>
          {!user && (
            <Link href="/login" className={buttonClass({ variant: "primary", className: "mt-6" })}>
              Sign in with Google or Microsoft
            </Link>
          )}
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-6 text-[13px] text-ink-3 sm:px-8">
          <span>Outpost</span>
          <div className="flex gap-5">
            <a href="https://www.npmjs.com/package/@offsprint/outpost" className="hover:text-ink">
              CLI on npm
            </a>
            <a href="https://github.com/sah1l/outpost" className="hover:text-ink">
              Source on GitHub
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

function Feature({ title, body, children }: { title: string; body: string; children?: ReactNode }) {
  return (
    <section className="grid gap-5 py-12 md:grid-cols-2 md:items-center md:gap-12">
      <div>
        <h2 className="text-[20px] font-semibold tracking-[-0.012em] text-ink">{title}</h2>
        <p className="mt-2 max-w-md text-[15px] leading-relaxed text-ink-2">{body}</p>
      </div>
      {children && <div className="min-w-0">{children}</div>}
    </section>
  );
}

function Ability({ can = false, children }: { can?: boolean; children: ReactNode }) {
  const Icon = can ? Check : X;
  return (
    <li className="flex items-center gap-2.5">
      <Icon size={15} className={`shrink-0 ${can ? "text-ok" : "text-ink-3"}`} aria-hidden="true" />
      <span>
        <span className="sr-only">{can ? "A page can: " : "A page can't: "}</span>
        {children}
      </span>
    </li>
  );
}

function Person({ email, role }: { email: string; role: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <Avatar name={email} />
      <span className="min-w-0 flex-1 truncate text-[13px] text-ink">{email}</span>
      <span className="text-[13px] text-ink-2">{role}</span>
    </div>
  );
}

function Limit({ label, anon, user }: { label: string; anon: string; user: string }) {
  return (
    <tr className="border-b border-line">
      <th scope="row" className="py-2.5 pr-4 font-medium text-ink">
        {label}
      </th>
      <td className="py-2.5 pr-4">{anon}</td>
      <td className="py-2.5">{user}</td>
    </tr>
  );
}
