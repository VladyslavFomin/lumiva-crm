export function getToken() { return localStorage.getItem('token') }
export function setToken(t: string) { localStorage.setItem('token', t) }
export function clearToken() { localStorage.removeItem('token') }
export function isLoggedIn() { return !!getToken() }
