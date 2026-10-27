import RoomWorkspace from "@/components/RoomWorkspace";

export default async function RoomPage({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  return <RoomWorkspace roomId={roomId} />;
}
