import { File, Paths } from "expo-file-system";
import type { IdeasCache } from "../services/ideas-catalog";

export const ideasCache: IdeasCache = {
  async read(locale) {
    const file = new File(Paths.cache, `doodle-ideas-v1-${locale}.json`);
    return file.exists ? file.text() : null;
  },
  async write(locale, data) {
    new File(Paths.cache, `doodle-ideas-v1-${locale}.json`).write(data);
  },
};
