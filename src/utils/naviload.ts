import { getItem, STORES } from "./storage";

export type PickedFile = {
  uri: string;
  name: string;
  type: string;
};

export type UploadOptions = {
  subdir: string;
};

export type UploadedFileResult = {
  originalName: string;
  storedAs: string;
};

export type UploadResponse = {
  message: string;
  files: UploadedFileResult[];
};

export async function uploadFiles(
  files: PickedFile[],
  subdir: string
): Promise<UploadResponse> {
  const password = getItem<string>(STORES.NAVILOAD_CREDENTIALS, 'password');
  const url = getItem<string>(STORES.NAVILOAD_CREDENTIALS, 'url');

  if (!password || !url) {
    throw new Error('Naviload credentials not set.');
  }
  const form = new FormData();
  files.forEach((file) => {
    // Field name must be "files" — matches multer's upload.array("files") on naviload
    form.append('files', {
      uri: file.uri,
      name: file.name,
      type: file.type,
    } as any);
  });

  const trimmed = url.endsWith('/') ? url.slice(0, -1) : url;

  const res = await fetch(trimmed + "/upload", {
    method: 'POST',
    headers: {
      'x-upload-password': password,
      'x-upload-subdir': subdir,
      // Don't set Content-Type manually — fetch sets the multipart boundary for you
    },
    body: form,
  });

  if (res.status === 400) {
    const body = await res.json().catch(() => ({ error: 'No files uploaded.' }));
    throw new Error(body.error ?? 'No files uploaded.');
  }

  if (res.status === 429) {
    throw new Error('Rate limited — too many upload attempts. Try again shortly.');
  }

  if (res.status === 401 || res.status === 403) {
    throw new Error('Incorrect upload password.');
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`${res.status} ${res.statusText} ${text}`);
  }

  return res.json();
}
