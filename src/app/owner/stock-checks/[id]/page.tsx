import StockCheckDetail from "./stock-check-detail";

export default async function StockCheckDetailPage({
    params,
}: PageProps<"/owner/stock-checks/[id]">) {
    const { id } = await params;

    return <StockCheckDetail stockCheckId={id} />;
}
