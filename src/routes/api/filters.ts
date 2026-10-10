import { createFileRoute } from "@tanstack/react-router";
import { handleFilters } from "@/lib/mvm/remote.server";

const handle = ({ request }: { request: Request }) => handleFilters(request);

export const Route = createFileRoute("/api/filters")({
  server: { handlers: { GET: handle, POST: handle } },
});
