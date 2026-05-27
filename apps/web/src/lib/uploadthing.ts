import { genUploader } from "uploadthing/client";
import type { UploadRouter } from "@veda/api/uploadthing-types";
import { apiUrl } from "./api";
import { getCookie } from "./cookies";

// The uploader talks directly to the Express UploadThing endpoint so
// the custom assignment form does not depend on a mirrored Next route.
export const { createUpload, routeRegistry } = genUploader<UploadRouter>({
  url: `${apiUrl}/api/uploadthing`,
  fetch: (input, init) => {
    const requestUrl = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const shouldIncludeCredentials = requestUrl.startsWith(`${apiUrl}/api/uploadthing`);

    return fetch(input, {
      ...init,
      ...(shouldIncludeCredentials ? { credentials: "include" as const } : {}),
    });
  },
});

export async function createStudyMaterialUpload(file: File, sourceDraftId: string) {
  // UploadThing's public FileRouter export erases endpoint input details across package boundaries,
  // so we keep the cast inside one helper instead of leaking it through the form code.
  const token = getCookie("veda_access");
  return createUpload("studyMaterial", {
    files: [file],
    input: { sourceDraftId },
    headers: () => ({
      Accept: "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    }),
  } as never);
}
