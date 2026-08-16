import StockOutDetail from "./stock-out-detail";

export default async function StorekeeperStockOutDetailPage({
    params,
}: PageProps<"/storekeeper/stock-out/[id]">) {
    const { id } = await params;
    return <StockOutDetail requestId={id} />;
}
