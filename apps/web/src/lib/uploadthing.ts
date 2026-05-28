import { genUploader } from "uploadthing/client";
import type { UploadRouter } from "@veda/api/uploadthing-types";
import { apiUrl } from "./api";
import { getCookie } from "./cookies";

// The uploader talks directly to the Express UploadThing endpoint so
// the custom assignment form does not depend on a mirrored Next route.
export const { uploadFiles, routeRegistry } = genUploader<UploadRouter>({
  url: `${apiUrl}/api/uploadthing`,
  fetch: async (input, init) => {
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

    const headersObj: Record<string, string> = {};
    customHeaders.forEach((value, key) => {
      headersObj[key] = value;
    });

    console.log(`[UploadThing Fetch] -> ${init?.method || "GET"} ${requestUrl}`, {
      headers: headersObj,
      hasBody: !!init?.body,
    });

    try {
      const response = await fetch(input, {
        ...init,
        headers: customHeaders,
        ...(shouldIncludeCredentials ? { credentials: "include" as const } : {}),
      });

      console.log(`[UploadThing Fetch] <- ${response.status} ${response.statusText} (${requestUrl})`);
      
      // We can't clone and read the body fully if it's a stream, but we can log success
      if (!response.ok) {
        console.warn(`[UploadThing Fetch] Response not OK for ${requestUrl}`);
      }

      return response;
    } catch (error) {
      console.error(`[UploadThing Fetch] X- ERROR for ${requestUrl}`, error);
      throw error;
    }
  },
});


