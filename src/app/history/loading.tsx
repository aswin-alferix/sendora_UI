import { ListPageSkeleton } from "@/components/shared/PageSkeletons";

export default function HistoryLoading() {
    return <ListPageSkeleton columns={4} actions={false} headerAction={false} toolbarButtons={2} />;
}
