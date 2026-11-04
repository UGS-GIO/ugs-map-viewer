/** One icon button in a MapLibre ctrl-group, for plain IControls that skip React. */
export function createIconControlButton(title: string, icon: string, onClick: () => void) {
  const container = document.createElement('div');
  container.className = 'maplibregl-ctrl maplibregl-ctrl-group';

  const button = document.createElement('button');
  button.className = 'maplibregl-ctrl-icon';
  button.type = 'button';
  button.title = title;
  button.setAttribute('aria-label', title);
  button.innerHTML = icon;
  button.addEventListener('click', onClick);

  container.appendChild(button);
  return { container, button };
}
