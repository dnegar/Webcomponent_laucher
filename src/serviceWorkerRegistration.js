export async function register(){
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker
      .register('service-worker.js', { scope: '/' })
      .then((registration) => {
        console.log('Service Worker registered:', registration);

        if (registration.waiting) {
          updateReady(registration.waiting);
        }

        registration.onupdatefound = () => {
          const newWorker = registration.installing;
          newWorker.onstatechange = () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              updateReady(newWorker);
            }
          };
        };
      })
      .catch((error) => {
        console.error('Service Worker registration failed:', error);
      });
  } else {
    console.log('Service Worker not supported');
  }

  if ('serviceWorker' in navigator && 'SyncManager' in window) {
    navigator.serviceWorker.ready.then((registration) => {
      registration.sync.register('my-sync').then(() => {
        console.log('Sync registered');
      }).catch((error) => {
        console.error('Sync registration failed:', error);
      });
    });
  } else {
    console.log('Background Sync not supported');
  }
}

function updateReady(worker) {
  console.log('New update ready:', worker);
  // Handle the update logic here, like notifying the user
  // or automatically updating the service worker.
}

export async function unregister() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready
      .then(registration => {
        registration.unregister();
      })
      .catch(error => {
        console.error(error.message);
      });
  }
}
