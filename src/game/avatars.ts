// Icônes de profil : 6 médaillons pixel-art (public/avatars/<id>.png). Le choix est enregistré dans profiles.avatar
// (supabase/profile_avatar.sql) et en local (localStorage) pour rester fonctionnel si le script SQL n'est pas encore appliqué.
export const AVATARS = ['pikachu', 'bulbasaur', 'charmander', 'squirtle', 'eevee', 'pokeball'] as const
export type AvatarId = (typeof AVATARS)[number]

export const isAvatar = (v: unknown): v is AvatarId => typeof v === 'string' && (AVATARS as readonly string[]).includes(v)
export const avatarSrc = (id: AvatarId) => `${import.meta.env.BASE_URL}avatars/${id}.png`

const KEY = 'pokedle.avatar'
export function loadLocalAvatar(): AvatarId | null {
  try {
    const v = localStorage.getItem(KEY)
    return isAvatar(v) ? v : null
  } catch {
    return null
  }
}
export function saveLocalAvatar(id: AvatarId | null) {
  try {
    if (id) localStorage.setItem(KEY, id)
    else localStorage.removeItem(KEY)
  } catch {
    /* stockage indisponible */
  }
}
