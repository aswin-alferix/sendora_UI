import { ListPageSkeleton } from "@/components/shared/PageSkeletons";

export default function ContactsLoading() {
    return <ListPageSkeleton columns={5} selectable toolbarButtons={2} />;
}
