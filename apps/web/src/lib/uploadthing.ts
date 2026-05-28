import { genUploader } from "uploadthing/client";
import type { UploadRouter } from "@veda/api/uploadthing-types";
import { apiUrl } from "./api";
import { getCookie } from "./cookies";

// The uploader talks directly to the Express UploadThing endpoint so
// the custom assignment form does not depend on a mirrored Next route.
export const { uploadFiles, routeRegistry } = genUploader<UploadRouter>({
  url: `${apiUrl}/api/uploadthing`,
  fetch: (input, init) => {
    const requestUrl = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const shouldIncludeCredentials = requestUrl.startsWith(`${apiUrl}/api/uploadthing`);
    const token = getCookie("veda_access");

    // Inherit headers from both the Request object (if it is one) and the init object
    const baseHeaders = input instanceof Request ? input.headers : new Headers();
    const customHeaders = new Headers(baseHeaders);
    
    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => {
        customHeaders.set(key, value);
      });
    }

    if (shouldIncludeCredentials && token) {
      customHeaders.set("Authorization", `Bearer ${token}`);
    }

    return fetch(input, {
      ...init,
      headers: customHeaders,
      ...(shouldIncludeCredentials ? { credentials: "include" as const } : {}),
    });
  },
});


