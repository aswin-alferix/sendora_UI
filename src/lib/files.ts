import { backend } from "@/lib/axios";

/** A file stored on the API (POST /api/files). `url` is /api/files/<id>. */
export interface UploadedFile {
    id: string;
    filename: string;
    contentType: string;
    size: number;
    url: string;
}

export function formatBytes(bytes: number): string {
    const kb = bytes / 1024;
    return kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${Math.max(kb, 0.1).toFixed(1)} KB`;
}

export async function uploadFile(file: Blob, filename: string): Promise<UploadedFile> {
    const form = new FormData();
    form.append("file", file, filename);
    const { data } = await backend.post<UploadedFile>("/api/files", form);
    return data;
}

export async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
    const res = await fetch(dataUrl);
    return res.blob();
}
