import { downloadFile, projectRoute } from "@/lib/server/projects";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string; fileId: string }> };
export async function GET(request: Request, context: Context) { return projectRoute(async () => { const { id, fileId } = await context.params; return downloadFile(request, id, fileId); }); }
