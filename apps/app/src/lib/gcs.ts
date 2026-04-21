import { Storage } from "@google-cloud/storage";
import { env } from "@/env";

let storage: Storage | undefined;

export function gcs(): Storage {
  if (!storage) {
    storage = new Storage({ projectId: env.gcpProjectId() });
  }
  return storage;
}

export function bucket() {
  return gcs().bucket(env.gcsBucket());
}
