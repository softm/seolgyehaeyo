import { deleteProject, getProject, projectRoute, updateProject } from "@/lib/server/projects";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, context: Context) { return projectRoute(async () => getProject(request, (await context.params).id)); }
export async function PUT(request: Request, context: Context) { return projectRoute(async () => updateProject(request, (await context.params).id)); }
export async function DELETE(request: Request, context: Context) { return projectRoute(async () => deleteProject(request, (await context.params).id)); }
