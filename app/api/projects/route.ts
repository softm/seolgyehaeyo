import { createProject, listProjects, projectRoute } from "@/lib/server/projects";

export const dynamic = "force-dynamic";
export async function GET(request: Request) { return projectRoute(() => listProjects(request)); }
export async function POST(request: Request) { return projectRoute(() => createProject(request)); }
