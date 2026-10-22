import { exportProject, projectRoute } from "@/lib/server/projects";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, context: Context) { return projectRoute(async () => exportProject(request, (await context.params).id)); }
