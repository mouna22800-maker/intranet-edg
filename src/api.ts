/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Wrapper autour de fetch() qui attache automatiquement le jeton d'authentification
 * (Authorization: Bearer <token>) aux requêtes, sans écraser d'éventuels headers déjà définis
 * (ex: Content-Type: application/json). Ne rien définir pour les requêtes multipart/FormData :
 * le navigateur gère lui-même le Content-Type avec sa frontière (boundary).
 */
export function apiFetch(url: string, options: RequestInit = {}, token?: string | null): Promise<Response> {
  const headers = new Headers(options.headers || {});
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  return fetch(url, { ...options, headers }).then((res) => {
    // Session expirée / invalide côté serveur : on prévient l'application pour déconnecter proprement.
    if (res.status === 401 && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('auth:unauthorized'));
    }
    return res;
  });
}
