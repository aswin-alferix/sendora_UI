import { ListPageSkeleton } from "@/components/shared/PageSkeletons";

export default function SentLoading() {
    return <ListPageSkeleton columns={4} selectable headerAction={false} toolbarButtons={3} />;
}
