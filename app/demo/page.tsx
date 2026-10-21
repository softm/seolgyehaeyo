import { getChatGPTUser } from "../chatgpt-auth";
import Workspace from "@/components/workspace";
export const dynamic = "force-dynamic";
export default async function Demo() {
  const user = await getChatGPTUser();
  return <Workspace user={user ? { displayName: user.displayName, email: user.email } : null} demo />;
}
