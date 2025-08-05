import { Metadata } from "next";

interface LayoutProps {
  children: React.ReactNode;
  params: { id: string };
}

export async function generateMetadata({ params }: LayoutProps): Promise<Metadata> {
  const { id: tatamiId } = await params;
  return {
    title: `Tatami ${tatamiId}`,
  };
}

export default function TatamiLayout({ children }: LayoutProps) {
  return <>{children}</>;
}
