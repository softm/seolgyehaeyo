import { projectRoute, uploadFile } from "@/lib/server/projects";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };
export async function POST(request: Request, context: Context) { return projectRoute(async () => uploadFile(request, (await context.params).id)); }
