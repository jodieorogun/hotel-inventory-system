import RequestDetail from "./request-detail";

export default async function AccountantRequestDetailPage({
    params,
}: PageProps<"/accountant/requests/[id]">) {
    const { id } = await params;

    return <RequestDetail requestId={id} />;
}
