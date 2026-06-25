// Route chunk preloading. The same import function backs both React.lazy (in
// App) and the desktop login transition, so warming it here means the
// destination is already in cache by the time we navigate — the transition
// masks the load instead of landing on a spinner.

// CustomerHome pulls in mapbox-gl (~1.6 MB), so it's the only heavy/lazy route.
// Detailer + admin pages are in the main bundle (resolve instantly).
export const loadCustomerHome = () => import('../pages/CustomerHome')

const LOADERS = {
  '/home': loadCustomerHome,
}

// Returns a promise that resolves once the destination's code is ready.
export function preloadRoute(path) {
  const loader = LOADERS[path]
  return loader ? loader() : Promise.resolve()
}
