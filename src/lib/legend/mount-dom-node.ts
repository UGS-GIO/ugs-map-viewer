/**
 * React callback ref that mounts a foreign DOM node (e.g. an SVG built imperatively)
 * as the host element's only child. Avoids `dangerouslySetInnerHTML`.
 */
export function mountDomNode(node: Node) {
    return (host: HTMLElement | null) => {
        if (host) host.replaceChildren(node.cloneNode(true))
    }
}
