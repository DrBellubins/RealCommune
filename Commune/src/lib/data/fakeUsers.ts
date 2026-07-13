export type MapUser = {
	id: string;
	name: string;
	role: string;
	status: 'online' | 'available' | 'away' | 'offline';
	latitude: number;
	longitude: number;
	locationLabel: string;
	preview: string;
};

export const testClient: MapUser = {
	id: 'test-client',
	name: 'TestClient',
	role: 'Test client',
	status: 'online',
	latitude: 0,
	longitude: 0,
	locationLabel: '0, 0',
	preview: 'The local test account used for prototype conversations.'
};

export const fakeUsers: MapUser[] = [
	{
		id: 'ada-marin',
		name: 'Ada Marin',
		role: 'Community host',
		status: 'online',
		latitude: 41.9032,
		longitude: 12.4988,
		locationLabel: 'Near Campo de Fiori',
		preview: 'Coordinating the evening walk and checking in with new arrivals.'
	},
	{
		id: 'noah-rossi',
		name: 'Noah Rossi',
		role: 'Builder',
		status: 'available',
		latitude: 41.9091,
		longitude: 12.5185,
		locationLabel: 'Monti',
		preview: 'Looking for a quick sync on the map prototype and local meetup flow.'
	},
	{
		id: 'lina-kim',
		name: 'Lina Kim',
		role: 'Resident',
		status: 'away',
		latitude: 41.8967,
		longitude: 12.4821,
		locationLabel: 'Trastevere',
		preview: 'Offline for a bit, but leaving a marker for later follow-up.'
	},
	{
		id: 'omar-bianchi',
		name: 'Omar Bianchi',
		role: 'Organizer',
		status: 'online',
		latitude: 41.9158,
		longitude: 12.5064,
		locationLabel: 'Piazza Bologna',
		preview: 'Testing the interactive map and the first popup-driven contact flow.'
	}
];