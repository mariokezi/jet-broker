import { InquiryList, type Tab } from "@/components/inquiry-list";

const TABS: Tab[] = ["action", "active", "all", "closed"];

export default async function InquiriesPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  return <InquiryList initialTab={TABS.includes(tab as Tab) ? (tab as Tab) : "all"} />;
}
