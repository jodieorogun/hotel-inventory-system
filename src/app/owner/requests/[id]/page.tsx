import OwnerRequestDetail from "./owner-request-detail";

export default async function OwnerRequestDetailPage({
    params,
}: PageProps<"/owner/requests/[id]">) {
    const { id } = await params;

    return <OwnerRequestDetail requestId={id} />;
}
