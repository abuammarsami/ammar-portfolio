import type { Metadata } from "next";
import { getOptionalHtml } from "@/lib/content/loader";

export const dynamic = "force-static";
export const metadata: Metadata = {
  title: "Writing",
  description: "Writing and research notes.",
};

export default async function WritingPage() {
  const writing = await getOptionalHtml("writing.md");

  return (
    <main className="mx-auto max-w-3xl px-6 pb-16">
      <h1 className="mt-12 font-serif text-4xl">Writing</h1>
      {writing ? (
        <div
          className="mt-6 font-serif leading-relaxed [&_a]:link-super [&_li+li]:mt-3 [&_li]:ml-4"
          dangerouslySetInnerHTML={{ __html: writing }}
        />
      ) : (
        <p className="mt-4 font-mono text-sm text-muted">— nothing here yet —</p>
      )}
    </main>
  );
}
