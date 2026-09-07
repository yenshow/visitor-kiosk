import { readFile } from "fs/promises";
import path from "path";

export const getVisitorNotice = async (): Promise<string> => {
  const filePath = path.join(process.cwd(), "content", "visitor-notice.md");
  try {
    return await readFile(filePath, "utf8");
  } catch {
    return "請詳閱並同意訪客須知後再繼續。";
  }
};
