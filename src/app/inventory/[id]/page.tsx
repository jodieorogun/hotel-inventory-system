import InventoryItemDetail from "./item-detail";

export default async function InventoryItemPage({
    params,
}: PageProps<"/inventory/[id]">) {
    const { id } = await params;

    return <InventoryItemDetail itemId={id} />;
}
