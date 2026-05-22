export default function GuestLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="guest-theme min-h-screen bg-background text-foreground">
      {children}
    </div>
  );
}
