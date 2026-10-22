import webpush from "web-push";
import { getStore } from "@netlify/blobs";

type Keys = { publicKey: string; privateKey: string };

// VAPID keys are created once and kept in Blobs, so push works without manual setup.
export async function vapidKeys(): Promise<Keys> {
  const store = getStore("push-config");
  const existing = (await store.get("vapid", { type: "json" })) as Keys | null;
  if (existing) return existing;
  const keys = webpush.generateVAPIDKeys();
  const { modified } = await store.setJSON("vapid", keys, { onlyIfNew: true });
  if (modified) return keys;
  return (await store.get("vapid", { type: "json" })) as Keys;
}

export async function sendPush(sub: { endpoint: string; p256dh: string; auth: string }, payload: object) {
  const keys = await vapidKeys();
  webpush.setVapidDetails("mailto:testimonydigitalsolutions@gmail.com", keys.publicKey, keys.privateKey);
  return webpush.sendNotification(
    { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
    JSON.stringify(payload),
  );
}
