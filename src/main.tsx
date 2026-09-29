// Separate entry graphs: the existing application never imports lab CSS or font assets.
if (
  window.location.pathname === '/design-lab' ||
  window.location.pathname.startsWith('/design-lab/')
) {
  void import('./design-lab/main');
} else {
  void import('./main-app');
}
