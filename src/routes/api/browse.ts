import { createFileRoute } from "@tanstack/react-router";
import { handleBrowse } from "@/lib/mvm/browse.server";

const handle = ({ request }: { request: Request }) => handleBrowse(request);

export const Route = createFileRoute("/api/browse")({
  server: { handlers: { GET: handle, POST: handle, OPTIONS: handle } },
});
