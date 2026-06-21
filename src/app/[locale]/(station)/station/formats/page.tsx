import { redirect } from 'next/navigation';

export default async function StationFormatsRoute({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  redirect(`/${locale}/station/services`);
}
