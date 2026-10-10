import { createFileRoute } from "@tanstack/react-router";
import { handleMusic } from "@/lib/mvm/remote.server";

export const Route = createFileRoute("/api/music")({
  server: { handlers: { GET: ({ request }) => handleMusic(request) } },
});
