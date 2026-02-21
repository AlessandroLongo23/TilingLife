import { writable } from 'svelte/store';

export const vertexTypes = writable([
	{ id: '3^6', name: '3⁶'},
	
	{ id: '3^2.4.3.4', name: '3².4.3.4'},
	{ id: '3^3.4^2', name: '3³.4²'},
	{ id: '3^4.6', name: '3⁴.6'},
	
	{ id: '3^2.4.12', name: '3².4.12'},
	{ id: '3.4.3.12', name: '3.4.3.12'},
	{ id: '3^2.6^2', name: '3².6²'},
	{ id: '3.6.3.6', name: '(3.6)²'},
	{ id: '3.4^2.6', name: '3.4².6'},
	{ id: '3.4.6.4', name: '3.4.6.4'},
	{ id: '4^4', name: '4⁴'},

	{ id: '3.12^2', name: '3.12²'},
	{ id: '4.6.12', name: '4.6.12'},
	{ id: '4.8^2', name: '4.8²'},
	{ id: '6^3', name: '6³'},
]);

export const selectedVertexTypes = writable([]); 