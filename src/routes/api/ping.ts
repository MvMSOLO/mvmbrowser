import { createFileRoute } from "@tanstack/react-router";
import { handlePing } from "@/lib/mvm/remote.server";

export const Route = createFileRoute("/api/ping")({
  server: { handlers: { GET: ({ request }) => handlePing(request) } },
});
