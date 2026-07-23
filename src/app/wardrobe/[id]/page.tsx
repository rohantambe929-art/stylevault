import ItemDetail from '@/components/wardrobe/ItemDetail';

export function generateStaticParams() {
  return [{ id: '_' }];
}

export default function ItemPage() {
  return <ItemDetail />;
}
