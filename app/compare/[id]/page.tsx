import { CompareWorkspace } from "@/components/compare-workspace";

export default async function CompareDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <CompareWorkspace requirementId={id} />;
}
