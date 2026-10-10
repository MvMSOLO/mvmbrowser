import { createFileRoute } from "@tanstack/react-router";
import { handleSuggest } from "@/lib/mvm/remote.server";

export const Route = createFileRoute("/api/suggest")({
  server: { handlers: { GET: ({ request }) => handleSuggest(request) } },
});
