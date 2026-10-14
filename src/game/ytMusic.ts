// Thèmes de combat lus par un lecteur YouTube caché (IFrame API) : aucun fichier hébergé chez nous.
// Le son de l'iframe ne passe pas par le mixeur Web Audio : on y recopie donc le bouton son (sourdine), le volume et
// la mise en pause en arrière-plan. Pas de variante « K.O. imminent » ici (elle suppose des fichiers calés sur le même tempo).
import themes from '../data/ytThemes.json'
import { isMuted, onMutedChange } from './audio'

interface YTPlayer {
  playVideo(): void
  pauseVideo(): void
  stopVideo(): void
  seekTo(s: number, allowSeekAhead: boolean): void
  setVolume(v: number): void
  getVolume(): number
  mute(): void
  unMute(): void
  destroy(): void
}
interface YTApi { Player: new (el: HTMLElement, o: Record<string, unknown>) => YTPlayer }
declare global { interface Window { YT?: YTApi; onYouTubeIframeAPIReady?: () => void } }

const ENTRIES = themes as unknown as Record<string, { id: string } | string>

/** Clés cherchées, de la plus précise à la plus générale (mêmes règles que les mp3 locaux). */
export function ytVideoFor(keys: string[], table: Record<string, { id: string } | string> = ENTRIES): string | null {
  for (const k of keys) {
    const e = table[k]
    if (e && typeof e === 'object' && e.id) return e.id
  }
  return null
}

let apiReady: Promise<YTApi> | null = null
function loadApi(): Promise<YTApi> {
  if (window.YT?.Player) return Promise.resolve(window.YT)
  if (apiReady) return apiReady
  apiReady = new Promise<YTApi>((resolve, reject) => {
    const prev = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => { prev?.(); if (window.YT) resolve(window.YT); else reject(new Error('YT')) }
    const s = document.createElement('script')
    s.src = 'https://www.youtube.com/iframe_api'
    s.async = true
    s.onerror = () => { apiReady = null; reject(new Error('iframe_api')) }
    document.head.appendChild(s)
  })
  return apiReady
}

const VOLUME = 55
let stopCur: ((fade: number) => void) | null = null

/** Lance la vidéo (en boucle) ; `onError` est appelé si elle est introuvable, non intégrable, ou ne démarre pas. */
export function startYoutube(videoId: string, onError: () => void): void {
  stopYoutube(0.05)
  let dead = false
  let player: YTPlayer | null = null
  let started = false
  let host: HTMLDivElement | null = document.createElement('div')
  // Hors écran mais bien présent dans le DOM (un iframe en display:none peut être bloqué par le navigateur).
  host.style.cssText = 'position:fixed;left:-9999px;top:0;width:200px;height:200px;overflow:hidden;pointer-events:none'
  host.setAttribute('aria-hidden', 'true')
  const mount = document.createElement('div')
  host.appendChild(mount)
  document.body.appendChild(host)

  const fail = () => { if (dead) return; dead = true; cleanup(); onError() }
  const timeout = window.setTimeout(() => { if (!started) fail() }, 8000)
  const applyMute = () => { try { if (isMuted()) player?.mute(); else player?.unMute() } catch { /* lecteur détruit */ } }
  const offMute = onMutedChange(applyMute)
  const onVis = () => { try { if (document.hidden) player?.pauseVideo(); else if (!dead) player?.playVideo() } catch { /* idem */ } }
  document.addEventListener('visibilitychange', onVis)

  function cleanup() {
    window.clearTimeout(timeout)
    offMute()
    document.removeEventListener('visibilitychange', onVis)
    try { player?.destroy() } catch { /* idem */ }
    player = null
    host?.remove()
    host = null
    if (stopCur === stop) stopCur = null
  }
  function stop(fade: number) {
    if (dead) return
    dead = true
    const p = player
    if (!p || fade <= 0.06) { cleanup(); return }
    const v0 = (() => { try { return p.getVolume() } catch { return VOLUME } })()
    const t0 = performance.now()
    const id = window.setInterval(() => {
      const k = Math.min(1, (performance.now() - t0) / (fade * 1000))
      try { p.setVolume(Math.round(v0 * (1 - k))) } catch { /* idem */ }
      if (k >= 1) { window.clearInterval(id); cleanup() }
    }, 50)
  }
  stopCur = stop

  loadApi().then((YT) => {
    if (dead || !host) return
    player = new YT.Player(mount, {
      width: 200,
      height: 200,
      videoId,
      playerVars: { autoplay: 1, controls: 0, disablekb: 1, fs: 0, modestbranding: 1, playsinline: 1, rel: 0, iv_load_policy: 3, origin: location.origin },
      events: {
        onReady: () => { if (dead) return; try { player?.setVolume(VOLUME); applyMute(); player?.playVideo() } catch { /* idem */ } },
        onStateChange: (e: { data: number }) => {
          if (e.data === 1) started = true // lecture
          if (e.data === 0 && !dead) { try { player?.seekTo(0, true); player?.playVideo() } catch { /* idem */ } } // fin : on reboucle
        },
        onError: fail, // 2 paramètre, 5 HTML5, 100 introuvable, 101/150 intégration interdite
      },
    })
  }).catch(fail)
}

export function stopYoutube(fade = 0.8) {
  const s = stopCur
  stopCur = null
  s?.(fade)
}
