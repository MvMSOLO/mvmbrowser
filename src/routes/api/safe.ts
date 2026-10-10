import { createFileRoute } from "@tanstack/react-router";
import { handleSafe } from "@/lib/mvm/remote.server";

export const Route = createFileRoute("/api/safe")({
  server: { handlers: { POST: ({ request }) => handleSafe(request) } },
});
