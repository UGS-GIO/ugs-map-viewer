interface IconButton {
  title: string
  icon: string
  onClick: () => void
}

/** Icon buttons in one MapLibre ctrl-group, for plain IControls that skip React. */
export function createIconControlGroup(items: IconButton[]) {
  const container = document.createElement('div')
  container.className = 'maplibregl-ctrl maplibregl-ctrl-group'

  const buttons = items.map(({ title, icon, onClick }) => {
    const button = document.createElement('button')
    button.className = 'maplibregl-ctrl-icon'
    button.type = 'button'
    button.title = title
    button.setAttribute('aria-label', title)
    button.innerHTML = icon
    button.addEventListener('click', onClick)
    container.appendChild(button)
    return button
  })

  return { container, buttons }
}
