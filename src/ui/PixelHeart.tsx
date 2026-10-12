import { useMemo } from 'react'

// Cœur pixel art 15×13 : B = contour, R = remplissage, W = reflet.
const MAP = [
  '..BBBB...BBBB..',
  '.BRRRRB.BRRRRB.',
  'BRRWWRRBRRRRRRB',
  'BRWWRRRRRRRRRRB',
  'BRWRRRRRRRRRRRB',
  'BRRRRRRRRRRRRRB',
  '.BRRRRRRRRRRRB.',
  '..BRRRRRRRRRB..',
  '...BRRRRRRRB...',
  '....BRRRRRB....',
  '.....BRRRB.....',
  '......BRB......',
  '.......B.......',
]
const W = 15
const H = MAP.length

function path(ch: string): string {
  let d = ''
  MAP.forEach((row, y) => {
    for (let x = 0; x < W; x++) if (row[x] === ch) d += `M${x} ${y}h1v1h-1z`
  })
  return d
}

function HeartSvg({ full, size }: { full: boolean; size: number }) {
  const d = useMemo(() => ({ b: path('B'), r: path('R'), w: path('W') }), [])
  return (
    <svg className={full ? 'px-heart full' : 'px-heart empty'} width={size} height={Math.round((size * H) / W)} viewBox={`0 0 ${W} ${H}`} shapeRendering="crispEdges" aria-hidden="true">
      <path d={d.r} className="px-fill" />
      <path d={d.w} className="px-shine" />
      <path d={d.b} className="px-line" />
    </svg>
  )
}

export type HeartAnim = { kind: 'lose' | 'gain'; index: number } | null

/** Rangée de cœurs pixel. `anim` fait perdre (éclat) ou gagner (pop) le cœur d'index donné ; sinon affichage statique. */
export function PixelHearts({ count, max = 3, size = 28, anim = null, label }: { count: number; max?: number; size?: number; anim?: HeartAnim; label?: string }) {
  return (
    <span className="px-hearts" role="img" aria-label={label ?? `${count}/${max}`}>
      {Array.from({ length: max }, (_, i) => {
        const animating = anim && anim.index === i
        // Pendant une perte le cœur est encore plein (il éclate par-dessus le cœur vide) ; pendant un gain il est déjà compté.
        const full = i < count || (anim?.kind === 'lose' && animating)
        return (
          <span key={i} className="px-slot" style={{ width: size }}>
            <HeartSvg full={false} size={size} />
            {full && (
              <span className={animating ? `px-top ${anim!.kind}` : 'px-top'}>
                <HeartSvg full size={size} />
              </span>
            )}
          </span>
        )
      })}
    </span>
  )
}
