import { createFileRoute } from "@tanstack/react-router";
import { handleAmo } from "@/lib/mvm/remote.server";

export const Route = createFileRoute("/api/amo")({
  server: { handlers: { GET: ({ request }) => handleAmo(request) } },
});
