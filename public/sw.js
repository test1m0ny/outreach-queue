// Service worker for follow-up push notifications.
self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (x) { d = {body: e.data && e.data.text()}; }
  e.waitUntil(self.registration.showNotification(d.title || 'Outreach Queue', {
    body: d.body || 'You have follow-ups due.', tag: 'followups', renotify: true, data: {url: d.url || '/'}
  }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || '/';
  e.waitUntil(clients.matchAll({type: 'window', includeUncontrolled: true}).then(list => {
    for (const c of list) if ('focus' in c) return c.focus();
    return clients.openWindow(url);
  }));
});
