export function clickOutside(node: HTMLElement, callback: () => void)
{
	function handleClick(event: MouseEvent): void
	{
		const target = event.target as Node;

		if (node && !node.contains(target) && document.body.contains(target))
		{
			callback();
		}
	}

	// Use capture + pointerdown so this fires before marker click handlers
	// finish, but since it only checks "outside this node", clicking a
	// marker (which is outside the ChatWindow) will still correctly close it
	// AND still let the marker's own click handler run afterwards.
	document.addEventListener('pointerdown', handleClick, true);

	return {
		destroy()
		{
			document.removeEventListener('pointerdown', handleClick, true);
		},
		update(newCallback: () => void)
		{
			callback = newCallback;
		}
	};
}