import { DocTableSkeleton } from "@/components/docs/doc-table-skeleton";
import { PageBody } from "@/components/ui/feedback";

export default function Loading() {
  return (
    <PageBody>
      <div className="skeleton mb-7 h-7 w-40" />
      <DocTableSkeleton />
    </PageBody>
  );
}
