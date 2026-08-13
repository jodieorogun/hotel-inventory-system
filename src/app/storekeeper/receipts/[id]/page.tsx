import ReceiptDetail from "./receipt-detail";

export default async function StorekeeperReceiptDetailPage({
    params,
}: PageProps<"/storekeeper/receipts/[id]">) {
    const { id } = await params;

    return <ReceiptDetail requestId={id} />;
}
